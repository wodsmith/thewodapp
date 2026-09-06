import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { eq, getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Pool, type RowDataPacket } from "mysql2"
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
import { FEATURES } from "@/config/features"
import {
  featureTable,
  planFeatureTable,
  teamEntitlementOverrideTable,
  teamFeatureEntitlementTable,
  teamTable,
  teamMembershipTable,
  teamRoleTable,
  userTable,
  programmingTracksTable,
  workouts,
  workoutMovements,
  movements,
  scalingGroupsTable,
  trackWorkoutsTable,
  workoutImportSessionsTable,
  workoutImportReceiptsTable,
} from "@/db/schema"
import {
  type WorkoutImportSaveInput,
  type WorkoutImportProposal,
} from "@/lib/workout-import"
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({ db: undefined as Database | undefined }))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/kv-session", () => ({
  invalidateTeamMembersSessions: vi.fn(),
}))
vi.mock("@/utils/email", () => ({
  sendOrganizerApprovalEmail: vi.fn(),
  sendOrganizerRejectionEmail: vi.fn(),
}))
vi.mock("@/lib/logging/posthog-otel-logger", () => ({ logInfo: vi.fn() }))
import {
  grantTeamFeature,
  revokeTeamFeature,
} from "@/server/organizer-onboarding"
import { requireWorkoutImportAccess } from "@/server/workout-import/access"
import {
  createWorkoutImportSession,
  publishWorkoutImportRevision,
  requireWorkoutImportSession,
  cleanupWorkoutImportSession,
} from "@/server/workout-import/sessions"
import { saveWorkoutImport } from "@/server/workout-import/persistence"
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({ userId: "athlete" }),
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parse: (data: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) =>
          fn({ data: parse(ctx.data) }),
    }),
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))
import { createWorkoutFn } from "@/server-fns/workout-fns"
import { addWorkoutToTrackFn } from "@/server-fns/programming-fns"
import {
  getWorkoutImportAccessFn,
  saveWorkoutImportFn,
} from "@/server-fns/workout-import-fns"

const tables = [
  featureTable,
  planFeatureTable,
  teamEntitlementOverrideTable,
  teamFeatureEntitlementTable,
  teamTable,
  teamMembershipTable,
  teamRoleTable,
  userTable,
  programmingTracksTable,
  workouts,
  workoutMovements,
  movements,
  scalingGroupsTable,
  trackWorkoutsTable,
  workoutImportSessionsTable,
  workoutImportReceiptsTable,
]
const writtenTables = [
  workouts,
  workoutMovements,
  trackWorkoutsTable,
  workoutImportReceiptsTable,
]
const casing = new CasingCache("snake_case")
const databaseName = `workout_import_test_${randomUUID().replaceAll("-", "")}`
let admin: Pool
let pool: Pool
let db: Database
const workout: WorkoutImportSaveInput["workout"] = {
  name: "Three rounds",
  description: "3 rounds for time: 10 pull-ups; cap 15 min; 95/65 lb",
  scheme: "time-with-cap",
  scoreType: "min",
  scope: "private",
  timeCapSeconds: 900,
  roundsToScore: 1,
  repsPerRound: 10,
  tiebreakScheme: "reps",
  scalingGroupId: "scaling",
  movementIds: ["pull-up"],
}
const { scope: _scope, ...proposalWorkout } = workout
const proposal: WorkoutImportProposal = {
  workout: proposalWorkout,
  extractedText: workout.description,
  unresolved: [],
  warnings: [],
}
async function seed(
  table: (typeof tables)[number],
  values: Record<string, unknown>,
) {
  const columns = getTableColumns(table)
  const names = Object.keys(values).map(
    (k) => `\`${casing.getColumnCasing(columns[k as keyof typeof columns])}\``,
  )
  await pool
    .promise()
    .query(
      `INSERT INTO \`${getTableName(table)}\` (${names.join(",")}) VALUES (${names.map(() => "?").join(",")})`,
      Object.values(values),
    )
}
async function rowCounts() {
  return Promise.all(
    writtenTables.map(async (table) => {
      const [r] = await pool
        .promise()
        .query<RowDataPacket[]>(
          `SELECT COUNT(*) n FROM \`${getTableName(table)}\``,
        )
      return r[0].n
    }),
  )
}
async function draft(kind: "personal" | "track" = "personal", p = proposal) {
  const session = await createWorkoutImportSession(
    {
      userId: "athlete",
      destination: kind === "track" ? { kind, trackId: "track" } : { kind },
    },
    db,
  )
  await publishWorkoutImportRevision(
    {
      userId: "athlete",
      importId: session.importId,
      expectedRevision: 0,
      proposal: p,
      source: { text: p.extractedText },
      requestId: "run-1",
      changedFields: [],
    },
    db,
  )
  return {
    importId: session.importId,
    revision: 1,
    idempotencyKey: "save-1",
    workout,
    resolutions: [],
    ...(kind === "track"
      ? { track: { trackOrder: 2.5, notes: "Review notes" } }
      : {}),
  } satisfies WorkoutImportSaveInput
}

