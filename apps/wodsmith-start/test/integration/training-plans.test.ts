import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  trainingPlanDraftsTable,
  trainingPlanReceiptsTable,
} from "@repo/wodsmith-db/schemas/training-plans"
import { and, eq } from "drizzle-orm"
import {
  int,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import mysql, { type Pool } from "mysql2"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import {
  createTrainingPlanSchema,
  getSessionBlueprint,
  PLAN_BLUEPRINT_VERSION,
  type TrainingPlanDocument,
} from "../../../../packages/wodsmith-training/src/plans/blueprint"
import {
  createTrainingPlanService,
  trainingPlanDigest,
} from "../../../../packages/wodsmith-training/src/plans/service"
import { personalTrainingItemSchema } from "@/server/training-personal-validation"
import { mysqlTestConfig } from "./mysql-test-config"

const schema = createTrainingPlanSchema(personalTrainingItemSchema)
const document = () =>
  schema.parse({
    blueprintVersion: PLAN_BLUEPRINT_VERSION,
    weekStart: "2026-09-07",
    title: "Training week",
    days: [
      {
        trainingDate: "2026-09-07",
        accessTeamId: "gym",
        intent: "train",
        items: [
          {
            role: "warmup",
            estimatedDurationMinutes: 10,
            item: {
              kind: "personal",
              id: "warmup",
              block: {
                id: "warmup",
                kind: "check",
                title: "Warm up",
                prescription: "Easy bike",
                scalingGuidance: "",
                coachGuidance: "",
              },
            },
          },
        ],
      },
    ],
    questions: [],
    constraints: [],
    warnings: [],
  })

// @lat: [[training-plans#Verification#Blueprint and Validation]]
it("keeps canonical rich definitions and bounds the flexible seven-day plan", () => {
  expect(getSessionBlueprint().roles).toContain("mobility")
  expect(() => getSessionBlueprint("future@2")).toThrow("UNSUPPORTED_BLUEPRINT")
  const plan = document()
  expect(schema.safeParse({ ...plan, weekStart: "2026-02-30" }).success).toBe(
    false,
  )
  expect(
    schema.safeParse({ ...plan, days: [...plan.days, ...plan.days] }).success,
  ).toBe(false)
  expect(
    schema.safeParse({
      ...plan,
      days: [{ ...plan.days[0], trainingDate: "2026-09-14" }],
    }).success,
  ).toBe(false)
  expect(
    schema.safeParse({ ...plan, days: [{ ...plan.days[0], intent: "rest" }] })
      .success,
  ).toBe(false)
  expect(
    schema.safeParse({
      ...plan,
      constraints: [
        {
          id: "time",
          kind: "duration",
          description: "30 minutes",
          status: "waived",
        },
      ],
    }).success,
  ).toBe(false)
  const rich = {
    ...plan.days[0]!.items[0]!,
    role: "strength" as const,
    item: {
      kind: "personal" as const,
      id: "strength",
      block: {
        id: "strength",
        kind: "workout" as const,
        title: "Three rounds",
        prescription: "3 rounds of work",
        coachGuidance: "",
        scalingGuidance: "",
        workout: {
          name: "Three rounds",
          description: "3 rounds of work",
          scheme: "time-with-cap",
          scoreType: "sum",
          scope: "private",
          roundsToScore: 3,
          timeCapSeconds: 300,
          repsPerRound: 20,
          tiebreakScheme: "reps",
          scalingGroupId: null,
          movementIds: [],
        },
      },
    },
  }
  const parsed = schema.parse({
    ...plan,
    days: [{ ...plan.days[0], items: [rich] }],
  })
  expect(parsed.days[0]!.items[0]!.item).toEqual(rich.item)
})

it("hashes object key order deterministically and includes dates and item order", async () => {
  expect(await trainingPlanDigest({ a: 1, b: 2 })).toBe(
    await trainingPlanDigest({ b: 2, a: 1 }),
  )
  expect(await trainingPlanDigest([1, 2])).not.toBe(
    await trainingPlanDigest([2, 1]),
  )
  expect(await trainingPlanDigest(new Date("2026-09-07"))).not.toBe(
    await trainingPlanDigest(new Date("2026-09-08")),
  )
})

// This fixture proves the database transaction port. The Start adapter suite proves canonical saves.
const live = mysqlTable(
  "plan_test_sessions",
  {
    id: varchar({ length: 64 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    trainingDate: varchar({ length: 10 }).notNull(),
    revision: int().notNull(),
    content: json().$type<unknown>().notNull(),
  },
  (t) => [uniqueIndex("plan_test_day_uq").on(t.userId, t.trainingDate)],
)
type Actor = { userId: string; allowed: boolean }
type Prepared = {
  days: TrainingPlanDocument["days"]
  revisions: number[]
  sourceVersion: number
}

describe.skipIf(!mysqlTestConfig)(
  "durable planning MySQL transaction port",
  () => {
    let admin: Pool
    let pool: Pool
    let db: WodsmithDb
    const databaseName = `training_plans_${randomUUID().replaceAll("-", "")}`
    const actor: Actor = { userId: "athlete", allowed: true }
    let sourceVersion = 1
    let failSecond = false
    let saveCalls = 0
    let saveBarrier: (() => Promise<void>) | undefined
    let service: ReturnType<
      typeof createTrainingPlanService<Actor, unknown, Prepared>
    >

    beforeAll(async () => {
      if (!mysqlTestConfig)
        throw new Error("Disposable MySQL configuration required")
      admin = mysql.createPool(mysqlTestConfig)
      await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
      pool = mysql.createPool({
        ...mysqlTestConfig,
        database: databaseName,
        connectionLimit: 5,
      })
      db = createWodsmithDb(pool)
      const migration = await readFile(
        resolve(
          process.cwd(),
          "../../packages/wodsmith-db/mysql-migrations/0010_training_plans.sql",
        ),
        "utf8",
      )
      for (const statement of migration.split("--> statement-breakpoint"))
        await pool.promise().query(statement)
      await pool
        .promise()
        .query(
          "CREATE TABLE plan_test_sessions (id varchar(64) PRIMARY KEY, user_id varchar(255) NOT NULL, training_date varchar(10) NOT NULL, revision int NOT NULL, content json NOT NULL, UNIQUE KEY plan_test_day_uq(user_id, training_date))",
        )
      service = createTrainingPlanService(db, {
        parseDocument: (value) => schema.parse(value),
        authorize: async (_db, who) => {
          if (!who.allowed) throw new Error("ACCESS_REVOKED")
        },
        prepare: async (connection, who, days) => {
          const revisions = []
          for (const day of days) {
            const [row] = await connection
              .select()
              .from(live)
              .where(
                and(
                  eq(live.userId, who.userId),
                  eq(live.trainingDate, day.trainingDate),
                ),
              )
            revisions.push(row?.revision ?? 0)
          }
          const prepared = { days, revisions, sourceVersion }
          return { prepared, review: prepared }
        },
        validate: async (tx, who, prepared) => {
          if (prepared.sourceVersion !== sourceVersion)
            throw new Error("SOURCE_CHANGED")
          for (const [index, day] of prepared.days.entries()) {
            const [row] = await tx
              .select()
              .from(live)
              .where(
                and(
                  eq(live.userId, who.userId),
                  eq(live.trainingDate, day.trainingDate),
                ),
              )
              .for("update")
            if ((row?.revision ?? 0) !== prepared.revisions[index])
              throw new Error("PREVIEW_STALE")
          }
        },
        save: async (tx, who, prepared) => {
          saveCalls++
          const sessions = []
          for (const [index, day] of prepared.days.entries()) {
            if (index === 1 && failSecond)
              throw new Error("Injected second day failure")
            const next = {
              id: `${who.userId}_${day.trainingDate}`,
              userId: who.userId,
              trainingDate: day.trainingDate,
              revision: prepared.revisions[index]! + 1,
              content: day,
            }
            await tx
              .insert(live)
              .values(next)
              .onDuplicateKeyUpdate({
                set: { revision: next.revision, content: next.content },
              })
            sessions.push({
              id: next.id,
              trainingDate: day.trainingDate,
              revision: next.revision,
            })
          }
          await saveBarrier?.()
          return sessions
        },
      })
    })
    beforeEach(async () => {
      actor.allowed = true
      sourceVersion = 1
      failSecond = false
      saveCalls = 0
      saveBarrier = undefined
      await db.delete(trainingPlanReceiptsTable)
      await db.delete(trainingPlanDraftsTable)
      await db.delete(live)
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
    const proposal = async (value = document()) => {
      const draft = await service.create(actor, value)
      const preview = await service.preview(actor, {
        trainingPlanId: draft.trainingPlanId,
      })
      return {
        trainingPlanId: draft.trainingPlanId,
        expectedRevision: draft.revision,
        previewDigest: preview.previewDigest,
        idempotencyKey: "save-week",
      }
    }

    // @lat: [[training-plans#Verification#Draft Isolation and Resumption]]
    it("resumes questions in another client without creating live sessions and denies other athletes", async () => {
      const value = document()
      value.questions = [
        {
          id: "equipment",
          prompt: "Which equipment?",
          field: "days.0",
          required: true,
          choices: [],
        },
      ]
      const draft = await service.create(actor, value)
      const fetched = await service.get(
        { ...actor },
        { trainingPlanId: draft.trainingPlanId },
      )
      expect(fetched.missingInputs).toHaveLength(1)
      expect(fetched.document).toEqual(value)
      expect(await db.select().from(live)).toHaveLength(0)
      expect(
        (await service.preview(actor, { trainingPlanId: draft.trainingPlanId }))
          .canCommit,
      ).toBe(false)
      await expect(
        service.get(
          { userId: "other", allowed: true },
          { trainingPlanId: draft.trainingPlanId },
        ),
      ).rejects.toThrow("NOT_FOUND")
      await expect(
        service.delete(
          { userId: "other", allowed: true },
          { trainingPlanId: draft.trainingPlanId, expectedRevision: 1 },
        ),
      ).rejects.toThrow("NOT_FOUND")
    })
    // @lat: [[training-plans#Verification#Draft Concurrency and Deletion]]
    it("rejects stale draft writes and deletes only the uncommitted proposal", async () => {
      const draft = await service.create(actor, document())
      const input = {
        trainingPlanId: draft.trainingPlanId,
        expectedRevision: 1,
        document: { ...document(), title: "Changed" },
      }
      const writes = await Promise.allSettled([
        service.update(actor, input),
        service.update(actor, input),
      ])
      expect(writes.filter((v) => v.status === "fulfilled")).toHaveLength(1)
      await expect(
        service.delete(actor, {
          trainingPlanId: draft.trainingPlanId,
          expectedRevision: 1,
        }),
      ).rejects.toThrow("REVISION_CONFLICT")
      await service.delete(actor, {
        trainingPlanId: draft.trainingPlanId,
        expectedRevision: 2,
      })
      await expect(
        service.get(actor, { trainingPlanId: draft.trainingPlanId }),
      ).rejects.toThrow("NOT_FOUND")
      expect(await db.select().from(live)).toHaveLength(0)
    })
    // @lat: [[training-plans#Verification#Atomic Commit and Retry]]
    it("rolls back the whole week after a later day fails and persists one receipt on retry", async () => {
      const value = document()
      value.days.push({
        ...value.days[0]!,
        trainingDate: "2026-09-08",
        intent: "rest",
        items: [],
      })
      const input = await proposal(value)
      failSecond = true
      await expect(service.commit(actor, input)).rejects.toThrow("second day")
      expect(await db.select().from(live)).toHaveLength(0)
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(0)
      expect(
        (await service.get(actor, { trainingPlanId: input.trainingPlanId }))
          .status,
      ).toBe("draft")
      failSecond = false
      const receipt = await service.commit(actor, input)
      expect(receipt.origin).toEqual({ kind: "web" })
      expect(receipt.sessions).toHaveLength(2)
      expect(await service.commit(actor, input)).toEqual(receipt)
      expect(await db.select().from(live)).toHaveLength(2)
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(1)
      await expect(
        service.commit(actor, { ...input, expectedRevision: 2 }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED")
    })
    it("serializes concurrent retries without duplicate canonical saves", async () => {
      const input = await proposal()
      const results = await Promise.all([
        service.commit(actor, input),
        service.commit(actor, input),
      ])
      expect(results[0]).toEqual(results[1])
      expect(saveCalls).toBe(1)
    })

    // @lat: [[training-plans#Verification#Cross Draft Idempotency]]
    it("rolls back a different draft racing for the same key and returns a stable conflict", async () => {
      await db.insert(live).values(
        ["2026-09-07", "2026-09-08"].map((trainingDate) => ({
          id: `${actor.userId}_${trainingDate}`,
          userId: actor.userId,
          trainingDate,
          revision: 1,
          content: [],
        })),
      )
      const first = await proposal()
      const other = document()
      other.days[0]!.trainingDate = "2026-09-08"
      const second = await proposal(other)
      let entered = 0
      let release!: () => void
      const bothSaving = new Promise<void>((resolve) => {
        release = resolve
      })
      saveBarrier = async () => {
        if (++entered === 2) release()
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          await Promise.race([
            bothSaving,
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () =>
                  reject(
                    new Error(
                      "Both independent writes did not reach the receipt race",
                    ),
                  ),
                2000,
              )
            }),
          ])
        } finally {
          clearTimeout(timer)
        }
      }
      const outcomes = await Promise.allSettled([
        service.commit(actor, first),
        service.commit(actor, second),
      ])
      expect(entered).toBe(2)
      expect(
        outcomes.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1)
      const failure = outcomes.find((result) => result.status === "rejected")
      expect(
        failure?.status === "rejected" && failure.reason.message,
      ).toContain("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT")
      expect(
        (await db.select().from(live)).map((row) => row.revision).sort(),
      ).toEqual([1, 2])
      expect(await db.select().from(trainingPlanReceiptsTable)).toHaveLength(1)
    })

    // @lat: [[training-plans#Verification#Portable Draft Discovery]]
    it("lists bounded owner-only pages so a second client can recover a lost create response", async () => {
      const first = await service.create(actor, document())
      const second = await service.create(actor, {
        ...document(),
        title: "Next",
      })
      await service.create(
        { userId: "other", allowed: true },
        { ...document(), title: "Secret" },
      )
      const page = await service.list({ ...actor }, { limit: 1 })
      expect(page.plans).toHaveLength(1)
      const next = await service.list(actor, {
        limit: 1,
        cursor: page.nextCursor!,
      })
      expect(
        new Set(
          [...page.plans, ...next.plans].map((plan) => plan.trainingPlanId),
        ),
      ).toEqual(new Set([first.trainingPlanId, second.trainingPlanId]))
      expect(next.nextCursor).toBeNull()
      expect(
        await service.list({ userId: "empty", allowed: true }, {}),
      ).toEqual({ plans: [], nextCursor: null })
      await expect(
        service.list({ userId: "empty", allowed: false }, {}),
      ).rejects.toThrow("ACCESS_REVOKED")
      await expect(service.list(actor, { limit: 51 })).rejects.toThrow()
    })
    // @lat: [[training-plans#Verification#Stale Review and Revocation]]
    it("rejects changed source previews, changed live days, and revoked write access", async () => {
      const input = await proposal()
      sourceVersion++
      await expect(service.commit(actor, input)).rejects.toThrow(
        "PREVIEW_STALE",
      )
      sourceVersion--
      await db.insert(live).values({
        id: "web-edit",
        userId: actor.userId,
        trainingDate: "2026-09-07",
        revision: 1,
        content: [],
      })
      await expect(service.commit(actor, input)).rejects.toThrow(
        "PREVIEW_STALE",
      )
      actor.allowed = false
      await expect(
        service.preview(actor, { trainingPlanId: input.trainingPlanId }),
      ).rejects.toThrow("ACCESS_REVOKED")
      await expect(service.commit(actor, input)).rejects.toThrow(
        "ACCESS_REVOKED",
      )
      expect(saveCalls).toBe(0)
    })
    it("leaves open days unchanged and blocks unresolved constraints", async () => {
      const value = document()
      value.days.push({
        ...value.days[0]!,
        trainingDate: "2026-09-08",
        intent: "leave_open",
        items: [],
      })
      const input = await proposal(value)
      expect((await service.commit(actor, input)).sessions).toHaveLength(1)
      value.constraints = [
        {
          id: "equipment",
          kind: "equipment",
          description: "Dumbbells only",
          status: "unresolved",
        },
      ]
      const unresolved = await proposal(value)
      await expect(
        service.commit(actor, { ...unresolved, idempotencyKey: "another" }),
      ).rejects.toThrow("MISSING_INPUTS")
    })
  },
)
