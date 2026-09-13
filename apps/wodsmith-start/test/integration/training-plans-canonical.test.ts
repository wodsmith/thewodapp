import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  programmingTracksTable,
  teamMembershipTable,
  teamTable,
  userTable,
  workouts,
} from "@repo/wodsmith-db/schema"
import {
  trainingPlanDraftsTable,
  trainingPlanReceiptsTable,
} from "@repo/wodsmith-db/schemas/training-plans"
import {
  personalTrainingResultsTable,
  personalTrainingSessionsTable,
} from "@repo/wodsmith-db/schemas/training-personal"
import { trainingSessionsTable } from "@repo/wodsmith-db/schemas/training"
import { eq } from "drizzle-orm"
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
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({ db: undefined as unknown }))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))

import { createPersonalTrainingService } from "@/server/training-personal-service"
import {
  createTrainingPlanningService,
  trainingPlanDocumentSchema,
  type TrainingPlanningDependencies,
} from "@/server/training-plans"

const block = {
  id: "reps",
  kind: "reps" as const,
  title: "Pull-ups",
  prescription: "30 pull-ups",
  scalingGuidance: "",
  coachGuidance: "",
}
const day = (trainingDate = "2026-09-07") => ({
  trainingDate,
  accessTeamId: "plan_gym",
  intent: "train" as const,
  items: [
    {
      item: { kind: "personal" as const, id: "reps", block },
      role: "strength" as const,
      estimatedDurationMinutes: 12,
    },
  ],
})
const document = () =>
  trainingPlanDocumentSchema.parse({
    blueprintVersion: "general-functional-fitness@1",
    weekStart: "2026-09-07",
    title: "Canonical week",
    days: [day()],
    questions: [],
    constraints: [],
    warnings: [],
  })