describe.skipIf(!mysqlTestConfig)("workout import on MySQL", () => {
  beforeAll(async () => {
    admin = mysql.createPool(mysqlTestConfig!)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({
      ...mysqlTestConfig,
      database: databaseName,
      connectionLimit: 8,
    })
    db = createWodsmithDb(pool)
    fixture.db = db
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((c) => {
        const defaultSql = ["string", "number", "boolean"].includes(
          typeof c.default,
        )
          ? ` DEFAULT ${mysql.escape(c.default)}`
          : ""
        return `\`${casing.getColumnCasing(c)}\` ${c.getSQLType()} ${c.primary ? "PRIMARY KEY" : "NULL"}${defaultSql}`
      })
      await pool
        .promise()
        .query(
          `CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`,
        )
    }
    await pool
      .promise()
      .query(
        "CREATE UNIQUE INDEX team_feature_unique ON team_feature_entitlements (team_id,feature_id)",
      )
  }, 20000)
  afterAll(async () => {
    if (pool) await pool.promise().end()
    if (admin) {
      await admin.promise().query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await admin.promise().end()
    }
  })
  beforeEach(async () => {
    for (const t of tables)
      await pool.promise().query(`DELETE FROM \`${getTableName(t)}\``)
    await seed(userTable, { id: "athlete", role: "admin" })
    await seed(teamTable, {
      id: "personal",
      name: "Personal",
      isPersonalTeam: true,
      personalTeamOwnerId: "athlete",
      currentPlanId: "free",
    })
    await seed(teamTable, {
      id: "gym",
      name: "Gym",
      isPersonalTeam: false,
      currentPlanId: "free",
    })
    for (const teamId of ["personal", "gym"]) {
      await seed(teamMembershipTable, {
        id: `member-${teamId}`,
        teamId,
        userId: "athlete",
        roleId: "owner",
        isSystemRole: true,
        isActive: true,
      })
    }
    for (const key of [FEATURES.WORKOUT_TRACKING, FEATURES.AI_WORKOUT_IMPORT])
      await seed(featureTable, {
        id: `feat_${key}`,
        key,
        name: key,
        isActive: 1,
      })
    for (const teamId of ["personal", "gym"])
      await grantTeamFeature(teamId, FEATURES.WORKOUT_TRACKING)
    await seed(programmingTracksTable, {
      id: "track",
      ownerTeamId: "gym",
      name: "Strength",
    })
    await seed(movements, { id: "pull-up", name: "Pull-up", type: "gymnastic" })
    await seed(scalingGroupsTable, {
      id: "scaling",
      title: "Rx",
      teamId: null,
      isSystem: true,
    })
  })
  // @lat: [[workout-import#Workout Import#Grant and revocation tests]]
  it("denies by default even for platform admins, wrong-team grants, and revoked/expired grants; existing admin regrant restores", async () => {
    const input = {
      userId: "athlete",
      destination: { kind: "personal" as const },
    }
    await expect(requireWorkoutImportAccess(input, db)).rejects.toThrow(
      "access required",
    )
    await grantTeamFeature("gym", FEATURES.AI_WORKOUT_IMPORT)
    await expect(requireWorkoutImportAccess(input, db)).rejects.toThrow(
      "access required",
    )
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    expect((await requireWorkoutImportAccess(input, db)).teamId).toBe(
      "personal",
    )
    await revokeTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    await expect(requireWorkoutImportAccess(input, db)).rejects.toThrow(
      "access required",
    )
    await db
      .update(teamFeatureEntitlementTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(teamFeatureEntitlementTable.teamId, "personal"))
    await grantTeamFeature("personal", FEATURES.WORKOUT_TRACKING)
    await db
      .update(teamFeatureEntitlementTable)
      .set({ expiresAt: null })
      .where(
        eq(
          teamFeatureEntitlementTable.featureId,
          `feat_${FEATURES.WORKOUT_TRACKING}`,
        ),
      )
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    expect((await requireWorkoutImportAccess(input, db)).teamId).toBe(
      "personal",
    )
    await db
      .update(teamFeatureEntitlementTable)
      .set({ expiresAt: new Date(0) })
      .where(
        eq(
          teamFeatureEntitlementTable.featureId,
          `feat_${FEATURES.AI_WORKOUT_IMPORT}`,
        ),
      )
    await expect(requireWorkoutImportAccess(input, db)).rejects.toThrow(
      "access required",
    )
  })
  // @lat: [[workout-import#Workout Import#Atomic persistence tests]]
  it("roundtrips every scoring field and track metadata, with one row set for concurrent and differently keyed retries", async () => {
    await grantTeamFeature("gym", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft("track")
    const [a, b] = await Promise.all([
      saveWorkoutImport({ userId: "athlete", input }, db),
      saveWorkoutImport(
        {
          userId: "athlete",
          input: { ...input, idempotencyKey: "another-key" },
        },
        db,
      ),
    ])
    expect(a).toEqual(b)
    expect(await rowCounts()).toEqual([1, 1, 1, 1])
    const saved = await db.query.workouts.findFirst({
      where: eq(workouts.id, a.workoutId),
    })
    expect(saved).toMatchObject({
      name: workout.name,
      description: workout.description,
      teamId: "gym",
      scope: "private",
      timeCap: 900,
      roundsToScore: 1,
      scoreType: "min",
      repsPerRound: 10,
      tiebreakScheme: "reps",
      scalingGroupId: "scaling",
    })
    const link = await db.query.trackWorkoutsTable.findFirst({
      where: eq(trackWorkoutsTable.id, a.trackWorkoutId!),
    })
    expect(Number(link?.trackOrder)).toBe(2.5)
    expect(link?.notes).toBe("Review notes")
    expect(
      (
        await requireWorkoutImportSession(
          { userId: "athlete", importId: input.importId },
          db,
        )
      ).draft,
    ).toBeNull()
    await expect(
      saveWorkoutImport(
        {
          userId: "athlete",
          input: { ...input, workout: { ...workout, name: "Changed" } },
        },
        db,
      ),
    ).rejects.toThrow("different content")
  })
  it.each(["revoked", "expired", "membership", "tracking"])(
    "denies %s edited saves with zero workout, movement, track, receipt writes",
    async (reason) => {
      await grantTeamFeature("gym", FEATURES.AI_WORKOUT_IMPORT)
      const input = await draft("track")
      if (reason === "revoked")
        await revokeTeamFeature("gym", FEATURES.AI_WORKOUT_IMPORT)
      if (reason === "expired")
        await db
          .update(teamFeatureEntitlementTable)
          .set({ expiresAt: new Date(0) })
          .where(
            eq(
              teamFeatureEntitlementTable.featureId,
              `feat_${FEATURES.AI_WORKOUT_IMPORT}`,
            ),
          )
      if (reason === "membership")
        await db
          .update(teamMembershipTable)
          .set({ isActive: false })
          .where(eq(teamMembershipTable.teamId, "gym"))
      if (reason === "tracking")
        await revokeTeamFeature("gym", FEATURES.WORKOUT_TRACKING)
      await expect(
        saveWorkoutImport(
          {
            userId: "athlete",
            input: { ...input, workout: { ...workout, name: "Edited" } },
          },
          db,
        ),
      ).rejects.toThrow("access required")
      expect(await rowCounts()).toEqual([0, 0, 0, 0])
    },
  )
  it("rechecks access before returning an existing receipt", async () => {
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft()
    await saveWorkoutImport({ userId: "athlete", input }, db)
    await revokeTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    await expect(
      saveWorkoutImport({ userId: "athlete", input }, db),
    ).rejects.toThrow("access required")
    expect(await rowCounts()).toEqual([1, 1, 0, 1])
  })
  it("rejects stale revisions, guessed sessions, unresolved questions, and unauthorized movement IDs", async () => {
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft("personal", {
      ...proposal,
      unresolved: [
        {
          id: "scheme",
          field: "scheme",
          reason: "Choose score",
          sourceExcerpt: "EMOM",
          choices: ["reps", "load"],
        },
      ],
    })
    await expect(
      saveWorkoutImport(
        { userId: "athlete", input: { ...input, revision: 2 } },
        db,
      ),
    ).rejects.toThrow("revision changed")
    await expect(
      saveWorkoutImport({ userId: "intruder", input }, db),
    ).rejects.toThrow("not found")
    await expect(
      saveWorkoutImport({ userId: "athlete", input }, db),
    ).rejects.toThrow("Resolve import question")
    await expect(
      saveWorkoutImport(
        {
          userId: "athlete",
          input: {
            ...input,
            resolutions: [{ questionId: "scheme", answer: "reps" }],
            workout: {
              ...workout,
              scheme: "reps",
              timeCapSeconds: null,
              movementIds: ["invented"],
            },
          },
        },
        db,
      ),
    ).rejects.toThrow("catalog movements")
    expect(await rowCounts()).toEqual([0, 0, 0, 0])
  })
  it("persists prescription resolutions and rejects conflicting structured choices", async () => {
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft("personal", {
      ...proposal,
      unresolved: [
        {
          id: "units",
          field: "prescription",
          reason: "Weight units",
          sourceExcerpt: "95/65",
          choices: [],
        },
        {
          id: "scheme",
          field: "scheme",
          reason: "Scoring",
          sourceExcerpt: "score",
          choices: ["time-with-cap", "reps"],
        },
      ],
    })
    await expect(
      saveWorkoutImport(
        {
          userId: "athlete",
          input: {
            ...input,
            resolutions: [
              { questionId: "units", answer: "kilograms" },
              { questionId: "scheme", answer: "reps" },
            ],
          },
        },
        db,
      ),
    ).rejects.toThrow("Answer must match")
    const result = await saveWorkoutImport(
      {
        userId: "athlete",
        input: {
          ...input,
          resolutions: [
            { questionId: "units", answer: "kilograms" },
            { questionId: "scheme", answer: "time-with-cap" },
          ],
        },
      },
      db,
    )
    const saved = await db.query.workouts.findFirst({
      where: eq(workouts.id, result.workoutId),
    })
    expect(saved?.description).toContain("Weight units: kilograms")
  })
  it("rolls back all writes when track insertion fails and retry succeeds", async () => {
    await grantTeamFeature("gym", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft("track")
    await pool
      .promise()
      .query(
        "CREATE TRIGGER reject_import_track BEFORE INSERT ON track_workouts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected track failure'",
      )
    try {
      await expect(
        saveWorkoutImport({ userId: "athlete", input }, db),
      ).rejects.toThrow()
    } finally {
      await pool.promise().query("DROP TRIGGER reject_import_track")
    }
    expect(await rowCounts()).toEqual([0, 0, 0, 0])
    await saveWorkoutImport({ userId: "athlete", input }, db)
    expect(await rowCounts()).toEqual([1, 1, 1, 1])
  })
  it("cancel after revoke permits cleanup but prevents further revision and save", async () => {
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    const input = await draft()
    await revokeTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    await cleanupWorkoutImportSession(
      { userId: "athlete", importId: input.importId },
      db,
    )
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    await expect(
      saveWorkoutImport({ userId: "athlete", input }, db),
    ).rejects.toThrow("expired")
    expect(await rowCounts()).toEqual([0, 0, 0, 0])
  })
  it("provisions catalog idempotently without granting plans or teams", async () => {
    await db
      .delete(featureTable)
      .where(eq(featureTable.key, FEATURES.AI_WORKOUT_IMPORT))
    const migration = readFileSync(
      "../../packages/wodsmith-db/mysql-migrations/0002_workout_import_domain.sql",
      "utf8",
    )
    for (let n = 0; n < 2; n++)
      for (const statement of migration.split("--> statement-breakpoint"))
        if (statement.trim()) await pool.promise().query(statement)
    expect(
      await db
        .select()
        .from(featureTable)
        .where(eq(featureTable.key, FEATURES.AI_WORKOUT_IMPORT)),
    ).toHaveLength(1)
    expect(await db.select().from(planFeatureTable)).toHaveLength(0)
    await expect(
      requireWorkoutImportAccess(
        { userId: "athlete", destination: { kind: "personal" } },
        db,
      ),
    ).rejects.toThrow("access required")
  })
  it("honors current overrides and custom programming roles on only the owning team", async () => {
    await seed(teamEntitlementOverrideTable, {
      id: "override",
      teamId: "gym",
      type: "feature",
      key: FEATURES.AI_WORKOUT_IMPORT,
      value: "true",
    })
    await db
      .update(teamMembershipTable)
      .set({ roleId: "programmer", isSystemRole: false })
      .where(eq(teamMembershipTable.teamId, "gym"))
    await seed(teamRoleTable, {
      id: "programmer",
      teamId: "gym",
      name: "Programmer",
      permissions: JSON.stringify(["manage_programming"]),
    })
    expect(
      (
        await requireWorkoutImportAccess(
          {
            userId: "athlete",
            destination: { kind: "track", trackId: "track" },
          },
          db,
        )
      ).teamId,
    ).toBe("gym")
    await db
      .update(teamRoleTable)
      .set({ permissions: [] })
      .where(eq(teamRoleTable.id, "programmer"))
    await expect(
      requireWorkoutImportAccess(
        { userId: "athlete", destination: { kind: "track", trackId: "track" } },
        db,
      ),
    ).rejects.toThrow("access required")
    await db
      .update(teamRoleTable)
      .set({ permissions: ["manage_programming"] })
      .where(eq(teamRoleTable.id, "programmer"))
    await db
      .update(teamEntitlementOverrideTable)
      .set({ expiresAt: new Date(0) })
      .where(eq(teamEntitlementOverrideTable.id, "override"))
    await expect(
      requireWorkoutImportAccess(
        { userId: "athlete", destination: { kind: "track", trackId: "track" } },
        db,
      ),
    ).rejects.toThrow("access required")
  })
  it("admin revocation denies an override-only or plan-only import grant",async()=>{
    await seed(teamEntitlementOverrideTable,{id:"override",teamId:"personal",type:"feature",key:FEATURES.AI_WORKOUT_IMPORT,value:"true"})
    expect((await requireWorkoutImportAccess({userId:"athlete",destination:{kind:"personal"}},db)).teamId).toBe("personal")
    await revokeTeamFeature("personal",FEATURES.AI_WORKOUT_IMPORT)
    await expect(requireWorkoutImportAccess({userId:"athlete",destination:{kind:"personal"}},db)).rejects.toThrow("access required")
    await grantTeamFeature("personal",FEATURES.AI_WORKOUT_IMPORT)
    expect((await requireWorkoutImportAccess({userId:"athlete",destination:{kind:"personal"}},db)).teamId).toBe("personal")
  })
  it("lists only permitted scaling labels and keeps manual track selection authorized",async()=>{
    await grantTeamFeature("personal",FEATURES.AI_WORKOUT_IMPORT)
    await seed(scalingGroupsTable,{id:"private-gym",title:"Gym levels",teamId:"gym",isSystem:false})
    const access=await getWorkoutImportAccessFn({data:{destination:{kind:"personal"}}})
    expect(access).toMatchObject({hasAccess:true,scalingGroups:[{id:"scaling",title:"Rx"}]})
    await seed(workouts,{id:"gym-workout",name:"Gym",description:"source",teamId:"gym",scope:"private",scheme:"time"})
    await seed(workouts,{id:"public-workout",name:"Public",description:"source",teamId:"someone-else",scope:"public",scheme:"time"})
    await seed(workouts,{id:"private-workout",name:"Private",description:"source",teamId:"personal",scope:"private",scheme:"time"})
    await addWorkoutToTrackFn({data:{trackId:"track",workoutId:"gym-workout",trackOrder:1}})
    await addWorkoutToTrackFn({data:{trackId:"track",workoutId:"public-workout",trackOrder:2}})
    await expect(addWorkoutToTrackFn({data:{trackId:"track",workoutId:"private-workout",trackOrder:3}})).rejects.toThrow("unavailable")
    await db.update(teamMembershipTable).set({isActive:false}).where(eq(teamMembershipTable.teamId,"gym"))
    await expect(addWorkoutToTrackFn({data:{trackId:"track",workoutId:"public-workout",trackOrder:3}})).rejects.toThrow("access required")
    expect(await rowCounts()).toEqual([3,0,2,0])
  })
  it("manual creation persists metadata and movements with actual destination authorization", async () => {
    const data = {
      name: workout.name,
      description: workout.description,
      scheme: "time-with-cap" as const,
      scope: "private" as const,
      timeCap: 900,
      teamId: "personal",
      scoreType: "min" as const,
      tiebreakScheme: "reps" as const,
      scalingGroupId: "scaling",
      repsPerRound: 10,
      movementIds: ["pull-up"],
    }
    const { workout: saved } = await createWorkoutFn({ data })
    expect(saved).toMatchObject({
      timeCap: 900,
      roundsToScore: 1,
      repsPerRound: 10,
      tiebreakScheme: "reps",
      scalingGroupId: "scaling",
    })
    expect(await rowCounts()).toEqual([1, 1, 0, 0])
    await db
      .update(teamMembershipTable)
      .set({ isActive: false })
      .where(eq(teamMembershipTable.teamId, "personal"))
    await expect(createWorkoutFn({ data })).rejects.toThrow("access required")
    expect(await rowCounts()).toEqual([1, 1, 0, 0])
  })
  it("server endpoints resolve labels and gate direct saves on current grants", async () => {
    expect(
      await getWorkoutImportAccessFn({
        data: { destination: { kind: "personal" } },
      }),
    ).toEqual({ hasAccess: false })
    await grantTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    expect(
      await getWorkoutImportAccessFn({
        data: { destination: { kind: "personal" } },
      }),
    ).toMatchObject({
      hasAccess: true,
      teamName: "Personal",
      trackName: null,
      scope: { teamId: "personal" },
    })
    const input = await draft()
    await revokeTeamFeature("personal", FEATURES.AI_WORKOUT_IMPORT)
    await expect(saveWorkoutImportFn({ data: input })).rejects.toThrow(
      "access required",
    )
    expect(await rowCounts()).toEqual([0, 0, 0, 0])
  })
  it("fails closed when entitlement queries are unavailable", async () => {
    const unavailable = {
      ...db,
      query: {
        ...db.query,
        featureTable: {
          findFirst: async () => {
            throw new Error("offline")
          },
        },
      },
    } as unknown as Database
    await expect(
      requireWorkoutImportAccess(
        { userId: "athlete", destination: { kind: "personal" } },
        unavailable,
      ),
    ).rejects.toThrow("access required")
    expect(await rowCounts()).toEqual([0, 0, 0, 0])
  })
})
