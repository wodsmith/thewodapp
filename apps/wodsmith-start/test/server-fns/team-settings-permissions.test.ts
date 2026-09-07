import { beforeEach, describe, expect, it, vi } from "vitest"
import { TEAM_PERMISSIONS } from "@/db/schema"
const state = vi.hoisted(() => ({
  session: null as any,
  findTeam: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler: (fn: Function) => (ctx: { data: unknown }) => fn({ data: validate(ctx.data) }),
    }),
    handler: (fn: Function) => fn,
  }),
}))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: async () => state.session, setActiveTeamCookie: vi.fn() }))
vi.mock("@/utils/email", () => ({ sendTeamInvitationEmail: vi.fn() }))
vi.mock("@/utils/kv-session", () => ({ updateAllSessionsOfUser: vi.fn() }))
vi.mock("@/db", () => ({ getDb: () => ({ query: { teamTable: { findFirst: state.findTeam } }, insert: state.insert, update: state.update, delete: state.remove }) }))
import { getTeamBySlugFn, inviteUserFn, updateMemberRoleFn, removeTeamMemberFn } from "@/server-fns/team-settings-fns"
beforeEach(() => {
  state.session = { userId: "reader", user: { role: "user" }, teams: [{ id: "gym", permissions: [TEAM_PERMISSIONS.ACCESS_DASHBOARD] }] }
  state.findTeam.mockResolvedValue({ id: "gym", name: "Gym", isPersonalTeam: false, creditBalance: 99 })
})
describe("Team settings authorization", () => {
  // @lat: [[settings-account-tests#Settings Account Tests#Server-derived team capabilities]]
  it("derives independent custom-role capabilities with the server's authorization rules", async () => {
    state.session.teams[0].permissions.push(TEAM_PERMISSIONS.CHANGE_MEMBER_ROLES)
    const result = await getTeamBySlugFn({ data: { slug: "gym" } })
    expect(result.data).toMatchObject({ permissions: { inviteMembers: false, changeMemberRoles: true, removeMembers: false } })
    expect(result.data).not.toHaveProperty("creditBalance")
  })
  it("preserves site-admin capabilities without requiring team membership", async () => {
    state.session = { userId: "admin", user: { role: "admin" }, teams: [] }
    const result = await getTeamBySlugFn({ data: { slug: "gym" } })
    expect(result.data).toMatchObject({ permissions: { inviteMembers: true, changeMemberRoles: true, removeMembers: true } })
  })
  it("rejects an outsider's team read", async () => {
    state.session.teams = []
    await expect(getTeamBySlugFn({ data: { slug: "gym" } })).rejects.toThrow("Missing required permission")
  })
  // @lat: [[settings-account-tests#Settings Account Tests#Team mutation authorization remains enforced]]
  it("still denies read-only callers before any invitation or member mutation", async () => {
    await expect(inviteUserFn({ data: { teamId: "gym", email: "new@example.com", roleId: "member" } })).rejects.toThrow("Missing required permission")
    await expect(updateMemberRoleFn({ data: { teamId: "gym", userId: "target", roleId: "admin" } })).rejects.toThrow("Missing required permission")
    await expect(removeTeamMemberFn({ data: { teamId: "gym", userId: "target" } })).rejects.toThrow("Missing required permission")
    expect(state.insert).not.toHaveBeenCalled()
    expect(state.update).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
  })
  it("keeps malformed team inputs rejected", async () => {
    await expect(async () => getTeamBySlugFn({ data: { slug: "" } })).rejects.toThrow()
    expect(state.findTeam).not.toHaveBeenCalled()
  })
})
