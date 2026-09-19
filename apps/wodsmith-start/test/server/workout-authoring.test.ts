import { beforeEach, describe, expect, it, vi } from "vitest"
import { getWorkoutAuthoringCatalog } from "@/server/workout-authoring"
import { validateEventAuthoring } from "@/server/workout-authoring-scaling"
import { validateWorkoutReferences, insertWorkoutWithMovements } from "@/server/workout-import/persistence"
import type { WorkoutImportDatabase } from "@/server/workout-import/access"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import { scalingLevelsTable, workoutScalingDescriptionsTable } from "@/db/schema"

const mocks = vi.hoisted(() => ({ session: vi.fn(), teamPermission: vi.fn(), cohost: vi.fn(), training: vi.fn(), library: vi.fn(), competition: vi.fn(), series: vi.fn(), team: vi.fn(), group: vi.fn(), select: vi.fn() }))
vi.mock("@/db", () => ({ getDb: () => ({ query: { competitionsTable: { findFirst: mocks.competition }, competitionGroupsTable: { findFirst: mocks.series }, teamTable: { findFirst: mocks.team }, scalingGroupsTable: { findFirst: mocks.group } }, select: mocks.select }) }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: mocks.session }))
vi.mock("@/utils/team-auth", () => ({ requireTeamPermission: mocks.teamPermission }))
vi.mock("@/utils/cohost-auth", () => ({ requireCohostPermission: mocks.cohost }))
vi.mock("@/server/training", () => ({ requireTrainingAccess: mocks.training }))
vi.mock("@/server/workout-import/access", () => ({ requireWorkoutTeamWrite: mocks.library }))
vi.mock("@/server/workout-import/sessions", () => ({ authorizeWorkoutImportSession: vi.fn(), loadWorkoutImportSessionForUpdate: vi.fn() }))

beforeEach(() => {
  mocks.session.mockResolvedValue({ userId: "user" })
  mocks.teamPermission.mockResolvedValue(undefined)
  mocks.cohost.mockResolvedValue(undefined)
  mocks.training.mockResolvedValue(undefined)
  mocks.library.mockResolvedValue(undefined)
  mocks.group.mockResolvedValue({ id: "group" })
  mocks.team.mockResolvedValue({ defaultScalingGroupId: "group" })
  mocks.competition.mockResolvedValue({ organizingTeamId: "organizer", competitionTeamId: "cohost", settings: JSON.stringify({ divisions: { scalingGroupId: "group" } }) })
  mocks.series.mockResolvedValue({ organizingTeamId: "organizer", settings: JSON.stringify({ scalingGroupId: "group" }) })
  mocks.select.mockImplementation(() => ({ from: (table: unknown) => table === scalingLevelsTable
    ? { where: () => ({ orderBy: async () => [{ id: "rx", label: "Rx" }] }) }
    : Promise.resolve([{ id: "thruster", name: "Thruster", type: "weightlifting" }]) }))
})

describe("workout authoring destination context", () => {
  // @lat: [[workout-authoring#Workout Authoring#Authoring access and scaling isolation]]
  it("requires destination access before loading model catalogs", async () => {
    mocks.library.mockRejectedValue(new Error("Forbidden"))
    await expect(getWorkoutAuthoringCatalog({ kind: "library", teamId: "foreign" })).rejects.toThrow("Forbidden")
    expect(mocks.select).not.toHaveBeenCalled()
    expect(mocks.team).not.toHaveBeenCalled()
    mocks.session.mockResolvedValue(null)
    await expect(getWorkoutAuthoringCatalog({ kind: "competition", competitionId: "comp" })).rejects.toThrow("Not authenticated")
  })
  it.each(["library", "personal", "programming"] as const)("uses the team's stored default for %s", async (kind) => {
    expect(await getWorkoutAuthoringCatalog({ kind, teamId: "gym" })).toMatchObject({ scalingGroupId: "group", levels: [{ id: "rx", label: "Rx" }] })
    if (kind === "library") expect(mocks.library).toHaveBeenCalledWith("user", "gym", expect.any(String))
    else expect(mocks.training).toHaveBeenCalledWith("gym", undefined, kind === "programming")
  })
  it("uses the competition's stored cohost team and its divisions", async () => {
    mocks.teamPermission.mockRejectedValue(new Error("Not organizer"))
    expect(await getWorkoutAuthoringCatalog({ kind: "competition", competitionId: "comp" })).toMatchObject({ scalingGroupId: "group", levels: [{ id: "rx", label: "Rx" }] })
    expect(mocks.cohost).toHaveBeenCalledWith("cohost", "editEvents")
    expect(mocks.team).not.toHaveBeenCalled()
  })
  it("rejects a stale or foreign default and uses series-specific scaling", async () => {
    expect(await getWorkoutAuthoringCatalog({ kind: "series", groupId: "series" })).toMatchObject({ scalingGroupId: "group" })
    mocks.group.mockResolvedValue(null)
    await expect(getWorkoutAuthoringCatalog({ kind: "personal", teamId: "gym" })).rejects.toThrow(/unavailable/)
  })
})

describe("scaling prescription persistence", () => {
  const definition: NormalizedWorkoutSave = { name: "Fran", description: "Thrusters for time", scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 600, roundsToScore: 1, repsPerRound: null, tiebreakScheme: null, movementIds: [], scalingGroupId: "group", scalingDescriptions: [{ scalingLevelId: "rx", description: "95 lb thrusters" }], scope: "private" }
  it("rejects levels outside the selected group and changed competition divisions", async () => {
    const db = { query: { scalingGroupsTable: { findFirst: vi.fn().mockResolvedValue({ id: "group" }) } }, select: () => ({ from: () => ({ where: async () => [] }) }) } as unknown as WorkoutImportDatabase
    await expect(validateWorkoutReferences(db, definition, "gym")).rejects.toThrow(/selected group/)
    await expect(validateWorkoutReferences(db, { ...definition, scalingGroupId: null }, "gym")).rejects.toThrow(/require a scaling group/)
    await expect(validateEventAuthoring(db, { scalingGroupId: "old" }, "gym", "new")).rejects.toThrow(/divisions changed/)
  })
  it("writes scaling rows under the created workout and preserves cap seconds", async () => {
    const writes: { table: unknown; value: unknown }[] = []
    const db = { insert: (table: unknown) => ({ values: async (value: unknown) => { writes.push({ table, value }) } }) } as unknown as WorkoutImportDatabase
    const workoutId = await insertWorkoutWithMovements(db, definition, "gym")
    expect(writes[0].value).toMatchObject({ id: workoutId, teamId: "gym", timeCap: 600, scalingGroupId: "group" })
    expect(writes[0].value).not.toHaveProperty("scalingDescriptions")
    expect(writes.find((write) => write.table === workoutScalingDescriptionsTable)?.value).toEqual([{ workoutId, scalingLevelId: "rx", description: "95 lb thrusters" }])
  })
})
