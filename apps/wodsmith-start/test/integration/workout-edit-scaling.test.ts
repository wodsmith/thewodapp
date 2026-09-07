import { randomUUID } from "node:crypto"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { eq, getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Pool } from "mysql2"
import { createElement, type ComponentType } from "react"
import {
  afterAll,
  afterEach,
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
  movements,
  scalingGroupsTable,
  teamFeatureEntitlementTable,
  teamMembershipTable,
  teamRoleTable,
  teamTable,
  userTable,
  workoutMovements,
  workouts,
} from "@/db/schema"
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({
  db: undefined as Database | undefined,
  loaderData: {} as Record<string, unknown>,
  userId: "editor" as string | undefined,
  navigate: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => ({
    userId: fixture.userId,
    teams: [
      { id: "team", permissions: ["edit_components", "access_dashboard"] },
    ],
  }),
  requireAdmin: vi.fn(),
}))
vi.mock("@/utils/kv-session", () => ({
  invalidateTeamMembersSessions: vi.fn(),
}))
vi.mock("@/utils/email", () => ({
  sendOrganizerApprovalEmail: vi.fn(),
  sendOrganizerRejectionEmail: vi.fn(),
}))
vi.mock("@/lib/logging/posthog-otel-logger", () => ({ logInfo: vi.fn() }))
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
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => fixture.loaderData,
    useParams: () => ({ workoutId: "workout" }),
  }),
  useNavigate: () => fixture.navigate,
}))
import { Route } from "@/routes/_protected/workouts/$workoutId/edit/index"
import { getWorkoutEditScalingGroupsFn } from "@/server-fns/workout-edit-fns"
import { updateWorkoutFn } from "@/server-fns/workout-fns"
import {
  grantTeamFeature,
  revokeTeamFeature,
} from "@/server/organizer-onboarding"

const tables = [
  featureTable,
  movements,
  scalingGroupsTable,
  teamFeatureEntitlementTable,
  teamMembershipTable,
  teamRoleTable,
  teamTable,
  userTable,
  workoutMovements,
  workouts,
]
const databaseName = `workout_edit_scaling_${randomUUID().replaceAll("-", "")}`
const casing = new CasingCache("snake_case")
let admin: Pool
let pool: Pool
let db: Database
const edit = {
  id: "workout",
  name: "Imported workout",
  description: "Three rounds for time",
  scheme: "time" as const,
  scope: "private" as const,
  scalingGroupId: "system",
}

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

