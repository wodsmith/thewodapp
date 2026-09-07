import { beforeEach, describe, expect, it, vi } from "vitest"
import { previewAudienceFn } from "@/server-fns/broadcast-fns"
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  session: vi.fn(),
  permission: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: mocks.db }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: mocks.session }))
vi.mock("@/server-fns/requireTeamMembership", () => ({
  requireTeamPermission: mocks.permission,
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parse: (data: unknown) => unknown) => ({
      handler:
        (handler: (input: { data: unknown }) => unknown) =>
        (input: { data: unknown }) =>
          handler({ data: parse(input.data) }),
    }),
  }),
}))
const proof = {
  waiverId: "liability",
  signatureName: "Guest Athlete",
  signedAt: "2026-09-01T12:00:00.000Z",
}
function setup({
  metadata = JSON.stringify({ pendingSignatures: [proof] }),
  status = "accepted",
  acceptedAt = null as Date | null,
  validWaivers = [{ id: "liability" }],
  proofInvitationId = "invite",
} = {}) {
  const rows = [
    [
      {
        id: "reg",
        userId: "captain",
        athleteTeamId: "athlete-team",
        email: "captain@example.com",
        firstName: "Captain",
        pendingTeammates: null,
      },
    ],
    [],
    [{ id: "invite", teamId: "athlete-team", email: "guest@example.com" }],
    validWaivers,
    [{ userId: "captain", waiverId: "liability" }],
    [{ id: proofInvitationId, metadata, status, acceptedAt }],
  ]
  let call = 0
  mocks.db.mockReturnValue({
    query: {
      competitionsTable: {
        findFirst: async () => ({
          id: "comp",
          organizingTeamId: "organizer",
          competitionTeamId: "comp-team",
        }),
      },
    },
    select: () => {
      const result = rows[call++] ?? []
      const chain: Record<string, unknown> = {
        then: (resolve: (rows: unknown[]) => void) => resolve(result),
      }
      for (const method of ["from", "where", "innerJoin"])
        chain[method] = () => chain
      return chain
    },
  })
}
const preview = (
  status: "signed" | "unsigned" = "unsigned",
  waiverId = "liability",
) =>
  previewAudienceFn({
    data: {
      competitionId: "comp",
      audienceFilter: { type: "all", waiverFilters: [{ waiverId, status }] },
    },
  })
beforeEach(() => {
  mocks.session.mockResolvedValue({ userId: "organizer" })
  mocks.permission.mockResolvedValue(undefined)
})
describe("guest waiver reminder audiences", () => {
  // @lat: [[series-attempt-integrity#Accepted guest pre-signatures]]
  it("excludes accepted pre-signed guests from reminders and includes them in signed previews", async () => {
    setup()
    expect(await preview()).toEqual({ count: 0 })
    setup()
    expect(await preview("signed")).toEqual({ count: 2 })
  })
  // @lat: [[series-attempt-integrity#Missing proof remains unsigned]]
  it.each([
    { proofInvitationId: "another-invitation" },
    { metadata: "{" },
    { metadata: "{}" },
    {
      metadata: JSON.stringify({
        pendingSignatures: [{ waiverId: "liability" }],
      }),
    },
    {
      metadata: JSON.stringify({
        pendingSignatures: [{ ...proof, waiverId: "other" }],
      }),
    },
    {
      metadata: JSON.stringify({
        pendingSignatures: [{ ...proof, signatureName: " " }],
      }),
    },
    {
      metadata: JSON.stringify({
        pendingSignatures: [{ ...proof, signedAt: "not-a-date" }],
      }),
    },
    { status: "pending" },
    { status: "cancelled" },
    { acceptedAt: new Date("2026-09-02T00:00:00Z") },
  ])(
    "does not infer a signature from malformed, unrelated, or inapplicable proof: %j",
    async (overrides) => {
      setup(overrides)
      expect(await preview()).toEqual({ count: 1 })
    },
  )
  // @lat: [[series-attempt-integrity#Reminder access and waiver scope]]
  it("rejects unauthenticated/unauthorized access and stale waiver selections", async () => {
    setup()
    mocks.session.mockResolvedValueOnce(null)
    await expect(preview()).rejects.toThrow("Authentication required")
    mocks.permission.mockRejectedValueOnce(new Error("Forbidden"))
    await expect(preview()).rejects.toThrow("Forbidden")
    setup({ validWaivers: [] })
    await expect(preview()).rejects.toThrow("no longer valid")
  })
})
