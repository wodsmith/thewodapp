/**
 * Athlete-facing competition invite server fns: getInviteByTokenFn, declineInviteFn.
 *
 * These two endpoints are the only invite paths an unauthenticated visitor
 * can hit, so the email-locking + identity-match logic is the *only*
 * thing standing between a leaked link and someone else's invite. This
 * file exercises the email normalization, registration cross-check, and
 * allocation guardrail edge cases the production outage post-mortems
 * flagged.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  COMPETITION_INVITE_ACTIVE_MARKER,
  COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInvite,
} from "@/db/schemas/competition-invites"
import { REGISTRATION_STATUS } from "@/db/schemas/competitions"

// ----- Mocks ---------------------------------------------------------------

// Direct-handler passthrough mirroring the existing sources.test pattern.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
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

// Each entry is the resolution of one `db.select(...)...limit(1)` chain.
// The order matches the source order of awaits inside the handler.
const lookupQueue: Array<unknown[]> = []

vi.mock("@/db", () => ({
  getDb: () => {
    const chain = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      groupBy: vi.fn(() => chain),
      innerJoin: vi.fn(() => chain),
      leftJoin: vi.fn(() => chain),
      async limit() {
        return lookupQueue.shift() ?? []
      },
      // Some queries (e.g. championship lookup) get awaited via .then on
      // the chain itself rather than .limit. Make the chain thenable so
      // `await db.select().from().where()` resolves to the next queued
      // batch.
      then(resolve: (v: unknown[]) => void) {
        const v = lookupQueue.shift() ?? []
        resolve(v)
        return Promise.resolve(v)
      },
      // declineInviteFn calls update() to flip status. We don't need to
      // observe the SET here — the helper is mocked separately. Provide
      // a noop chain so any stray .update().set().where() call doesn't
      // throw.
      update: vi.fn(() => chain),
      set: vi.fn(() => chain),
    } as unknown as Record<string, unknown> & {
      then: (r: (v: unknown[]) => void) => Promise<unknown[]>
    }
    return chain
  },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

vi.mock("@/server/competition-invites/claim", () => ({
  resolveInviteByToken: vi.fn(),
  assertInviteClaimable: vi.fn(),
  resolveAllocationForInvite: vi.fn(),
  getOccupiedCountForBucket: vi.fn(),
  InviteNotClaimableError: class InviteNotClaimableError extends Error {
    readonly reason: string
    constructor(reason: string, message?: string) {
      super(message ?? `Invite is not claimable: ${reason}`)
      this.name = "InviteNotClaimableError"
      this.reason = reason
    }
  },
}))

vi.mock("@/server/competition-invites/identity", () => ({
  assertInviteWithinAllocation: vi.fn(() => ({ ok: true })),
}))

vi.mock("@/server/competition-invites/decline", () => ({
  declineInvite: vi.fn(async () => undefined),
}))

vi.mock("@/server/competition-invites/issue", () => ({
  // Used by getInviteByTokenFn for the user-table account lookup. The
  // server fn calls `normalizeInviteEmail` directly so we keep the real
  // implementation by re-exporting a thin lower/trim.
  normalizeInviteEmail: (email: string) => email.trim().toLowerCase(),
}))

vi.mock("@/lib/logging", () => ({
  withRequestContext: <T>(_ctx: unknown, fn: () => T) => fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityUpdated: vi.fn(),
  logEntityDeleted: vi.fn(),
}))

// ----- Helpers / factories ------------------------------------------------

type InviteOverrides = Partial<CompetitionInvite>

function makeInvite(overrides: InviteOverrides = {}): CompetitionInvite {
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
    inviteeFirstName: "Pat",
    inviteeLastName: null,
    userId: null,
    sendAttempt: 1,
    emailDeliveryStatus: COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.QUEUED,
    emailLastError: null,
    roundId: "",
    createdAt: new Date("2099-01-01T00:00:00Z"),
    updatedAt: new Date("2099-01-01T00:00:00Z"),
    ...overrides,
  } as CompetitionInvite
}

async function getMocks() {
  const claim = await import("@/server/competition-invites/claim")
  const auth = await import("@/utils/auth")
  const decline = await import("@/server/competition-invites/decline")
  const identity = await import("@/server/competition-invites/identity")
  return { claim, auth, decline, identity }
}

beforeEach(() => {
  lookupQueue.length = 0
})

// ============================================================================
// getInviteByTokenFn
// ============================================================================

describe("getInviteByTokenFn", () => {
  it("returns not_found when the token does not resolve to a row", async () => {
    const { claim } = await getMocks()
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(null)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string }>
    )({
      data: { token: "tok_missing", slug: "open-2099" },
    })

    expect(result).toEqual({ kind: "not_claimable", reason: "not_found" })
  })

  it("returns not_found when the slug doesn't match the invite's championship", async () => {
    const { claim } = await getMocks()
    const invite = makeInvite({
      championshipCompetitionId: "comp_other",
    })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)

    // The championship lookup returns a row whose slug differs from the URL.
    lookupQueue.push([{ id: "comp_other", slug: "different-slug", name: "X" }])

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toEqual({ kind: "not_claimable", reason: "not_found" })
  })

  it("returns the InviteNotClaimableError reason when the invite is expired", async () => {
    const { claim } = await getMocks()
    const invite = makeInvite()
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {
      throw new claim.InviteNotClaimableError("expired")
    })

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string; championshipName: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toMatchObject({
      kind: "not_claimable",
      reason: "expired",
      championshipName: "Open",
    })
  })

  it("returns already_paid when the signed-in invitee already has an active registration", async () => {
    const { claim, auth } = await getMocks()
    const invite = makeInvite({ email: "athlete@example.com" })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    // championship lookup
    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    // Promise.all: division, account, session — push the two DB rows; the
    // session is from getSessionFromCookie below.
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    lookupQueue.push([{ id: "user_x" }])
    // existing-registration check returns one row
    lookupQueue.push([{ id: "reg_existing" }])

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toMatchObject({
      kind: "not_claimable",
      reason: "already_paid",
    })
  })

  it("treats session email and invite email as equal regardless of case/whitespace", async () => {
    const { claim, auth } = await getMocks()
    const invite = makeInvite({ email: "athlete@example.com" })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    lookupQueue.push([{ id: "user_x" }])
    // The existing-registration check should fire (because the email
    // matches after normalization). Returning a row asserts the session
    // path was reached.
    lookupQueue.push([{ id: "reg_existing" }])

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "  Athlete@Example.COM  ", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    // already_paid is only reachable when the session email matches the
    // invite email after normalization — proves the comparison is
    // case-insensitive and whitespace-tolerant.
    expect(result.reason).toBe("already_paid")
  })

  it("does not short-circuit to already_paid when the signed-in user differs from the invitee", async () => {
    const { claim, auth, identity } = await getMocks()
    const invite = makeInvite({
      email: "athlete@example.com",
      sourceId: null, // bespoke → bypass allocation guardrail
    })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    lookupQueue.push([]) // no account row for invite email
    // No registration lookup expected because session email != invite email.

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_other",
      user: { id: "user_other", email: "other@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        kind: string
        invite: CompetitionInvite
        accountExistsForInviteEmail: boolean
      }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result.kind).toBe("claimable")
    expect(result.accountExistsForInviteEmail).toBe(false)
    // assertInviteWithinAllocation should NOT be called for bespoke (sourceId === null)
    expect(identity.assertInviteWithinAllocation).not.toHaveBeenCalled()
  })

  it("returns over_allocated when a source-origin invite has filled its bucket", async () => {
    const { claim, auth, identity } = await getMocks()
    const invite = makeInvite({
      email: "athlete@example.com",
      sourceId: "cisrc_filled",
    })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    vi.mocked(claim.resolveAllocationForInvite).mockResolvedValueOnce(2)
    vi.mocked(claim.getOccupiedCountForBucket).mockResolvedValueOnce(2)
    vi.mocked(identity.assertInviteWithinAllocation).mockReturnValueOnce({
      ok: false,
      reason: "over_allocated",
    })

    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    lookupQueue.push([])

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toMatchObject({
      kind: "not_claimable",
      reason: "over_allocated",
    })
  })

  it("returns claimable with championship/division metadata on the happy path", async () => {
    const { claim, auth } = await getMocks()
    const invite = makeInvite({
      sourceId: null, // bypass allocation guardrail to keep the test focused on the happy path
    })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})

    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    // account exists for invite email
    lookupQueue.push([{ id: "user_existing" }])

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        kind: string
        invite: CompetitionInvite
        championshipName: string
        championshipSlug: string
        divisionLabel: string
        accountExistsForInviteEmail: boolean
      }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toMatchObject({
      kind: "claimable",
      championshipName: "Open",
      championshipSlug: "open-2099",
      divisionLabel: "RX",
      accountExistsForInviteEmail: true,
    })
    expect(result.invite.id).toBe(invite.id)
  })

  it("does not return already_paid for a removed registration (status filter)", async () => {
    // The where() clause filters out REGISTRATION_STATUS.REMOVED — so a
    // soft-deleted registration must NOT trigger the already_paid branch.
    // We assert this by returning [] from the registration query and
    // expecting kind=claimable.
    const { claim, auth } = await getMocks()
    const invite = makeInvite({
      email: "athlete@example.com",
      sourceId: null,
    })
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    lookupQueue.push([
      { id: invite.championshipCompetitionId, slug: "open-2099", name: "Open" },
    ])
    lookupQueue.push([{ id: invite.championshipDivisionId, label: "RX" }])
    lookupQueue.push([])
    // The registration query filters status != removed → returns [].
    lookupQueue.push([])

    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)

    const { getInviteByTokenFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      getInviteByTokenFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ kind: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result.kind).toBe("claimable")
    // Sanity: the constant is referenced so the test breaks if its value drifts.
    expect(REGISTRATION_STATUS.REMOVED).toBe("removed")
  })
})

// ============================================================================
// declineInviteFn
// ============================================================================

describe("declineInviteFn", () => {
  it("rejects unauthenticated callers with a sign-in error", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        declineInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { token: "tok_live", slug: "open-2099" },
      }),
    ).rejects.toThrow(/signed in/i)
  })

  it("returns ok:false reason=not_found for an unknown token", async () => {
    const { auth, claim } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(null)

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      declineInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean; reason: string }>
    )({
      data: { token: "tok_missing", slug: "open-2099" },
    })

    expect(result).toEqual({ ok: false, reason: "not_found" })
  })

  it("propagates the InviteNotClaimableError reason when the invite is already declined", async () => {
    const { auth, claim, decline } = await getMocks()
    const invite = makeInvite({ status: COMPETITION_INVITE_STATUS.DECLINED })
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {
      throw new claim.InviteNotClaimableError("declined")
    })

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      declineInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toEqual({ ok: false, reason: "declined" })
    expect(decline.declineInvite).not.toHaveBeenCalled()
  })

  it("throws an identity-mismatch error when the session email differs from the invitee", async () => {
    const { auth, claim, decline } = await getMocks()
    const invite = makeInvite({ email: "invitee@example.com" })
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "imposter@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        declineInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: { token: "tok_live", slug: "open-2099" },
      }),
    ).rejects.toThrow(/different account/i)
    expect(decline.declineInvite).not.toHaveBeenCalled()
  })

  it("matches identity case-insensitively (Athlete@Example.COM == athlete@example.com)", async () => {
    const { auth, claim, decline } = await getMocks()
    const invite = makeInvite({ email: "athlete@example.com" })
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "  ATHLETE@example.COM  ", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    // championship lookup for slug verification
    lookupQueue.push([{ slug: "open-2099" }])

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      declineInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toEqual({ ok: true })
    expect(decline.declineInvite).toHaveBeenCalledWith({
      inviteId: invite.id,
    })
  })

  it("returns not_found when the slug doesn't match the invite's championship", async () => {
    const { auth, claim, decline } = await getMocks()
    const invite = makeInvite({ email: "athlete@example.com" })
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    // championship lookup returns a row with a different slug
    lookupQueue.push([{ slug: "different-slug" }])

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      declineInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean; reason: string }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toEqual({ ok: false, reason: "not_found" })
    expect(decline.declineInvite).not.toHaveBeenCalled()
  })

  it("calls declineInvite on the happy path", async () => {
    const { auth, claim, decline } = await getMocks()
    const invite = makeInvite({ email: "athlete@example.com" })
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue({
      userId: "user_x",
      user: { id: "user_x", email: "athlete@example.com", role: "user" },
    } as unknown as Awaited<ReturnType<typeof auth.getSessionFromCookie>>)
    vi.mocked(claim.resolveInviteByToken).mockResolvedValueOnce(invite)
    vi.mocked(claim.assertInviteClaimable).mockImplementationOnce(() => {})
    lookupQueue.push([{ slug: "open-2099" }])

    const { declineInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      declineInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ ok: boolean }>
    )({
      data: { token: "tok_live", slug: "open-2099" },
    })

    expect(result).toEqual({ ok: true })
    expect(decline.declineInvite).toHaveBeenCalledTimes(1)
    expect(decline.declineInvite).toHaveBeenCalledWith({ inviteId: invite.id })
  })
})
