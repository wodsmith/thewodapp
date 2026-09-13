import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import mysql, { type Pool } from "mysql2"
import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import {
  userTable,
  teamTable,
  teamMembershipTable,
  programmingTracksTable,
  featureTable,
  teamFeatureEntitlementTable,
} from "@repo/wodsmith-db"
import { agentOAuthGrantsTable } from "@repo/wodsmith-db/schemas/agent-oauth"
import { personalTrainingSessionsTable } from "@repo/wodsmith-db/schemas/training-personal"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { agentScopes } from "@repo/agent-auth"
import { workouts, scoreRoundsTable, scalingGroupsTable, scalingLevelsTable, trainingMutationReceiptsTable } from "@repo/wodsmith-db"
import * as grants from "@/agent/grants"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { mysqlTestConfig } from "./mysql-test-config"
const fixture = vi.hoisted(() => ({
  db: undefined as unknown,
  token: undefined as unknown,
}))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("cloudflare:workers", () => ({ WorkerEntrypoint: class {} }))
vi.mock("@repo/agent-auth/provider", () => ({
  oauthApi: () => ({ unwrapToken: async () => fixture.token }),
}))
import { AgentTrainingService } from "@/agent/service"
import { digest } from "@/agent/grants"
import { FEATURES } from "@/config/features"

