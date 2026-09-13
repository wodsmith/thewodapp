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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
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
        await db.select().from(personalTrainingSessionsTable),
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
  },
)
