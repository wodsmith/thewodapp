import { FakeDrizzleDb } from "@repo/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CROSSFIT_TRACK_ID } from "@/lib/crossfit/source"
import { addWorkoutToTrackFn, deleteProgrammingTrackFn, removeWorkoutFromTrackFn, updateProgrammingTrackFn, updateTrackVisibilityFn } from "@/server-fns/programming-fns"
import { appendCrossFitWorkout } from "@/server/append-crossfit-workout"
import { requireWorkoutTeamWrite } from "@/server/workout-import/access"
import { requireAdmin } from "@/utils/auth"

const db = new FakeDrizzleDb()
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("@/server/append-crossfit-workout", () => ({ appendCrossFitWorkout: vi.fn() }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: vi.fn(async () => ({ userId: "user" })), requireAdmin: vi.fn() }))
vi.mock("@/server/workout-import/access", () => ({ requireWorkoutTeamWrite: vi.fn(async () => undefined) }))
vi.mock("@/utils/team-auth", () => ({ requireTeamPermission: vi.fn() }))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ inputValidator: (parse: (data: unknown) => unknown) => ({ handler: (handler: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) => handler({ data: parse(ctx.data) }) }) }),
}))

beforeEach(() => {
  db.reset()
  db.setMockReturnValue([{ id: "link", trackId: CROSSFIT_TRACK_ID }])
  db.getChainMock().limit.mockResolvedValue([{ id: "link", trackId: CROSSFIT_TRACK_ID }] as never)
  vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin" } as never)
  vi.mocked(appendCrossFitWorkout).mockResolvedValue({ trackWorkout: { id: "appended" } } as never)
})

describe("CrossFit track mutation authorization", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Track mutation authorization]]
  it("rejects every CrossFit mutation for a non-admin before writing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin required"))
    const mutations = [
      () => addWorkoutToTrackFn({ data: { trackId: CROSSFIT_TRACK_ID, workoutId: "workout" } }),
      () => removeWorkoutFromTrackFn({ data: { trackWorkoutId: "link" } }),
      () => updateTrackVisibilityFn({ data: { trackId: CROSSFIT_TRACK_ID, isPublic: false } }),
      () => updateProgrammingTrackFn({ data: { trackId: CROSSFIT_TRACK_ID, name: "Changed" } }),
      () => deleteProgrammingTrackFn({ data: { trackId: CROSSFIT_TRACK_ID } }),
    ]
    for (const mutate of mutations) await expect(mutate()).rejects.toThrow("Admin required")
    expect(db.insert).not.toHaveBeenCalled()
    expect(db.update).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
    expect(appendCrossFitWorkout).not.toHaveBeenCalled()
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Automatic append contract]]
  it("requires automatic CrossFit ordering while retaining explicit ordering for other tracks", async () => {
    await addWorkoutToTrackFn({ data: { trackId: CROSSFIT_TRACK_ID, workoutId: "workout" } })
    expect(appendCrossFitWorkout).toHaveBeenCalledWith(db, "workout", undefined)
    await expect(async () => addWorkoutToTrackFn({ data: { trackId: CROSSFIT_TRACK_ID, workoutId: "workout", trackOrder: 4 } })).rejects.toThrow("assigned automatically")
    await expect(async () => addWorkoutToTrackFn({ data: { trackId: "other", workoutId: "workout" } as never })).rejects.toThrow()
    db.registerTable("programmingTracksTable")
    db.registerTable("workouts")
    vi.mocked(db.query.programmingTracksTable.findFirst).mockResolvedValue({ id: "other", ownerTeamId: "owner" } as never)
    vi.mocked(db.query.workouts.findFirst).mockResolvedValue({ id: "workout", teamId: "owner" } as never)
    vi.mocked(requireAdmin).mockClear()
    await addWorkoutToTrackFn({ data: { trackId: "other", workoutId: "workout", trackOrder: 4 } })
    expect(requireAdmin).not.toHaveBeenCalled()
    expect(requireWorkoutTeamWrite).toHaveBeenCalledWith("user", "owner", "manage_programming", db)
    expect(db.insert).toHaveBeenCalled()
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Administrator track edits]]
  it("allows the checked mutations for an administrator", async () => {
    await removeWorkoutFromTrackFn({ data: { trackWorkoutId: "link" } })
    await updateTrackVisibilityFn({ data: { trackId: CROSSFIT_TRACK_ID, isPublic: true } })
    await updateProgrammingTrackFn({ data: { trackId: CROSSFIT_TRACK_ID, name: "CrossFit.com" } })
    await deleteProgrammingTrackFn({ data: { trackId: CROSSFIT_TRACK_ID } })
    expect(requireAdmin).toHaveBeenCalledTimes(4)
    expect(db.update).toHaveBeenCalledTimes(2)
    expect(db.delete).toHaveBeenCalledTimes(2)
  })
})
