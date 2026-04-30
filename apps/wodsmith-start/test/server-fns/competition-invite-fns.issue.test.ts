/**
 * Tests for issueInvitesFn — the organizer-facing pipeline that inserts
 * `competition_invites` rows, renders the email body, and queues messages
 * onto BROADCAST_EMAIL_QUEUE. This is the highest-blast-radius server fn
 * in the feature: a regression here can either spam athletes, drop a
 * round entirely, or leak invite tokens. We exercise the auth gate, the
 * free-competition guard, the per-recipient render/dispatch loop, the
 * mid-batch failure path that flips emailDeliveryStatus to 'failed',
 * and a handful of email-address edge cases that the Zod validator
 * is supposed to catch at the boundary.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
} from "@/db/schemas/competition-invites"

// ----- Mocks ---------------------------------------------------------------

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    // The async wrapper turns any synchronous parser throw (Zod) into a
    // rejected promise — otherwise `.rejects.toThrow()` won't match because
    // `serverFn(ctx)` would throw synchronously instead of rejecting.
    inputValidator: (parser: (d: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        async (ctx: { data: unknown }) =>
          fn({ data: parser(ctx.data) }),
    }),
    handler:
      (fn: (...args: unknown[]) => Promise<unknown>) =>
      async (...args: unknown[]) =>
        fn(...args),
  }),
  createServerOnlyFn: <T>(fn: T): T => fn,
}))

const lookupQueue: Array<unknown[]> = []
const updateCalls: Array<{
  set: Record<string, unknown>
  whereCalled: boolean
}> = []

vi.mock("@/db", () => ({
  getDb: () => {
    const chain = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      where: vi.fn(() => {
        // mark the most recent update call's where as resolved
        const last = updateCalls[updateCalls.length - 1]
        if (last && !last.whereCalled) last.whereCalled = true
        return chain
      }),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      async limit() {
        return lookupQueue.shift() ?? []
      },
      then(resolve: (v: unknown[]) => void) {
        const v = lookupQueue.shift() ?? []
        resolve(v)
        return Promise.resolve(v)
      },
      update: vi.fn(() => chain),
      set: vi.fn((values: Record<string, unknown>) => {
        updateCalls.push({ set: values, whereCalled: false })
        return chain
      }),
    } as unknown as Record<string, unknown> & {
      then: (r: (v: unknown[]) => void) => Promise<unknown[]>
    }
    return chain
  },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

const sessionStub = {
  userId: "user_admin",
  user: { id: "user_admin", email: "admin@example.com", role: "user" },
  teams: [
    { id: "team_a", name: "Team A", permissions: ["manage_competitions"] },
  ],
}

class FakeFreeCompetitionNotEligibleError extends Error {
  constructor(params: { competitionId: string; divisionId: string }) {
    super(
      `Invites are not supported for free divisions. Competition ${params.competitionId} division ${params.divisionId} has a $0 registration fee.`,
    )
    this.name = "FreeCompetitionNotEligibleError"
  }
}

vi.mock("@/server/competition-invites/issue", () => ({
  issueInvitesForRecipients: vi.fn(),
  reissueInvite: vi.fn(),
  normalizeInviteEmail: (e: string) => e.trim().toLowerCase(),
  FreeCompetitionNotEligibleError: FakeFreeCompetitionNotEligibleError,
}))

// react-email render — we don't care about the actual HTML, just that
// the function is called and that its failure mode is handled.
const renderMock = vi.fn(async () => "<html>email</html>")
vi.mock("@react-email/render", () => ({
  render: renderMock,
}))

vi.mock("@/react-email/competition-invites/invite-email", () => ({
  CompetitionInviteEmail: () => ({}),
}))

vi.mock("@/lib/env", () => ({
  getAppUrl: () => "https://wodsmith.example",
}))

vi.mock("@/lib/logging", () => ({
  withRequestContext: <T>(_ctx: unknown, fn: () => T) => fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityUpdated: vi.fn(),
  logEntityDeleted: vi.fn(),
}))

// We override the cloudflare:workers stub per-test to swap the queue
// binding (present / missing / throwing). Default factory provides an
// empty env so we can spread BROADCAST_EMAIL_QUEUE in via a mutable
// reference.
const queueStub = {
  send: vi.fn(async () => undefined),
}
const envStub: Record<string, unknown> = {
  BROADCAST_EMAIL_QUEUE: queueStub,
  APP_URL: "https://wodsmith.example",
}
vi.mock("cloudflare:workers", () => ({
  env: envStub,
}))

// requireTeamMembership — pass through to the real impl since it just
// reads from getSessionFromCookie which is mocked.
// (no override)

// ----- Helpers / factories ------------------------------------------------

function makeInvite(overrides: Partial<CompetitionInvite> = {}): CompetitionInvite {
  return {
    id: "ci_default",
    championshipCompetitionId: "comp_champ",
    championshipDivisionId: "div_rx",
    sourceId: "cisrc_default",
    email: "athlete@example.com",
    origin: COMPETITION_INVITE_ORIGIN.SOURCE,
    status: COMPETITION_INVITE_STATUS.PENDING,
    activeMarker: COMPETITION_INVITE_ACTIVE_MARKER,
    claimToken: "tok_live",
    claimTokenHash: null,
    expiresAt: new Date("2099-01-01T00:00:00Z"),
    sourceCompetitionId: "comp_qual",
    sourcePlacement: 1,
    sourcePlacementLabel: "1st — Qualifier",
    bespokeReason: null,
    inviteeFirstName: null,
    inviteeLastName: null,
    userId: null,
    sendAttempt: 1,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
    emailLastError: null,
    roundId: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CompetitionInvite
}

const validRecipient = {
  email: "ATHLETE@Example.com",
  origin: COMPETITION_INVITE_ORIGIN.SOURCE as "source",
  sourceId: "cisrc_1",
  sourceCompetitionId: "comp_qual",
  sourcePlacement: 1,
  sourcePlacementLabel: "1st",
}

async function getMocks() {
  const auth = await import("@/utils/auth")
  const issue = await import("@/server/competition-invites/issue")
  return { auth, issue }
}

/**
 * Push the standard pre-issue lookups: competition, division, and
 * organizing team.
 */