describe.skipIf(!mysqlTestConfig)(
  "planning through the canonical MySQL session writer",
  () => {
    const databaseName = `training_plans_canonical_${randomUUID().replaceAll("-", "")}`
    let admin: Pool
    let pool: Pool
    let db: WodsmithDb
    let dependencies: TrainingPlanningDependencies
    let plans: ReturnType<typeof createTrainingPlanningService>
    let grantActive = true
    let feature = true
    let transactionGrantChecks = 0

    beforeAll(async () => {
      if (!mysqlTestConfig)
        throw new Error("Disposable MySQL configuration is required")
      admin = mysql.createPool(mysqlTestConfig)
      await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
      pool = mysql.createPool({
        ...mysqlTestConfig,
        database: databaseName,
        connectionLimit: 5,
      })
      db = createWodsmithDb(pool)
      fixture.db = db
      const schemaFile = resolve(tmpdir(), `${databaseName}.json`)
      try {
        execFileSync(
          "pnpm",
          [
            "exec",
            "tsx",
            "../../packages/wodsmith-db/scripts/export-test-schema.ts",
            schemaFile,
          ],
          { cwd: process.cwd(), timeout: 30_000 },
        )
        const statements = JSON.parse(
          await readFile(schemaFile, "utf8"),
        ) as string[]
        for (const statement of statements)
          await pool.promise().query(statement)
      } finally {
        await unlink(schemaFile).catch(() => undefined)
      }
      await db.insert(userTable).values([
        { id: "plan_athlete", firstName: "Athlete" },
        { id: "plan_other", firstName: "Other" },
      ])
      await db.insert(teamTable).values([
        { id: "plan_gym", name: "Plan gym", slug: "plan-gym", type: "gym" },
        {
          id: "plan_foreign",
          name: "Other gym",
          slug: "plan-other",
          type: "gym",
        },
      ])
      await db.insert(teamMembershipTable).values([
        {
          id: "plan_member",
          userId: "plan_athlete",
          teamId: "plan_gym",
          roleId: "member",
        },
      ])
      await db.insert(programmingTracksTable).values({
        id: "plan_track",
        name: "Daily",
        type: "team_owned",
        ownerTeamId: "plan_gym",
      })
      dependencies = {
        db,
        actor: {
          userId: "plan_athlete",
          grantId: "grant",
          clientId: "client",
          scopes: ["training:read", "training:write", "results:write"],
          allowedTeamIds: ["plan_gym"],
        },
        hasFeature: async () => feature,
        authorizeActor: async (connection) => {
          if (connection !== db) transactionGrantChecks++
          if (!grantActive) throw new Error("ACCESS_REVOKED")
        },
      }
      plans = createTrainingPlanningService(dependencies)
    }, 60_000)
    beforeEach(async () => {
      grantActive = true
      feature = true
      transactionGrantChecks = 0
      await db.delete(trainingPlanReceiptsTable)
      await db.delete(trainingPlanDraftsTable)
      await db.delete(personalTrainingResultsTable)
      await db.delete(personalTrainingSessionsTable)
      await db.delete(trainingSessionsTable)
      await db
        .update(teamMembershipTable)
        .set({ isActive: true })
        .where(eq(teamMembershipTable.id, "plan_member"))
      await db.delete(workouts)
      await db.insert(trainingSessionsTable).values({
        id: "plan_source",
        teamId: "plan_gym",
        trackId: "plan_track",
        trainingDate: "2026-09-09",
        timezone: "UTC",
        revision: 1,
        publishedVersion: 1,
        published: {
          title: "Source",
          coachNote: "",
          isRestDay: false,
          blocks: [block],
        },
      })
      await db.insert(workouts).values({
        id: "plan_library",
        name: "Three rounds",
        description: "3 rounds with cap",
        scheme: "time-with-cap",
        scoreType: "sum",
        roundsToScore: 3,
        timeCap: 300,
        repsPerRound: 20,
        tiebreakScheme: "reps",
        scope: "private",
        teamId: "plan_gym",
      })
    })
    afterAll(async () => {
      await pool?.promise().end()
      if (admin) {
        await admin
          .promise()
          .query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
        await admin.promise().end()
      }
    })
    const preview = async (value = document()) => {
      const draft = await plans.create(dependencies.actor, value)
      const review = await plans.preview(dependencies.actor, {
        trainingPlanId: draft.trainingPlanId,
      })
      return {
        review,
        commit: {
          trainingPlanId: draft.trainingPlanId,
          expectedRevision: draft.revision,
          previewDigest: review.previewDigest,
          idempotencyKey: randomUUID(),
        },
      }
    }

    // @lat: [[training-plans#Verification#Canonical Mixed Week]]
    it("commits mixed source, library and personal work with metadata and rich definitions intact", async () => {
      const value = document()
      value.days[0]!.items.push(
        {
          item: {
            id: "source",
            kind: "source",
            sourceSessionId: "plan_source",
            sourceBlockId: "reps",
            sourcePublishedVersion: 1,
          },
          role: "conditioning",
          estimatedDurationMinutes: 8,
        },
        {
          item: { id: "library", kind: "library", workoutId: "plan_library" },
          role: "skill",
        },
        {
          item: {
            id: "remix",
            kind: "personal",
            role: "mobility",
            estimatedDurationMinutes: 5,
            block: {
              ...block,
              id: "remix",
              prescription: "Dumbbell variation",
            },
            remixedFrom: {
              sourceSessionId: "plan_source",
              sourceBlockId: "reps",
              sourcePublishedVersion: 1,
            },
          },
        },
      )
      value.days.push(day("2026-09-08"))
      const { commit } = await preview(value)
      expect(
        await db.select().from(personalTrainingSessionsTable),
      ).toHaveLength(0)
      const [receipt, concurrentRetry] = await Promise.all([
        plans.commit(dependencies.actor, commit),
        plans.commit(dependencies.actor, commit),
      ])
      expect(concurrentRetry).toEqual(receipt)
      expect(receipt.origin).toEqual({
        kind: "agent",
        clientId: "client",
        grantId: "grant",
      })
      expect(receipt.sessions).toHaveLength(2)
      const personal = createPersonalTrainingService(dependencies)
      const saved = await personal.getPersonalTrainingDay({
        teamId: "plan_gym",
        trainingDate: "2026-09-07",
      })
      expect(saved.personalSession?.items[0]).toMatchObject({
        role: "strength",
        estimatedDurationMinutes: 12,
        block,
      })
      expect(saved.personalSession?.items[1]).toMatchObject({
        role: "conditioning",
        estimatedDurationMinutes: 8,
        sourceSessionId: "plan_source",
        sourceTrainingDate: "2026-09-09",
      })
      expect(saved.personalSession?.items[2]).toMatchObject({
        role: "skill",
        workout: {
          scheme: "time-with-cap",
          scoreType: "sum",
          roundsToScore: 3,
          timeCap: 300,
          repsPerRound: 20,
          tiebreakScheme: "reps",
        },
      })
      expect(await plans.commit(dependencies.actor, commit)).toEqual(receipt)
      expect(
        await plans.commit(
          {
            ...dependencies.actor,
            clientId: "second-client",
            grantId: "second-grant",
          },
          commit,
        ),
      ).toEqual(receipt)
      expect(saved.personalSession?.items[3]).toMatchObject({
        role: "mobility",
        estimatedDurationMinutes: 5,
        remixedFrom: {
          sourceSessionId: "plan_source",
          sourceBlockId: "reps",
          sourcePublishedVersion: 1,
        },
      })
      expect(transactionGrantChecks).toBeGreaterThan(0)
    })

    // @lat: [[training-plans#Verification#Canonical Rollback and History]]
    it("rolls back an earlier day when a later performed item would change, and rest preserves history", async () => {
      const personal = createPersonalTrainingService(dependencies)
      const existing = await personal.savePersonalTrainingSession({
        teamId: "plan_gym",
        trainingDate: "2026-09-08",
        expectedRevision: 0,
        items: [{ id: "reps", kind: "personal", block }],
      })
      await personal.savePersonalTrainingResult({
        personalSessionId: existing.id,
        itemId: "reps",
        expectedRevision: existing.revision,
        score: "30",
        notes: "Keep me",
        unit: "lb",
        completed: true,
      })
      const value = document()
      value.days.push({
        ...day("2026-09-08"),
        items: [
          {
            item: {
              id: "reps",
              kind: "personal",
              block: { ...block, prescription: "60 pull-ups" },
            },
          },
        ],
      })
      const attempt = await preview(value)
      await expect(
        plans.commit(dependencies.actor, attempt.commit),
      ).rejects.toThrow("result")
      expect(
        await db.select().from(personalTrainingSessionsTable),
      ).toHaveLength(1)
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(0)
      const rest = document()
      rest.days = [{ ...day("2026-09-08"), intent: "rest", items: [] }]
      const resting = await preview(rest)
      expect(JSON.stringify(resting.review.changes)).toContain("removedItems")
      expect(JSON.stringify(resting.review.changes)).not.toContain("Keep me")
      await plans.commit(dependencies.actor, resting.commit)
      const [result] = await db.select().from(personalTrainingResultsTable)
      expect(result).toMatchObject({ notes: "Keep me", block })
      const [session] = await db.select().from(personalTrainingSessionsTable)
      expect(session?.items).toEqual([])
    })

    // @lat: [[training-plans#Verification#Canonical Source and Access Conflicts]]
    it("invalidates source republication, current membership and cross-context ambiguity without writes", async () => {
      const value = document()
      value.days[0]!.items = [
        {
          item: {
            id: "source",
            kind: "source",
            sourceSessionId: "plan_source",
            sourceBlockId: "reps",
            sourcePublishedVersion: 1,
          },
        },
      ]
      const attempt = await preview(value)
      await db
        .update(trainingSessionsTable)
        .set({
          revision: 2,
          publishedVersion: 2,
          published: {
            title: "Changed",
            coachNote: "",
            isRestDay: false,
            blocks: [{ ...block, prescription: "60 reps" }],
          },
        })
        .where(eq(trainingSessionsTable.id, "plan_source"))
      await expect(
        plans.commit(dependencies.actor, attempt.commit),
      ).rejects.toThrow()
      const plain = await preview()
      await db
        .update(teamMembershipTable)
        .set({ isActive: false })
        .where(eq(teamMembershipTable.id, "plan_member"))
      await expect(
        plans.commit(dependencies.actor, plain.commit),
      ).rejects.toThrow("FORBIDDEN")
      await db
        .update(teamMembershipTable)
        .set({ isActive: true })
        .where(eq(teamMembershipTable.id, "plan_member"))
      await db.insert(personalTrainingSessionsTable).values({
        id: "hidden-context",
        userId: "plan_athlete",
        teamId: "plan_foreign",
        trainingDate: "2026-09-07",
        revision: 1,
        items: [],
      })
      await expect(
        plans.preview(dependencies.actor, {
          trainingPlanId: plain.commit.trainingPlanId,
        }),
      ).rejects.toThrow("workspace composition")
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(0)
    })

    it("rejects another athlete and revoked grants even on a successful receipt retry", async () => {
      const attempt = await preview()
      await expect(
        plans.get(
          { ...dependencies.actor, userId: "plan_other" },
          { trainingPlanId: attempt.commit.trainingPlanId },
        ),
      ).rejects.toThrow("NOT_FOUND")
      await plans.commit(dependencies.actor, attempt.commit)
      grantActive = false
      await expect(
        plans.commit(dependencies.actor, attempt.commit),
      ).rejects.toThrow("ACCESS_REVOKED")
    })

    it("allows a current read-only grant to preview but not commit", async () => {
      const attempt = await preview()
      const reader = { ...dependencies.actor, scopes: ["training:read"] }
      expect(
        (
          await plans.preview(reader, {
            trainingPlanId: attempt.commit.trainingPlanId,
          })
        ).canCommit,
      ).toBe(true)
      await expect(plans.commit(reader, attempt.commit)).rejects.toThrow(
        "training:write",
      )
      expect(
        await db.select().from(personalTrainingSessionsTable),
      ).toHaveLength(0)
    })

    // @lat: [[training-plans#Verification#Preserved Library Preview]]
    it("previews the stored library definition that the canonical writer will preserve", async () => {
      const value = document()
      value.days[0]!.items = [
        { item: { id: "library", kind: "library", workoutId: "plan_library" } },
      ]
      const first = await preview(value)
      await plans.commit(dependencies.actor, first.commit)
      await db
        .update(workouts)
        .set({ name: "Changed library", timeCap: 600 })
        .where(eq(workouts.id, "plan_library"))
      const second = await preview(value)
      const changes = second.review.changes as {
        days: { library: { workout: { name: string; timeCap: number } }[] }[]
      }
      expect(changes.days[0]!.library[0]!.workout).toMatchObject({
        name: "Three rounds",
        timeCap: 300,
      })
      await plans.commit(dependencies.actor, second.commit)
      const personal = await createPersonalTrainingService(
        dependencies,
      ).getPersonalTrainingDay({
        teamId: "plan_gym",
        trainingDate: "2026-09-07",
      })
      expect(personal.personalSession?.items[0]).toMatchObject({
        workout: { name: "Three rounds", timeCap: 300 },
      })
    })

    // @lat: [[training-plans#Verification#Concurrent Canonical Contexts]]
    it("rejects alternate workspace commits after both transactions established old read snapshots", async () => {
      await db.insert(teamMembershipTable).values({
        id: "plan_member_foreign",
        userId: "plan_athlete",
        teamId: "plan_foreign",
        roleId: "member",
      })
      const actor = {
        ...dependencies.actor,
        allowedTeamIds: ["plan_gym", "plan_foreign"],
      }
      let entered = 0
      let release!: () => void
      const ready = new Promise<void>((resolve) => {
        release = resolve
      })
      const racing = createTrainingPlanningService({
        ...dependencies,
        actor,
        authorizeActor: async (connection) => {
          if (connection === db) return
          // Establish REPEATABLE READ before either transaction takes the athlete lock.
          await connection
            .select()
            .from(userTable)
            .where(eq(userTable.id, actor.userId))
          if (++entered === 2) release()
          let timer: ReturnType<typeof setTimeout> | undefined
          try {
            await Promise.race([
              ready,
              new Promise<never>((_, reject) => {
                timer = setTimeout(
                  () =>
                    reject(
                      new Error("Both authorizations did not reach barrier"),
                    ),
                  2000,
                )
              }),
            ])
          } finally {
            clearTimeout(timer)
          }
        },
      })
      const first = await racing.create(actor, document())
      const other = document()
      other.days[0]!.accessTeamId = "plan_foreign"
      const second = await racing.create(actor, other)
      const firstReview = await racing.preview(actor, {
        trainingPlanId: first.trainingPlanId,
      })
      const secondReview = await racing.preview(actor, {
        trainingPlanId: second.trainingPlanId,
      })
      const outcomes = await Promise.allSettled([
        racing.commit(actor, {
          trainingPlanId: first.trainingPlanId,
          expectedRevision: 1,
          previewDigest: firstReview.previewDigest,
          idempotencyKey: "first-context",
        }),
        racing.commit(actor, {
          trainingPlanId: second.trainingPlanId,
          expectedRevision: 1,
          previewDigest: secondReview.previewDigest,
          idempotencyKey: "second-context",
        }),
      ])
      expect(entered).toBe(2)
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1)
      expect(
        await db.select().from(personalTrainingSessionsTable),
      ).toHaveLength(1)
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(1)
    })
  },
)
