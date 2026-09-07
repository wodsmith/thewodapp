import { randomUUID } from "node:crypto"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { eq, getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Pool } from "mysql2"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import type { Database } from "@/db"
import {
  movements,
  tags,
  workoutTags,
  workoutMovements,
  workouts,
  teamTable,
  teamMembershipTable,
  teamRoleTable,
  userTable,
  programmingTracksTable,
  trackWorkoutsTable,
  teamProgrammingTracksTable,
  scalingGroupsTable,
  scheduledWorkoutInstancesTable,
  scoresTable,
  scalingLevelsTable,
} from "@/db/schema"
import { mysqlTestConfig } from "./mysql-test-config"
const fixture = vi.hoisted(() => ({
  db: undefined as Database | undefined,
  userId: "outsider" as string | undefined,
}))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () =>
    fixture.userId
      ? { userId: fixture.userId, user: { role: "user" }, teams: [] }
      : null,
  requireAdmin: async () => {
    throw new Error("Admin required")
  },
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: (parse: (value: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) =>
          fn({ data: parse(ctx.data) }),
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))
import { getWorkoutsByMovementIdFn } from "@/server-fns/movement-fns"
import {
  getWorkoutByIdFn,
  getWorkoutsFn,
  getWorkoutFilterOptionsFn,
  scheduleWorkoutFn,
  getScheduledWorkoutsFn,
  getScheduledWorkoutsWithResultsFn,
  getWorkoutScheduledInstancesFn,
  createWorkoutFn,
  updateWorkoutFn,
} from "@/server-fns/workout-fns"
import {
  getProgrammingTrackByIdFn,
  getTrackWorkoutsFn,
  getPublicTracksWithSubscriptionsFn,
  getTrackSubscribedTeamsFn,
  getTeamProgrammingTracksFn,
  createProgrammingTrackFn,
  updateProgrammingTrackFn,
  deleteProgrammingTrackFn,
  updateTrackVisibilityFn,
  addWorkoutToTrackFn,
  removeWorkoutFromTrackFn,
} from "@/server-fns/programming-fns"
import {
  createWorkoutRemixFn,
  getRemixedWorkoutsFn,
  getSourceWorkoutFn,
  getWorkoutRemixInfoFn,
  getRemixCountFn,
} from "@/server-fns/workout-remix-fns"
const tables = [
  movements,
  tags,
  workoutTags,
  workoutMovements,
  workouts,
  teamTable,
  teamMembershipTable,
  teamRoleTable,
  userTable,
  programmingTracksTable,
  trackWorkoutsTable,
  teamProgrammingTracksTable,
  scalingGroupsTable,
  scheduledWorkoutInstancesTable,
  scoresTable,
  scalingLevelsTable,
]
const databaseName = `training_access_${randomUUID().replaceAll("-", "")}`
const casing = new CasingCache("snake_case")
let admin: Pool
let pool: Pool
let db: Database
async function seed(
  table: (typeof tables)[number],
  values: Record<string, unknown>,
) {
  const columns = getTableColumns(table)
  const names = Object.keys(values).map(
    (key) =>
      `\`${casing.getColumnCasing(columns[key as keyof typeof columns])}\``,
  )
  await pool
    .promise()
    .query(
      `INSERT INTO \`${getTableName(table)}\` (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`,
      Object.values(values),
    )
}

