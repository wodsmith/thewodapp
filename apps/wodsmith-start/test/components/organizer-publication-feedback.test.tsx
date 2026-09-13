import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HeatSchedulePublishingCard } from "@/components/organizer/heat-schedule-publishing-card"
import { Route } from "@/routes/compete/organizer/$competitionId/co-hosts"
const mocks = vi.hoisted(() => ({ statuses: vi.fn(), success: vi.fn(), error: vi.fn(), write: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useLoaderData: () => ({ competition: { id: "comp", organizingTeamId: "team" }, competitionTeamId: "event-team", cohosts: [], pendingCohostInvitations: [{ id: "invite", email: "guest@example.com", token: "test-token", metadata: null }], hasCouponsEntitlement: false }) }),
  useRouter: () => ({ invalidate: vi.fn() }), redirect: vi.fn(), Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))
vi.mock("@/server-fns/cohost-fns", () => ({ getCohostsFn: vi.fn() }))
vi.mock("@/server-fns/entitlements", () => ({ checkTeamHasFeatureFn: vi.fn() }))
vi.mock("@/routes/compete/organizer/$competitionId/-components/edit-cohost-permissions-dialog", () => ({ EditCohostPermissionsDialog: () => null }))
vi.mock("@/routes/compete/organizer/$competitionId/-components/invite-cohost-dialog", () => ({ InviteCohostDialog: () => null }))
vi.mock("@/server-fns/competition-heats-fns", () => ({ getHeatPublishStatusFn: mocks.statuses, publishAllHeatsForEventFn: vi.fn(), publishHeatScheduleFn: vi.fn() }))
beforeEach(() => {
  mocks.statuses.mockResolvedValue({ statuses: [{ heatId: "heat", heatNumber: 1, scheduledTime: new Date("2026-07-01T16:00:00Z"), isPublished: false }] })
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: mocks.write } })
})
describe("organizer publication feedback", () => {
  // @lat: [[organizer-recovery#Competition heat times]]
  it.each([["America/Los_Angeles", "9:00 AM PDT"], ["America/New_York", "12:00 PM EDT"]])("uses %s competition time in the publishing card", async (timezone, time) => {
    render(<HeatSchedulePublishingCard competitionId="comp" organizingTeamId="team" trackWorkoutId="event" eventName="Fran" timezone={timezone} />)
    expect(await screen.findByText(time)).toBeInTheDocument()
  })
  // @lat: [[organizer-recovery#Clipboard recovery]]
  it("reports clipboard rejection and lets the organizer retry the same link", async () => {
    mocks.write.mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(undefined)
    const Component = Route.options.component as React.ComponentType
    render(<Component />)
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Could not copy the invite link", expect.any(Object)))
    expect(mocks.success).not.toHaveBeenCalled()
    mocks.error.mock.calls[0][1].action.onClick()
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Invite link copied"))
    expect(mocks.write).toHaveBeenCalledTimes(2)
    expect(mocks.write.mock.calls[0]).toEqual(mocks.write.mock.calls[1])
    expect(mocks.write.mock.calls[0][0]).toContain("/compete/cohost-invite/test-token")
  })
})
