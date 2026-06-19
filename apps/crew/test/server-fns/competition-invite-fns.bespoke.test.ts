/**
 * Tests for the bespoke-invite server fns: createBespokeInviteFn (single)
 * and createBespokeInvitesBulkFn (paste-text bulk). These are the two
 * paths an organizer uses to manually add invites that don't trace to
 * a qualification source — the email handling here matters because
 * the input is freeform text the organizer might paste from a spreadsheet
 * with stray whitespace, casing differences, or duplicates.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

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

const lookupQueue: Array<unknown[]> = []
vi.mock("@/db", () => ({
  getDb: () => {
    const chain = {
      select: vi.fn(() => chain),
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      async limit() {
        return lookupQueue.shift() ?? []
      },
      then(resolve: (v: unknown[]) => void) {
        const v = lookupQueue.shift() ?? []
        resolve(v)
        return Promise.resolve(v)
      },
    }
    return chain
  },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

vi.mock("@/server/competition-invites/bespoke", () => ({
  createBespokeInvite: vi.fn(),
  createBespokeInvitesBulk: vi.fn(),
}))

vi.mock("@/lib/logging", () => ({
  withRequestContext: <T>(_ctx: unknown, fn: () => T) => fn(),
  logInfo: vi.fn(),
  logWarning: vi.fn(),
  logEntityCreated: vi.fn(),
  logEntityUpdated: vi.fn(),
  logEntityDeleted: vi.fn(),
}))

const sessionStub = {
  userId: "user_admin",
  user: { id: "user_admin", email: "admin@example.com", role: "user" },
  teams: [
    { id: "team_a", name: "Team A", permissions: ["manage_competitions"] },
  ],
}

const sessionWithoutPermission = {
  userId: "user_member",
  user: { id: "user_member", email: "member@example.com", role: "user" },
  teams: [{ id: "team_a", name: "Team A", permissions: [] }],
}

async function getMocks() {
  const auth = await import("@/utils/auth")
  const bespoke = await import("@/server/competition-invites/bespoke")
  return { auth, bespoke }
}

beforeEach(() => {
  lookupQueue.length = 0
})

// ============================================================================
// createBespokeInviteFn
// ============================================================================

describe("createBespokeInviteFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          email: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects callers without MANAGE_COMPETITIONS on the organizing team", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    // organizing team lookup
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          email: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/permission/i)
    expect(bespoke.createBespokeInvite).not.toHaveBeenCalled()
  })

  it("rejects when the championship lookup returns no rows (competition not found)", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([]) // organizing team lookup returns nothing

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_missing",
          championshipDivisionId: "div_rx",
          email: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/Competition not found/)
    expect(bespoke.createBespokeInvite).not.toHaveBeenCalled()
  })

  it("rejects malformed emails at the schema boundary", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          email: "not-an-email",
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects emails over 255 chars", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    // 250+ char local part keeps the email syntactically valid but
    // beyond the 255 cap.
    const tooLong = `${"x".repeat(250)}@example.com`

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          email: tooLong,
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects bespokeReason longer than 255 chars", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInviteFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          email: "athlete@example.com",
          bespokeReason: "x".repeat(300),
        },
      }),
    ).rejects.toThrow()
  })

  it("creates the invite and forwards the optional name + reason fields", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    vi.mocked(bespoke.createBespokeInvite).mockResolvedValueOnce({
      id: "ci_new",
    } as unknown as Awaited<ReturnType<typeof bespoke.createBespokeInvite>>)

    const { createBespokeInviteFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      createBespokeInviteFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{ invite: { id: string } }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        email: "Athlete@Example.com",
        inviteeFirstName: "Pat",
        inviteeLastName: "Lee",
        bespokeReason: "Sponsored",
      },
    })

    expect(result.invite.id).toBe("ci_new")
    expect(bespoke.createBespokeInvite).toHaveBeenCalledWith({
      championshipCompetitionId: "comp_champ",
      championshipDivisionId: "div_rx",
      email: "Athlete@Example.com",
      inviteeFirstName: "Pat",
      inviteeLastName: "Lee",
      bespokeReason: "Sponsored",
    })
  })
})

// ============================================================================
// createBespokeInvitesBulkFn
// ============================================================================

describe("createBespokeInvitesBulkFn", () => {
  it("rejects unauthenticated callers", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(null)

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInvitesBulkFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          pasteText: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/not authenticated/i)
  })

  it("rejects pasteText longer than 200K chars (DoS guardrail)", async () => {
    const { auth } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInvitesBulkFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          pasteText: "x".repeat(200_001),
        },
      }),
    ).rejects.toThrow()
  })

  it("rejects without permission and never invokes the helper", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionWithoutPermission as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInvitesBulkFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          pasteText: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/permission/i)
    expect(bespoke.createBespokeInvitesBulk).not.toHaveBeenCalled()
  })

  it("returns the helper's classified result (created / duplicates / invalid)", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    vi.mocked(bespoke.createBespokeInvitesBulk).mockResolvedValueOnce({
      created: [
        { id: "ci_a", email: "a@example.com" },
        { id: "ci_b", email: "b@example.com" },
      ],
      duplicates: [{ email: "dup@example.com" }],
      invalid: [{ raw: "garbage line", reason: "Invalid email" }],
    } as unknown as Awaited<
      ReturnType<typeof bespoke.createBespokeInvitesBulk>
    >)

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    const result = await (
      createBespokeInvitesBulkFn as unknown as (ctx: {
        data: unknown
      }) => Promise<{
        created: unknown[]
        duplicates: unknown[]
        invalid: unknown[]
      }>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        pasteText:
          "a@example.com\nb@example.com\ndup@example.com\ngarbage line",
      },
    })

    expect(result.created).toHaveLength(2)
    expect(result.duplicates).toHaveLength(1)
    expect(result.invalid).toHaveLength(1)
    expect(bespoke.createBespokeInvitesBulk).toHaveBeenCalledWith({
      championshipCompetitionId: "comp_champ",
      championshipDivisionId: "div_rx",
      pasteText:
        "a@example.com\nb@example.com\ndup@example.com\ngarbage line",
    })
  })

  it("forwards the raw paste-text untouched (the helper does parsing)", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    vi.mocked(bespoke.createBespokeInvitesBulk).mockResolvedValueOnce({
      created: [],
      duplicates: [],
      invalid: [],
    } as unknown as Awaited<
      ReturnType<typeof bespoke.createBespokeInvitesBulk>
    >)

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    // Mixed input: leading whitespace, tabs, mixed casing, blank lines.
    const raw = "  Pat,Lee,Pat@Example.COM  \n\t\nbob@example.com\n"
    await (
      createBespokeInvitesBulkFn as unknown as (ctx: {
        data: unknown
      }) => Promise<unknown>
    )({
      data: {
        championshipCompetitionId: "comp_champ",
        championshipDivisionId: "div_rx",
        pasteText: raw,
      },
    })

    // The server fn passes through raw text — normalization, dedupe,
    // and validation are all the helper's responsibility, and we don't
    // want the server fn doing string transforms.
    expect(bespoke.createBespokeInvitesBulk).toHaveBeenCalledWith(
      expect.objectContaining({ pasteText: raw }),
    )
  })

  it("propagates a FreeCompetitionNotEligibleError thrown by the helper", async () => {
    const { auth, bespoke } = await getMocks()
    vi.mocked(auth.getSessionFromCookie).mockResolvedValue(
      sessionStub as unknown as Awaited<
        ReturnType<typeof auth.getSessionFromCookie>
      >,
    )
    lookupQueue.push([{ organizingTeamId: "team_a" }])

    class FakeFree extends Error {
      name = "FreeCompetitionNotEligibleError"
      constructor() {
        super("Invites are not supported for free divisions.")
      }
    }
    vi.mocked(bespoke.createBespokeInvitesBulk).mockRejectedValueOnce(
      new FakeFree(),
    )

    const { createBespokeInvitesBulkFn } = await import(
      "@/server-fns/competition-invite-fns"
    )

    await expect(
      (
        createBespokeInvitesBulkFn as unknown as (ctx: {
          data: unknown
        }) => Promise<unknown>
      )({
        data: {
          championshipCompetitionId: "comp_champ",
          championshipDivisionId: "div_rx",
          pasteText: "athlete@example.com",
        },
      }),
    ).rejects.toThrow(/free divisions/i)
  })
})
