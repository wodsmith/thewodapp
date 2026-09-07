import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ data: {} as any, invalidate: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useLoaderData: () => state.data }),
  useRouter: () => ({ invalidate: state.invalidate }),
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/team-settings-fns", () => ({
  getTeamBySlugFn: vi.fn(), getTeamMembersFn: vi.fn(), getTeamInvitationsFn: vi.fn(),
  cancelInvitationFn: vi.fn(), inviteUserFn: vi.fn(), removeTeamMemberFn: vi.fn(), updateMemberRoleFn: vi.fn(), createTeamFn: vi.fn(),
}))
vi.mock("@/lib/posthog", () => ({ trackEvent: vi.fn() }))
import { Route } from "@/routes/_protected/settings/teams/$teamSlug/index"
import { Route as CreateRoute } from "@/routes/_protected/settings/teams/create/index"
import { cancelInvitationFn, getTeamBySlugFn, getTeamInvitationsFn, getTeamMembersFn } from "@/server-fns/team-settings-fns"
const TeamPage = Route.options.component as React.ComponentType
const CreatePage = CreateRoute.options.component as React.ComponentType
const load = () => (Route.options.loader as Function)({ params: { teamSlug: "gym" } })
const invitation = { id: "invite", email: "new@example.com", roleId: "member", expiresAt: null }
const member = { id: "membership", userId: "member", roleId: "member", roleName: "Member", isSystemRole: true, isActive: true, user: { firstName: "Test", lastName: "Member", email: "member@example.com" } }
const permissions = { inviteMembers: true, changeMemberRoles: true, removeMembers: true }
beforeEach(() => {
  state.data = { team: { id: "gym", name: "Gym", isPersonalTeam: false, createdAt: new Date(), permissions: { ...permissions } }, members: [member], invitations: [], invitationsError: false }
  vi.mocked(getTeamBySlugFn).mockResolvedValue({ success: true, data: state.data.team })
  vi.mocked(getTeamMembersFn).mockResolvedValue({ success: true, data: state.data.members })
  vi.mocked(getTeamInvitationsFn).mockResolvedValue({ success: true, data: [] })
})
afterEach(cleanup)
describe("Team settings", () => {
  // @lat: [[settings-account-tests#Settings Account Tests#Invitation error recovery]]
  it("shows an invitation read failure and retries to recover pending invitations", async () => {
    vi.mocked(getTeamInvitationsFn).mockRejectedValueOnce(new Error("Unavailable"))
    state.data = await load()
    const { rerender } = render(<TeamPage />)
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load pending invitations")
    state.invalidate.mockImplementation(async () => { state.data = await load(); rerender(<TeamPage />) })
    vi.mocked(getTeamInvitationsFn).mockResolvedValue({ success: true, data: [invitation] as any })
    fireEvent.click(screen.getByRole("button", { name: "Retry invitations" }))
    await waitFor(() => expect(screen.getByText(invitation.email)).toBeInTheDocument())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
  it("keeps a successful empty invitation result free of an error", async () => {
    state.data = await load()
    render(<TeamPage />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText("Pending Invitations")).not.toBeInTheDocument()
  })
  // @lat: [[settings-account-tests#Settings Account Tests#Granular team action permissions]]
  it.each(["inviteMembers", "changeMemberRoles", "removeMembers"] as const)("shows only permitted %s actions on desktop and mobile", async (permission) => {
    state.data.team.permissions = { inviteMembers: false, changeMemberRoles: false, removeMembers: false, [permission]: true }
    state.data = await load()
    render(<TeamPage />)
    expect(screen.queryByRole("button", { name: "Invite" }) !== null).toBe(permission === "inviteMembers")
    expect(screen.queryAllByRole("combobox")).toHaveLength(permission === "changeMemberRoles" ? 2 : permission === "inviteMembers" ? 1 : 0)
    expect(screen.queryAllByRole("button", { name: /Remove/ })).toHaveLength(permission === "removeMembers" ? 2 : 0)
    expect(getTeamInvitationsFn).toHaveBeenCalledTimes(permission === "inviteMembers" ? 1 : 0)
  })
  it("hides member actions for personal teams and protects owner rows", () => {
    state.data.team.isPersonalTeam = true
    const { rerender } = render(<TeamPage />)
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument()
    expect(screen.queryAllByRole("combobox")).toHaveLength(0)
    expect(screen.queryAllByRole("button", { name: /Remove/ })).toHaveLength(0)
    state.data.team.isPersonalTeam = false
    state.data.members = [{ ...member, roleId: "owner", roleName: "Owner" }]
    rerender(<TeamPage />)
    expect(screen.queryAllByRole("combobox")).toHaveLength(1)
    expect(screen.queryAllByRole("button", { name: /Remove/ })).toHaveLength(0)
  })
  // @lat: [[settings-account-tests#Settings Account Tests#Accessible team navigation and cancellation]]
  it("names team back navigation and invitation cancellation", async () => {
    state.data.invitations = [invitation]
    render(<TeamPage />)
    expect(screen.getByRole("link", { name: "Back to teams" })).toHaveAttribute("href", "/settings/teams")
    vi.mocked(cancelInvitationFn).mockResolvedValue({ success: true })
    fireEvent.click(screen.getByRole("button", { name: `Cancel invitation for ${invitation.email}` }))
    await waitFor(() => expect(cancelInvitationFn).toHaveBeenCalledWith({ data: { invitationId: "invite" } }))
  })
  // @lat: [[settings-account-tests#Settings Account Tests#Team name guidance]]
  it("describes display names and unique URLs accurately and names the create back link", () => {
    render(<CreatePage />)
    expect(screen.getByRole("link", { name: "Back to teams" })).toHaveAttribute("href", "/settings/teams")
    expect(screen.getByText(/Names can be shared/)).toBeInTheDocument()
    expect(screen.queryByText("A unique name for your team")).not.toBeInTheDocument()
  })
})
