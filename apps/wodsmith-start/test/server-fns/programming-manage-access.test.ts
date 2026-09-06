import { beforeEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ select: vi.fn(), access: vi.fn(), session: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (handler: unknown) => handler }) }) }))
vi.mock("@/db", () => ({ getDb: () => ({ select: mock.select }) }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: mock.session }))
vi.mock("@/utils/team-auth", () => ({ requireTeamPermission: vi.fn() }))
vi.mock("@/server/workout-import/access", () => ({ requireWorkoutTeamWrite: mock.access, WorkoutImportAccessError: class extends Error {} }))
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { getProgrammingTrackByIdFn } from "@/server-fns/programming-fns"
import { WorkoutImportAccessError } from "@/server/workout-import/access"
beforeEach(() => {
  const chain = { from: () => chain, leftJoin: () => chain, where: () => chain, limit: async () => [{ id: "track", ownerTeamId: "owner-team" }] }
  mock.select.mockReturnValue(chain)
  mock.session.mockResolvedValue({ userId: "user", teams: [{ id: "subscriber-team", permissions: ["manage_programming"] }] })
  mock.access.mockResolvedValue(undefined)
})
// @lat: [[workout-import-ux-tests#Workout Import UX Tests#Track management capability]]
it("resolves management against the current track owner and preserves read access on permission denial", async () => {
  const input = { data: { trackId: "track" } }
  expect(await getProgrammingTrackByIdFn(input)).toMatchObject({ canManageWorkouts: true })
  expect(mock.access).toHaveBeenCalledWith("user", "owner-team", "manage_programming", expect.anything())
  mock.access.mockRejectedValueOnce(new WorkoutImportAccessError())
  expect(await getProgrammingTrackByIdFn(input)).toMatchObject({ track: { id: "track" }, canManageWorkouts: false })
  mock.access.mockRejectedValueOnce(new Error("Database unavailable"))
  await expect(getProgrammingTrackByIdFn(input)).rejects.toThrow("Database unavailable")
})

// @lat: [[workout-import-integration#Workout Import Integration#Managed source track integration]]
it("uses site administration for the managed CrossFit source track", async () => {
  const chain = { from: () => chain, leftJoin: () => chain, where: () => chain, limit: async () => [{ id: CROSSFIT_TRACK_ID, ownerTeamId: "crossfit-team" }] }
  mock.select.mockReturnValue(chain)
  mock.access.mockClear()
  mock.session.mockResolvedValue({ userId: "admin", user: { role: "admin" } })
  expect(await getProgrammingTrackByIdFn({ data: { trackId: CROSSFIT_TRACK_ID } })).toMatchObject({ canManageWorkouts: true })
  mock.session.mockResolvedValue({ userId: "user", user: { role: "user" } })
  expect(await getProgrammingTrackByIdFn({ data: { trackId: CROSSFIT_TRACK_ID } })).toMatchObject({ canManageWorkouts: false })
  expect(mock.access).not.toHaveBeenCalled()
})