describe.skipIf(!mysqlTestConfig)(
  "successful private service composition on MySQL",
  () => {
    const databaseName = `agent_service_${randomUUID().replaceAll("-", "")}`
    const config = {
      AGENT_AUTH_ORIGIN: "https://app.example",
      AGENT_RESOURCE: "https://agent.example/mcp",
    }
    let admin: Pool, pool: Pool, db: WodsmithDb, service: AgentTrainingService
    beforeAll(async () => {
      admin = mysql.createPool(mysqlTestConfig!)
      await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
      pool = mysql.createPool({
        ...mysqlTestConfig,
        database: databaseName,
        connectionLimit: 5,
      })
      db = createWodsmithDb(pool)
      fixture.db = db
      const path = resolve(tmpdir(), `${databaseName}.json`)
      try {
        execFileSync(
          "pnpm",
          [
            "exec",
            "tsx",
            "../../packages/wodsmith-db/scripts/export-test-schema.ts",
            path,
          ],
          {
            cwd: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
            timeout: 30000,
          },
        )
        for (const sql of JSON.parse(await readFile(path, "utf8")) as string[])
          await pool.promise().query(sql)
      } finally {
        await unlink(path).catch(() => undefined)
      }
      await db
        .insert(userTable)
        .values({ id: "athlete", passwordHash: "hash", authGeneration: 1 })
      await db
        .insert(teamTable)
        .values({ id: "gym", name: "Gym", slug: "gym", type: "gym" })
      await db
        .insert(teamMembershipTable)
        .values({
          id: "membership",
          teamId: "gym",
          userId: "athlete",
          roleId: "member",
          isActive: true,
        })
      await db
        .insert(programmingTracksTable)
        .values({
          id: "track",
          name: "Daily",
          type: "team_owned",
          ownerTeamId: "gym",
        })
      await db
        .insert(featureTable)
        .values({
          id: "tracking",
          key: FEATURES.WORKOUT_TRACKING,
          name: "Training",
          category: "workouts",
          isActive: 1,
        })
      await db
        .insert(teamFeatureEntitlementTable)
        .values({
          id: "tracking-grant",
          teamId: "gym",
          featureId: "tracking",
          isActive: 1,
        })
      await db
        .insert(agentOAuthGrantsTable)
        .values({
          id: "grant",
          userId: "athlete",
          clientId: "client",
          clientName: "Client",
          resource: config.AGENT_RESOURCE,
          scopes: ["training:read", "training:write"],
          allowedTeamIds: ["gym"],
          authGeneration: 1,
          credentialDigest: await digest("hash"),
          expiresAt: new Date(Date.now() + 60000),
        })
      fixture.token = {
        userId: "athlete",
        expiresAt: Date.now() / 1000 + 60,
        audience: config.AGENT_RESOURCE,
        scope: ["training:read", "training:write"],
        grant: {
          clientId: "client",
          props: { grantId: "grant", userId: "athlete", clientId: "client" },
        },
      }
      service = Object.create(AgentTrainingService.prototype)
      Object.defineProperty(service, "env", { value: config })
    }, 30000)
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
      await db.update(agentOAuthGrantsTable).set({
        revokedAt: null,
        scopes: ["training:read", "training:write"],
        allowedTeamIds: ["gym"],
      }).where(eq(agentOAuthGrantsTable.id, "grant"))
      Object.assign(fixture.token as object, {
        scope: ["training:read", "training:write"],
      })
    })
    // @lat: [[agent-gateway#Successful service integration]]
    it("dispatches live-grant catalogue, canonical reads and plan commit, then rejects revocation", async () => {
      expect(await service.authorize("token")).toBe(true)
      const catalog = await service.listOperations("token")
      expect(catalog.map((tool) => tool.name)).toContain("commit_training_plan")
      const week = await service.execute("token", "get_training_week", {
        teamId: "gym",
        trackId: "track",
        startDate: "2026-09-07",
      })
      expect(week).toMatchObject({ ok: true })
      const created = await service.execute("token", "create_training_plan", {
        blueprintVersion: "general-functional-fitness@1",
        weekStart: "2026-09-07",
        title: "Portable plan",
        days: [
          {
            trainingDate: "2026-09-07",
            accessTeamId: "gym",
            intent: "train",
            items: [
              {
                item: {
                  kind: "personal",
                  id: "reps",
                  block: {
                    id: "reps",
                    kind: "reps",
                    title: "Pull-ups",
                    prescription: "30 pull-ups",
                    scalingGuidance: "",
                    coachGuidance: "",
                  },
                },
                role: "strength",
                estimatedDurationMinutes: 12,
              },
            ],
          },
        ],
        questions: [],
        constraints: [],
        warnings: [],
      })
      expect(created).toMatchObject({ ok: true })
      if (!created.ok) throw new Error(JSON.stringify(created))
      const { trainingPlanId, revision } = created.data
      const preview = await service.execute("token", "preview_training_plan", {
        trainingPlanId,
      })
      expect(preview).toMatchObject({ ok: true, data: { canCommit: true } })
      if (!preview.ok) throw new Error(JSON.stringify(preview))
      const input = {
        trainingPlanId,
        expectedRevision: revision,
        previewDigest: preview.data.previewDigest,
        idempotencyKey: "gateway-integration-commit",
      }
      const committed = await service.execute(
        "token",
        "commit_training_plan",
        input,
      )
      expect(committed).toMatchObject({ ok: true })
      expect(
        await service.execute("token", "commit_training_plan", input),
      ).toEqual(committed)
      expect(
        await db.select().from(personalTrainingSessionsTable).where(eq(personalTrainingSessionsTable.trainingDate, "2026-09-07")),
      ).toHaveLength(1)
      await db
        .update(agentOAuthGrantsTable)
        .set({ revokedAt: new Date() })
        .where(eq(agentOAuthGrantsTable.id, "grant"))
      expect(await service.authorize("token")).toBe(false)
      expect(
        await service.execute("token", "get_training_plan", { trainingPlanId }),
      ).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED" } })
    })
    // @lat: [[agent-gateway#Canonical mutation integration]]
    it("dispatches owned mutations with durable receipts and transaction-time grant checks", async () => {
      await db
        .insert(teamTable)
        .values({
          id: "personal",
          name: "Personal",
          slug: "personal",
          type: "personal",
          isPersonalTeam: true,
          personalTeamOwnerId: "athlete",
        })
      await db
        .insert(teamMembershipTable)
        .values({
          id: "personal-owner",
          teamId: "personal",
          userId: "athlete",
          roleId: "owner",
          isSystemRole: true,
          isActive: true,
        })
      await db
        .update(teamMembershipTable)
        .set({ roleId: "owner", isSystemRole: true })
        .where(eq(teamMembershipTable.id, "membership"))
      await db
        .insert(teamFeatureEntitlementTable)
        .values({
          id: "personal-tracking",
          teamId: "personal",
          featureId: "tracking",
          isActive: 1,
        })
      await db
        .insert(scalingGroupsTable)
        .values({ id: "scaling", title: "Scaling", isSystem: true })
      await db
        .insert(scalingLevelsTable)
        .values({
          id: "rx",
          scalingGroupId: "scaling",
          label: "Rx",
          position: 0,
        })
      await db
        .update(agentOAuthGrantsTable)
        .set({
          revokedAt: null,
          scopes: [...agentScopes],
          allowedTeamIds: ["gym", "personal"],
        })
        .where(eq(agentOAuthGrantsTable.id, "grant"))
      Object.assign(fixture.token as object, { scope: [...agentScopes] })
      const call = async (
        operation: string,
        input: Record<string, unknown>,
      ) => {
        const result = await service.execute("token", operation, input)
        expect(result).toMatchObject({ ok: true })
        if (!result.ok) throw new Error(JSON.stringify(result))
        return result.data
      }
      const catalog = await service.listOperations("token")
      expect(catalog).toHaveLength(27)
      expect(new Set(catalog.map((tool) => tool.name)).size).toBe(27)
      const definition = {
        name: "Gateway intervals",
        description: "Three rounds",
        scheme: "reps",
        scope: "private",
        scoreType: "sum",
        roundsToScore: 3,
        timeCapSeconds: null,
        repsPerRound: null,
        tiebreakScheme: null,
        scalingGroupId: "scaling",
        movementIds: [],
      }
      const createInput = {
        teamId: "personal",
        idempotencyKey: "workout-create",
        workout: definition,
      }
      const [first, retry] = await Promise.all([
        call("create_workout", createInput),
        call("create_workout", createInput),
      ])
      expect(retry).toEqual(first)
      expect(first).toMatchObject({
        receipt: {
          origin: { kind: "agent", clientId: "client", grantId: "grant" },
        },
      })
      const workoutReply = z.object({
        workout: z.object({ id: z.string() }),
        version: z.string(),
        receipt: z.object({ id: z.string() }),
      })
      const created = workoutReply.parse(first)
      expect(
        await db
          .select()
          .from(workouts)
          .where(eq(workouts.id, created.workout.id)),
      ).toHaveLength(1)
      expect(
        await call("get_mutation_receipt", {
          teamId: "personal",
          receiptId: created.receipt.id,
        }),
      ).toMatchObject({ result: first })
      const updated = workoutReply.parse(
        await call("update_workout", {
          ...createInput,
          idempotencyKey: "workout-update",
          workoutId: created.workout.id,
          expectedVersion: created.version,
          workout: { ...definition, name: "Edited intervals" },
        }),
      )
      const entry = {
        kind: "direct",
        value: {
          trainingDate: "2026-09-09",
          itemId: "attempt",
          workoutId: created.workout.id,
          score: "",
          asRx: true,
          roundScores: [{ score: "10" }, { score: "20" }, { score: "30" }],
          notes: "Private result",
        },
      }
      const resultReply = z.object({
        version: z.string(),
        saved: z.object({ score: z.object({ id: z.string() }) }),
      })
      const logged = resultReply.parse(
        await call("create_result", {
          teamId: "personal",
          idempotencyKey: "result-create",
          entry,
        }),
      )
      expect(
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, logged.saved.score.id)),
      ).toHaveLength(3)
      const revised = resultReply.parse(
        await call("update_result", {
          teamId: "personal",
          idempotencyKey: "result-update",
          expectedVersion: logged.version,
          entry: {
            ...entry,
            value: {
              ...entry.value,
              roundScores: [{ score: "11" }, { score: "22" }, { score: "33" }],
            },
          },
        }),
      )
      await call("delete_result", {
        teamId: "personal",
        idempotencyKey: "result-delete",
        expectedVersion: revised.version,
        target: {
          kind: "direct",
          trainingDate: "2026-09-09",
          itemId: "attempt",
        },
      })
      expect(
        await db
          .select()
          .from(scoreRoundsTable)
          .where(eq(scoreRoundsTable.scoreId, logged.saved.score.id)),
      ).toHaveLength(0)
      await call("delete_workout", {
        teamId: "personal",
        idempotencyKey: "workout-delete",
        workoutId: created.workout.id,
        expectedVersion: updated.version,
      })
      expect(
        (
          await db
            .select()
            .from(workouts)
            .where(eq(workouts.id, created.workout.id))
        )[0].archivedAt,
      ).not.toBeNull()
      const block = {
        id: "work",
        kind: "reps",
        title: "Pull-ups",
        prescription: "30 pull-ups",
        scalingGuidance: "",
        coachGuidance: "",
      }
      await call("save_personal_training_day", {
        teamId: "gym",
        idempotencyKey: "personal-day",
        trainingDate: "2026-09-10",
        expectedRevision: 0,
        items: [{ id: "work", kind: "personal", block }],
      })
      const draft = await call("save_programming_draft", {
        teamId: "gym",
        idempotencyKey: "draft",
        trackId: "track",
        trainingDate: "2026-09-11",
        timezone: "UTC",
        expectedRevision: 0,
        content: {
          title: "Training",
          coachNote: "",
          isRestDay: false,
          blocks: [block],
        },
      })
      const { session } = z
        .object({ session: z.object({ id: z.string(), revision: z.number() }) })
        .parse(draft)
      const publish = {
        teamId: "gym",
        idempotencyKey: "publish",
        sessionId: session.id,
        expectedRevision: session.revision,
      }
      await db
        .update(agentOAuthGrantsTable)
        .set({
          scopes: agentScopes.filter(
            (scope) => scope !== "programming:publish",
          ),
        })
        .where(eq(agentOAuthGrantsTable.id, "grant"))
      expect(
        (await service.listOperations("token")).map((tool) => tool.name),
      ).not.toContain("publish_programming")
      expect(
        await service.execute("token", "publish_programming", publish),
      ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } })
      await db
        .update(agentOAuthGrantsTable)
        .set({ scopes: [...agentScopes] })
        .where(eq(agentOAuthGrantsTable.id, "grant"))
      const published = await call("publish_programming", publish)
      expect(published).toMatchObject({ session: { publishedVersion: 1 } })
      expect(await call("publish_programming", publish)).toEqual(published)
      const receiptCount = (
        await db.select().from(trainingMutationReceiptsTable)
      ).length
      const realCheck = grants.assertLiveAgentGrant
      // Schedule revocation after token resolution, inside A's running transaction,
      // before the actual SQL grant lock. Domain services and SQL remain real.
      const check = vi
        .spyOn(grants, "assertLiveAgentGrant")
        .mockImplementationOnce(async (executor, actor, permission) => {
          expect(executor).not.toBe(db)
          await db
            .update(agentOAuthGrantsTable)
            .set({ revokedAt: new Date() })
            .where(eq(agentOAuthGrantsTable.id, "grant"))
          return realCheck(executor, actor, permission)
        })
      expect(
        await service.execute("token", "create_workout", {
          ...createInput,
          idempotencyKey: "revoked-in-flight",
          workout: { ...definition, name: "Revoked create" },
        }),
      ).toMatchObject({ ok: false, error: { code: "NOT_AUTHORIZED" } })
      expect(check).toHaveBeenCalledOnce()
      check.mockRestore()
      expect(
        await db
          .select()
          .from(workouts)
          .where(eq(workouts.name, "Revoked create")),
      ).toHaveLength(0)
      expect(
        await db.select().from(trainingMutationReceiptsTable),
      ).toHaveLength(receiptCount)
      expect(await service.authorize("token")).toBe(false)
    })
  },
)