describe.skipIf(!mysqlTestConfig)("training server access on MySQL", () => {
  beforeAll(async () => {
    if (!mysqlTestConfig)
      throw new Error("Explicit local MySQL configuration required")
    admin = mysql.createPool(mysqlTestConfig)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({
      ...mysqlTestConfig,
      database: databaseName,
      connectionLimit: 5,
    })
    db = createWodsmithDb(pool)
    fixture.db = db
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column) => {
        const defaultSql = ["string", "number", "boolean"].includes(
          typeof column.default,
        )
          ? ` DEFAULT ${mysql.escape(column.default)}`
          : ""
        return `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : "NULL"}${defaultSql}`
      })
      await pool
        .promise()
        .query(
          `CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`,
        )
    }
  }, 20000)
  afterAll(async () => {
    if (pool) await pool.promise().end()
    if (admin) {
      await admin.promise().query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await admin.promise().end()
    }
  })
  beforeEach(async () => {
    fixture.userId = "outsider"
    for (const table of tables)
      await pool.promise().query(`DELETE FROM \`${getTableName(table)}\``)
    for (const id of ["outsider", "owner", "member", "expired", "inactive"])
      await seed(userTable, { id })
    for (const id of ["a", "b"]) await seed(teamTable, { id, name: id })
    for (const [userId, teamId, roleId, isActive, expiresAt] of [
      ["owner", "a", "owner", true, null],
      ["outsider", "b", "owner", true, null],
      ["member", "a", "member", true, null],
      ["expired", "a", "owner", true, new Date(0)],
      ["inactive", "a", "owner", false, null],
    ] as const)
      await seed(teamMembershipTable, {
        id: userId,
        userId,
        teamId,
        roleId,
        isSystemRole: true,
        isActive,
        expiresAt,
      })
    for (const [id, scope, teamId, sourceWorkoutId] of [
      ["private", "private", "a", null],
      ["public", "public", "a", null],
      ["mine", "private", "b", null],
      ["secret-remix", "private", "a", "public"],
      ["public-remix", "public", "b", "private"],
    ])
      await seed(workouts, {
        id,
        scope,
        teamId,
        sourceWorkoutId,
        name: id,
        description: "10 burpees",
        scheme: "reps",
        roundsToScore: 1,
      })
    await seed(movements, { id: "movement", name: "Burpee", type: "gymnastic" })
    for (const id of ["private", "public", "mine"])
      await seed(workoutMovements, {
        id,
        workoutId: id,
        movementId: "movement",
      })
    for (const [id, isPublic] of [
      ["private-track", 0],
      ["public-track", 1],
    ] as const) {
      await seed(programmingTracksTable, {
        id,
        isPublic,
        ownerTeamId: "a",
        name: id,
        type: "team_owned",
      })
      await seed(teamProgrammingTracksTable, {
        teamId: "a",
        trackId: id,
        isActive: 1,
      })
      for (const workoutId of ["private", "public"])
        await seed(trackWorkoutsTable, {
          id: `${id}-${workoutId}`,
          trackId: id,
          workoutId,
          trackOrder: 1,
        })
    }
  })
  // @lat: [[training-access-tests#Training Access Tests#Movement visibility]]
  it("lists public and current member workouts without leaking other teams through movements", async () => {
    expect(
      (
        await getWorkoutsByMovementIdFn({ data: { movementId: "movement" } })
      ).workouts
        .map((w) => w.id)
        .sort(),
    ).toEqual(["mine", "public"])
    fixture.userId = "expired"
    expect(
      (
        await getWorkoutsByMovementIdFn({ data: { movementId: "movement" } })
      ).workouts.map((w) => w.id),
    ).toEqual(["public"])
    fixture.userId = "owner"
    expect(
      (
        await getWorkoutsByMovementIdFn({ data: { movementId: "movement" } })
      ).workouts
        .map((w) => w.id)
        .sort(),
    ).toEqual(["private", "public"])
  })
  // @lat: [[training-access-tests#Training Access Tests#Known workout reads]]
  it.each([undefined, "outsider", "expired", "inactive"])(
    "hides known private workouts from %s and preserves public reads",
    async (userId) => {
      fixture.userId = userId
      expect(await getWorkoutByIdFn({ data: { id: "private" } })).toMatchObject(
        { workout: null },
      )
      expect(await getWorkoutByIdFn({ data: { id: "public" } })).toMatchObject({
        workout: { id: "public" },
      })
    },
  )
  it("allows private reads across active team selection and rejects spoofed list team IDs", async () => {
    fixture.userId = "member"
    expect(await getWorkoutByIdFn({ data: { id: "private" } })).toMatchObject({
      workout: { id: "private" },
    })
    fixture.userId = "outsider"
    await expect(getWorkoutsFn({ data: { teamId: "a" } })).rejects.toThrow()
    expect((await getWorkoutsFn({ data: { teamId: "b" } })).workouts.map(workout => workout.id).sort()).toEqual(["mine", "public", "public-remix"])
  })
  // @lat: [[training-access-tests#Training Access Tests#Track reads]]
  it("protects private track detail, contents and team lists while filtering private children of public tracks", async () => {
    await expect(
      getProgrammingTrackByIdFn({ data: { trackId: "private-track" } }),
    ).rejects.toThrow()
    await expect(
      getTrackWorkoutsFn({ data: { trackId: "private-track" } }),
    ).rejects.toThrow()
    await expect(
      getTeamProgrammingTracksFn({ data: { teamId: "a" } }),
    ).rejects.toThrow()
    expect(
      (
        await getTrackWorkoutsFn({ data: { trackId: "public-track" } })
      ).workouts.map((w) => w.workout.id),
    ).toEqual(["public"])
    expect(
      await getProgrammingTrackByIdFn({ data: { trackId: "public-track" } }),
    ).toMatchObject({ track: { id: "public-track" }, canManageWorkouts: false })
    fixture.userId = "member"
    expect(
      (await getTrackWorkoutsFn({ data: { trackId: "private-track" } }))
        .workouts,
    ).toHaveLength(2)
  })
  const mutations = [
    () =>
      createProgrammingTrackFn({
        data: { ownerTeamId: "a", name: "New", type: "team_owned" },
      }),
    () =>
      updateProgrammingTrackFn({
        data: { trackId: "public-track", name: "Changed" },
      }),
    () => deleteProgrammingTrackFn({ data: { trackId: "private-track" } }),
    () =>
      updateTrackVisibilityFn({
        data: { trackId: "private-track", isPublic: true },
      }),
    () =>
      addWorkoutToTrackFn({
        data: { trackId: "private-track", workoutId: "public", trackOrder: 2 },
      }),
    () =>
      removeWorkoutFromTrackFn({
        data: { trackWorkoutId: "private-track-private" },
      }),
  ]
  // @lat: [[training-access-tests#Training Access Tests#Track writes]]
  it.each(
    ["outsider", "member", "expired", "inactive"].flatMap((userId) =>
      mutations.map((mutate, operation) => ({ userId, mutate, operation })),
    ),
  )(
    "rejects track operation $operation by $userId before modifying rows",
    async ({ userId, mutate }) => {
      fixture.userId = userId
      await expect(mutate()).rejects.toThrow()
      expect(await db.select().from(programmingTracksTable)).toHaveLength(2)
      expect(await db.select().from(trackWorkoutsTable)).toHaveLength(4)
    },
  )
  it("allows owner track CRUD and membership changes and rejects foreign private workouts", async () => {
    fixture.userId = "owner"
    await expect(
      addWorkoutToTrackFn({
        data: { trackId: "private-track", workoutId: "mine", trackOrder: 2 },
      }),
    ).rejects.toThrow()
    for (const mutate of [
      mutations[0],
      mutations[1],
      mutations[3],
      mutations[4],
      mutations[5],
      mutations[2],
    ])
      await expect(mutate()).resolves.toBeTruthy()
  })
  const edit = {
    id: "public",
    name: "Edited",
    description: "20 burpees",
    scheme: "reps" as const,
    scope: "public" as const,
  }
  // @lat: [[training-access-tests#Training Access Tests#Workout writes]]
  it("preserves create and edit authorization against persisted owner teams", async () => {
    await expect(updateWorkoutFn({ data: edit })).rejects.toThrow()
    await expect(
      createWorkoutFn({ data: { ...edit, teamId: "a" } }),
    ).rejects.toThrow()
    fixture.userId = "member"
    await expect(updateWorkoutFn({ data: edit })).rejects.toThrow()
    fixture.userId = "owner"
    expect(await updateWorkoutFn({ data: edit })).toMatchObject({
      workout: { name: "Edited", teamId: "a" },
    })
    expect(
      await createWorkoutFn({
        data: { ...edit, teamId: "a", sourceWorkoutId: "public" },
      }),
    ).toMatchObject({ workout: { teamId: "a", sourceWorkoutId: "public" } })
    await expect(
      createWorkoutFn({
        data: { ...edit, teamId: "a", sourceWorkoutId: "mine" },
      }),
    ).rejects.toThrow()
    expect(() =>
      createWorkoutFn({ data: { ...edit, teamId: "a", name: "" } }),
    ).toThrow()
  })
  // @lat: [[training-access-tests#Training Access Tests#Remix boundaries]]
  it("hides private remix lineage and counts and preserves public template copying", async () => {
    expect(
      await getSourceWorkoutFn({ data: { workoutId: "public-remix" } }),
    ).toEqual({ sourceWorkout: null })
    expect(
      await getWorkoutRemixInfoFn({ data: { workoutId: "public-remix" } }),
    ).toMatchObject({ sourceWorkout: null })
    expect(await getRemixCountFn({ data: { workoutId: "public" } })).toEqual({
      count: 0,
    })
    expect(
      await getRemixedWorkoutsFn({ data: { sourceWorkoutId: "public" } }),
    ).toEqual({ remixes: [] })
    await expect(
      createWorkoutRemixFn({
        data: { sourceWorkoutId: "private", teamId: "b" },
      }),
    ).rejects.toThrow()
    expect(
      await createWorkoutRemixFn({
        data: { sourceWorkoutId: "public", teamId: "b" },
      }),
    ).toMatchObject({
      workout: { teamId: "b", sourceWorkoutId: "public", scope: "private" },
    })
    fixture.userId = "member"
    await expect(
      createWorkoutRemixFn({
        data: { sourceWorkoutId: "public", teamId: "a" },
      }),
    ).rejects.toThrow()
    fixture.userId = "expired"
    await expect(
      createWorkoutRemixFn({
        data: { sourceWorkoutId: "public", teamId: "a" },
      }),
    ).rejects.toThrow()
  })
  // @lat: [[training-access-tests#Training Access Tests#Indirect reads]]
  it("guards filter options, schedule IDs and subscription team IDs", async () => {
    await expect(
      getWorkoutFilterOptionsFn({ data: { teamId: "a" } }),
    ).rejects.toThrow()
    await expect(
      getWorkoutScheduledInstancesFn({
        data: { teamId: "a", workoutId: "private" },
      }),
    ).rejects.toThrow()
    await expect(
      getPublicTracksWithSubscriptionsFn({ data: { userTeamIds: ["a"] } }),
    ).rejects.toThrow()
    await expect(
      getTrackSubscribedTeamsFn({
        data: { trackId: "public-track", userTeamIds: ["a"] },
      }),
    ).rejects.toThrow()
    expect(
      await getPublicTracksWithSubscriptionsFn({
        data: { userTeamIds: ["b"] },
      }),
    ).toMatchObject({ tracks: expect.any(Array) })
    const dates = { startDate: "2026-01-01", endDate: "2026-12-31" }
    await expect(
      getScheduledWorkoutsFn({ data: { teamId: "a", ...dates } }),
    ).rejects.toThrow()
    await expect(
      getScheduledWorkoutsWithResultsFn({
        data: { teamId: "a", userId: "owner", ...dates },
      }),
    ).rejects.toThrow()
    await seed(scheduledWorkoutInstancesTable, {
      id: "legacy",
      teamId: "b",
      workoutId: "private",
      scheduledDate: new Date("2026-09-01"),
    })
    expect(
      (await getScheduledWorkoutsFn({ data: { teamId: "b", ...dates } }))
        .scheduledWorkouts[0].workout,
    ).toBeNull()
    expect(
      (
        await getScheduledWorkoutsWithResultsFn({
          data: { teamId: "b", userId: "outsider", ...dates },
        })
      ).scheduledWorkoutsWithResults[0].workout,
    ).toBeNull()
    await expect(
      scheduleWorkoutFn({
        data: {
          teamId: "b",
          workoutId: "private",
          scheduledDate: "2026-09-01",
        },
      }),
    ).rejects.toThrow()
    expect(
      await scheduleWorkoutFn({
        data: { teamId: "b", workoutId: "public", scheduledDate: "2026-09-01" },
      }),
    ).toMatchObject({ success: true })
  })
  // @lat: [[training-access-tests#Training Access Tests#Custom permissions]]
  it("uses current custom-role permissions and verifies the role belongs to the owner team", async () => {
    fixture.userId = "member"
    await seed(teamRoleTable, {
      id: "programmer",
      teamId: "a",
      name: "Programmer",
      permissions: JSON.stringify([
        "manage_programming",
        "create_components",
        "edit_components",
      ]),
    })
    await db
      .update(teamMembershipTable)
      .set({ isSystemRole: false, roleId: "programmer" })
      .where(eq(teamMembershipTable.id, "member"))
    expect(
      await updateProgrammingTrackFn({
        data: { trackId: "private-track", name: "Allowed" },
      }),
    ).toMatchObject({ track: { name: "Allowed" } })
    expect(await updateWorkoutFn({ data: edit })).toMatchObject({
      workout: { name: "Edited" },
    })
    expect(
      await createWorkoutRemixFn({
        data: { teamId: "a", sourceWorkoutId: "public" },
      }),
    ).toMatchObject({ workout: { teamId: "a" } })
    await db
      .update(teamRoleTable)
      .set({ teamId: "b" })
      .where(eq(teamRoleTable.id, "programmer"))
    await expect(
      updateProgrammingTrackFn({
        data: { trackId: "private-track", name: "Denied" },
      }),
    ).rejects.toThrow()
    await expect(updateWorkoutFn({ data: edit })).rejects.toThrow()
  })
  it("does not grant track management through a subscription or public visibility", async () => {
    await seed(teamProgrammingTracksTable, {
      teamId: "b",
      trackId: "private-track",
      isActive: 1,
    })
    await expect(
      getProgrammingTrackByIdFn({ data: { trackId: "private-track" } }),
    ).rejects.toThrow()
    expect(
      (await getTeamProgrammingTracksFn({ data: { teamId: "b" } })).tracks,
    ).toEqual([])
    fixture.userId = undefined
    expect(
      await getProgrammingTrackByIdFn({ data: { trackId: "public-track" } }),
    ).toMatchObject({ track: { id: "public-track" }, canManageWorkouts: false })
    expect(
      (
        await getTrackWorkoutsFn({ data: { trackId: "public-track" } })
      ).workouts.map((w) => w.workout.id),
    ).toEqual(["public"])
    for (const mutate of mutations) await expect(mutate()).rejects.toThrow()
  })
})