describe.skipIf(!mysqlTestConfig)(
  "ordinary workout edit scaling on MySQL",
  () => {
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
      await pool
        .promise()
        .query(
          "CREATE UNIQUE INDEX team_feature_unique ON team_feature_entitlements (team_id, feature_id)",
        )
    }, 20_000)
    afterEach(cleanup)
    afterAll(async () => {
      if (pool) await pool.promise().end()
      if (admin) {
        await admin
          .promise()
          .query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
        await admin.promise().end()
      }
    })
    beforeEach(async () => {
      fixture.userId = "editor"
      for (const table of tables)
        await pool.promise().query(`DELETE FROM \`${getTableName(table)}\``)
      await seed(userTable, { id: "editor", role: "admin" })
      await seed(teamTable, { id: "team", name: "Team" })
      await seed(teamRoleTable, {
        id: "edit-role",
        teamId: "team",
        name: "Editor",
        permissions: JSON.stringify(["edit_components"]),
      })
      await seed(teamMembershipTable, {
        id: "member",
        userId: "editor",
        teamId: "team",
        roleId: "edit-role",
        isSystemRole: false,
        isActive: true,
      })
      await seed(featureTable, {
        id: "feat_ai_workout_import",
        key: FEATURES.AI_WORKOUT_IMPORT,
        name: "Workout import",
        isActive: 1,
      })
      await seed(scalingGroupsTable, {
        id: "system",
        title: "System levels",
        teamId: null,
        isSystem: true,
      })
      await seed(scalingGroupsTable, {
        id: "team-group",
        title: "Team levels",
        teamId: "team",
        isSystem: false,
      })
      await seed(scalingGroupsTable, {
        id: "foreign",
        title: "Foreign levels",
        teamId: "other-team",
        isSystem: true,
      })
      await seed(scalingGroupsTable, {
        id: "unowned",
        title: "Unowned non-system",
        teamId: null,
        isSystem: false,
      })
      await seed(workouts, { ...edit, teamId: "team", roundsToScore: 1 })
    })

    // @lat: [[workout-import#Workout Import#Ordinary edit scaling choices]]
    it("loads the real edit form and saves team or system choices after the AI grant is revoked", async () => {
      await grantTeamFeature("team", FEATURES.AI_WORKOUT_IMPORT)
      await revokeTeamFeature("team", FEATURES.AI_WORKOUT_IMPORT)
      const grant = await db.query.teamFeatureEntitlementTable.findFirst({
        where: eq(teamFeatureEntitlementTable.teamId, "team"),
      })
      expect(grant?.isActive).toBe(0)
      const load = Route.options.loader as unknown as (ctx: {
        params: { workoutId: string }
      }) => Promise<Record<string, unknown>>
      fixture.loaderData = await load({ params: { workoutId: "workout" } })
      expect(fixture.loaderData.scalingGroups).toEqual([
        { id: "system", title: "System levels" },
        { id: "team-group", title: "Team levels" },
      ])
      render(createElement(Route.options.component as ComponentType))
      for (const [label, id] of [
        ["Team levels", "team-group"],
        ["System levels", "system"],
      ]) {
        fireEvent.keyDown(
          screen.getByRole("combobox", { name: "Scaling group (optional)" }),
          { key: "ArrowDown" },
        )
        const option = await screen.findByRole("option", { name: label })
        expect(
          screen.queryByRole("option", { name: "Foreign levels" }),
        ).toBeNull()
        expect(
          screen.queryByRole("option", { name: "Unowned non-system" }),
        ).toBeNull()
        fireEvent.click(option)
        fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
        await waitFor(async () => {
          const saved = await db.query.workouts.findFirst({
            where: eq(workouts.id, "workout"),
          })
          expect(saved?.scalingGroupId).toBe(id)
        })
        await waitFor(() =>
          expect(
            screen.getByRole("button", { name: "Save changes" }),
          ).not.toBeDisabled(),
        )
      }
      await expect(
        updateWorkoutFn({ data: { ...edit, scalingGroupId: "foreign" } }),
      ).rejects.toThrow("Scaling group is unavailable")
      expect(
        (
          await db.query.workouts.findFirst({
            where: eq(workouts.id, "workout"),
          })
        )?.scalingGroupId,
      ).toBe("system")
    })

    it.each(["membership", "expired", "role"])(
      "rejects %s permission loss even with stale cached session permissions",
      async (reason) => {
        expect(
          (
            await getWorkoutEditScalingGroupsFn({
              data: { workoutId: "workout" },
            })
          ).scalingGroups,
        ).toHaveLength(2)
        if (reason === "membership")
          await db
            .update(teamMembershipTable)
            .set({ isActive: false })
            .where(eq(teamMembershipTable.id, "member"))
        if (reason === "expired")
          await db
            .update(teamMembershipTable)
            .set({ expiresAt: new Date(0) })
            .where(eq(teamMembershipTable.id, "member"))
        if (reason === "role")
          await db
            .update(teamRoleTable)
            .set({ permissions: [] })
            .where(eq(teamRoleTable.id, "edit-role"))
        await expect(
          getWorkoutEditScalingGroupsFn({ data: { workoutId: "workout" } }),
        ).rejects.toThrow("access required")
        await expect(
          updateWorkoutFn({ data: { ...edit, scalingGroupId: "team-group" } }),
        ).rejects.toThrow("access required")
        expect(
          (
            await db.query.workouts.findFirst({
              where: eq(workouts.id, "workout"),
            })
          )?.scalingGroupId,
        ).toBe("system")
      },
    )

    it("requires authentication and derives ownership from the workout", async () => {
      fixture.userId = undefined
      await expect(
        getWorkoutEditScalingGroupsFn({ data: { workoutId: "workout" } }),
      ).rejects.toThrow("Not authenticated")
      fixture.userId = "editor"
      await db
        .update(workouts)
        .set({ teamId: "other-team" })
        .where(eq(workouts.id, "workout"))
      await expect(
        getWorkoutEditScalingGroupsFn({ data: { workoutId: "workout" } }),
      ).rejects.toThrow("access required")
    })
  },
)