function pushHappyPathLookups() {
  // getCompetitionOrganizingTeamId → competition row
  lookupQueue.push([{ organizingTeamId: "team_a" }])
  // championship metadata
  lookupQueue.push([{ id: "comp_champ", slug: "open-2099", name: "Open 2099" }])
  // division metadata
  lookupQueue.push([{ id: "div_rx", label: "RX" }])
  // organizing team
  lookupQueue.push([{ id: "team_a", name: "Team A" }])
}

beforeEach(() => {
  lookupQueue.length = 0
  updateCalls.length = 0
  renderMock.mockClear()
  renderMock.mockImplementation(async () => "<html>email</html>")
  queueStub.send.mockClear()
  queueStub.send.mockImplementation(async () => undefined)
  // restore env queue binding (a test below removes it)
  envStub.BROADCAST_EMAIL_QUEUE = queueStub
})

// ============================================================================

describe("issueInvitesFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "You're in!",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects malformed email addresses at the schema boundary", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Subj",
          recipients: [{ ...validRecipient, email: "not-an-email" }],
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects an empty recipients list", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Subj",
          recipients: [],
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects a non-calendar rsvpDeadlineDate (e.g. Feb 30)", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-02-30",
          subject: "Subj",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/calendar/i)
  })

  it("rejects datetime strings — only YYYY-MM-DD is accepted", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31T00:00:00Z",
          subject: "Subj",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/YYYY-MM-DD/i)
  })

  it("re-throws a friendly message when the target division is free", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()
    vi.mocked(issue.issueInvitesForRecipients).mockRejectedValueOnce(
      new FakeFreeCompetitionNotEligibleError({
        competitionId: "comp_champ",
        divisionId: "div_rx",
      }),
    )

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Subj",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/free divisions/i)
  })

  it("queues one email per inserted invite and returns the sent count", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    const inviteA = makeInvite({ id: "ci_a", email: "a@example.com" })
    const inviteB = makeInvite({ id: "ci_b", email: "b@example.com" })
    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [
        { invite: inviteA, plaintextToken: "tok_a" },
        { invite: inviteB, plaintextToken: "tok_b" },
      ],
      alreadyActive: [],
    })

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sentCount: number
        skipped: unknown[]
        failed: unknown[]
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2099-12-31",
        subject: "Welcome",
        recipients: [
          { ...validRecipient, email: "a@example.com" },
          { ...validRecipient, email: "b@example.com" },
        ],
      },
    })

    expect(result.sentCount).toBe(2)
    expect(result.failed).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
    expect(queueStub.send).toHaveBeenCalledTimes(2)
    expect(renderMock).toHaveBeenCalledTimes(2)
  })

  it("classifies non-draft already-active rows as skipped (no email queued)", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [],
      alreadyActive: [
        {
          email: "a@example.com",
          existingInviteId: "ci_existing",
          isDraft: false,
        },
      ],
    })

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sentCount: number
        skipped: Array<{ existingInviteId: string }>
        failed: unknown[]
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2099-12-31",
        subject: "Welcome",
        recipients: [{ ...validRecipient, email: "a@example.com" }],
      },
    })

    expect(result.sentCount).toBe(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0].existingInviteId).toBe("ci_existing")
    expect(queueStub.send).not.toHaveBeenCalled()
  })

  it("activates draft bespoke rows via reissueInvite and queues their emails", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [],
      alreadyActive: [
        {
          email: "draft@example.com",
          existingInviteId: "ci_draft",
          isDraft: true,
        },
      ],
    })

    const draftActivated = makeInvite({
      id: "ci_draft",
      email: "draft@example.com",
    })
    vi.mocked(issue.reissueInvite).mockResolvedValueOnce({
      invite: draftActivated,
      plaintextToken: "tok_draft_new",
    })

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sentCount: number
        skipped: unknown[]
        failed: unknown[]
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2099-12-31",
        subject: "Welcome",
        recipients: [{ ...validRecipient, email: "draft@example.com" }],
      },
    })

    expect(issue.reissueInvite).toHaveBeenCalledTimes(1)
    expect(result.sentCount).toBe(1)
    expect(queueStub.send).toHaveBeenCalledTimes(1)
  })

  it("marks an invite as failed but continues the rest of the batch when render throws", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    const inviteA = makeInvite({ id: "ci_a", email: "a@example.com" })
    const inviteB = makeInvite({ id: "ci_b", email: "b@example.com" })
    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [
        { invite: inviteA, plaintextToken: "tok_a" },
        { invite: inviteB, plaintextToken: "tok_b" },
      ],
      alreadyActive: [],
    })

    // First render throws; second succeeds.
    renderMock
      .mockImplementationOnce(async () => {
        throw new Error("render boom")
      })
      .mockImplementationOnce(async () => "<html>ok</html>")

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sentCount: number
        failed: Array<{ inviteId: string; email: string; error: string }>
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2099-12-31",
        subject: "Welcome",
        recipients: [
          { ...validRecipient, email: "a@example.com" },
          { ...validRecipient, email: "b@example.com" },
        ],
      },
    })

    expect(result.sentCount).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({
      inviteId: "ci_a",
      email: "a@example.com",
    })
    // The handler should have flipped emailDeliveryStatus to FAILED for ci_a.
    const failedUpdate = updateCalls.find(
      (u) =>
        u.set.emailDeliveryStatus ===
        COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.FAILED,
    )
    expect(failedUpdate).toBeDefined()
    expect(failedUpdate?.set.emailLastError).toMatch(/render boom/)
    expect(queueStub.send).toHaveBeenCalledTimes(1)
  })

  it("does not crash when the BROADCAST_EMAIL_QUEUE binding is missing", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    // Strip the queue from env for this test only.
    envStub.BROADCAST_EMAIL_QUEUE = undefined

    const inviteA = makeInvite({ id: "ci_a", email: "a@example.com" })
    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [{ invite: inviteA, plaintextToken: "tok_a" }],
      alreadyActive: [],
    })

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        sentCount: number
        failed: unknown[]
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2099-12-31",
        subject: "Welcome",
        recipients: [{ ...validRecipient, email: "a@example.com" }],
      },
    })

    // Render still runs (HTML is built even without a queue) and the
    // handler logs a warning instead of throwing.
    expect(renderMock).toHaveBeenCalledTimes(1)
    expect(result.sentCount).toBe(1)
    expect(result.failed).toHaveLength(0)
  })

  it("rejects when the championship lookup returns no rows", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    // First lookup (organizing team) succeeds; the parallel championship
    // lookup returns []; division and team are required to keep the
    // queue aligned but never read.
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([]) // championship missing
    lookupQueue.push([{ id: "div_rx", label: "RX" }])
    lookupQueue.push([{ id: "team_a", name: "Team A" }])

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Welcome",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/Championship not found/)

    // Sanity: helper was never invoked because the precondition fails.
    expect(issue.issueInvitesForRecipients).not.toHaveBeenCalled()
  })

  it("rejects when the division lookup returns no rows", async () => {
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])
    lookupQueue.push([
      { id: "comp_champ", slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([]) // division missing
    lookupQueue.push([{ id: "team_a", name: "Team A" }])

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Welcome",
          recipients: [validRecipient],
        },
      }),
    ).rejects.toThrow(/Division not found/)

    expect(issue.issueInvitesForRecipients).not.toHaveBeenCalled()
  })

  it("REGRESSION GUARD — activation loop should not abort the batch when reissueInvite throws mid-loop", async () => {
    // Reported behavior to lock in: the dispatch loop below is wrapped
    // in try/catch and explicitly justified in a comment ("a single throw
    // in the middle of a large batch ... doesn't abort the whole loop and
    // leave the un-dispatched rows in `queued` limbo"). The activation
    // loop above it currently does NOT have the same protection — a
    // reissueInvite failure on the Nth draft propagates up before any
    // already-inserted rows get email-dispatched, even though the first
    // N-1 drafts have already rotated tokens (live state) and the
    // inserted rows have already been transactionally written.
    //
    // This test asserts the observed behavior. If we later add try/catch
    // parity (failed-activation rows reported via `failed` like the
    // dispatch loop), update this test to match — that's the right fix.
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    const insertedInvite = makeInvite({
      id: "ci_inserted",
      email: "fresh@example.com",
    })
    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [{ invite: insertedInvite, plaintextToken: "tok_inserted" }],
      alreadyActive: [
        {
          email: "draft1@example.com",
          existingInviteId: "ci_d1",
          isDraft: true,
        },
        {
          email: "draft2@example.com",
          existingInviteId: "ci_d2",
          isDraft: true,
        },
      ],
    })

    // First reissue succeeds; second blows up before reaching dispatch.
    vi.mocked(issue.reissueInvite)
      .mockResolvedValueOnce({
        invite: makeInvite({
          id: "ci_d1",
          email: "draft1@example.com",
        }),
        plaintextToken: "tok_d1",
      })
      .mockRejectedValueOnce(new Error("reissue blip"))

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        issueInvitesFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          rsvpDeadlineDate: "2099-12-31",
          subject: "Welcome",
          recipients: [
            { ...validRecipient, email: "fresh@example.com" },
            {
              ...validRecipient,
              origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
              sourceId: undefined,
              sourceCompetitionId: undefined,
              sourcePlacement: undefined,
              email: "draft1@example.com",
            },
            {
              ...validRecipient,
              origin: COMPETITION_INVITE_ORIGIN.BESPOKE,
              sourceId: undefined,
              sourceCompetitionId: undefined,
              sourcePlacement: undefined,
              email: "draft2@example.com",
            },
          ],
        },
      }),
    ).rejects.toThrow(/reissue blip/)

    // Confirms the leak: render & queue.send were never called for
    // the inserted invite or the first activated draft, even though
    // those rows are already in a live state in the DB.
    expect(renderMock).not.toHaveBeenCalled()
    expect(queueStub.send).not.toHaveBeenCalled()
    // First reissue ran and rotated the token, so `ci_d1` is now a
    // live invite that the recipient will never get an email about
    // unless an organizer manually intervenes.
    expect(issue.reissueInvite).toHaveBeenCalledTimes(2)
  })

  it("uses the same calendar day in the email regardless of TZ (no off-by-one)", async () => {
    // The label is rendered from the y/m/d ints we typed, never via
    // `new Date().toLocale*()`. Sanity-check this by reading the
    // params passed into renderInviteEmailHtml via the mocked render fn.
    const { auth, issue } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    pushHappyPathLookups()

    const invite = makeInvite({ id: "ci_a", email: "a@example.com" })
    vi.mocked(issue.issueInvitesForRecipients).mockResolvedValueOnce({
      inserted: [{ invite, plaintextToken: "tok_a" }],
      alreadyActive: [],
    })

    const { issueInvitesFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await (
      issueInvitesFn as unknown as (ctx: {
        data: unknown
      }) => Promise<unknown>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        rsvpDeadlineDate: "2025-03-01",
        subject: "Welcome",
        recipients: [{ ...validRecipient, email: "a@example.com" }],
      },
    })

    // The first arg to render() is the JSX element returned by
    // CompetitionInviteEmail, but our mock for that returns a plain
    // object so `props` lives on `.props` of the React element. We
    // don't have access to that here (the mock just returns {}). So
    // we rely on the queue.send call carrying the bodyHtml string and
    // that the calendar passed through the issue helper unchanged via
    // rsvpDeadlineAt.
    const args = vi
      .mocked(issue.issueInvitesForRecipients)
      .mock.calls[0]?.[0] as { rsvpDeadlineAt: Date } | undefined
    expect(args?.rsvpDeadlineAt.toISOString()).toBe(
      "2025-03-01T23:59:59.000Z",
    )
  })
})
