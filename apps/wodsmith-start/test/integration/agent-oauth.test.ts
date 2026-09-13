import { readFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { randomUUID } from "node:crypto"
import mysql, { type Pool } from "mysql2"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { userTable, teamTable, teamMembershipTable } from "@repo/wodsmith-db"
import {
  agentOAuthGrantsTable,
  agentOAuthRequestsTable,
} from "@repo/wodsmith-db/schemas/agent-oauth"
import { eq, getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest"
import type { Database } from "@/db"
import { mysqlTestConfig } from "./mysql-test-config"
const state = vi.hoisted(() => ({
  db: undefined as Database | undefined,
  userId: "athlete",
  token: undefined as unknown,
  complete: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: () => state.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromRequestCookie: async () =>
    state.userId ? { userId: state.userId } : null,
}))
vi.mock("@repo/agent-auth/provider", () => ({
  AuthorizationError: class extends Error {},
  oauthProvider: vi.fn(),
  parseAgentAuthorizationRequest: async (
    api: { parseAuthRequest: (r: Request) => Promise<{ scope: string[] }> },
    request: Request,
  ) => {
    const parsed = await api.parseAuthRequest(request)
    return parsed.scope.length
      ? parsed
      : { ...parsed, scope: ["training:read"] }
  },
  oauthApi: () => ({
    unwrapToken: async () => state.token,
    parseAuthRequest: async (request: Request) => ({
      clientId: "client",
      redirectUri: "https://client.example/callback",
      scope: new URL(request.url).searchParams.get("scope")?.split(" ") ?? [
        "training:read",
      ],
      codeChallenge: "challenge",
      codeChallengeMethod: "S256",
      state: "state",
    }),
    lookupClient: async () => ({ clientName: '<script>alert("x")</script>' }),
    completeAuthorization: state.complete,
  }),
}))
import {
  assertLiveAgentGrant,
  consumeConsentRequest,
  digest,
  resolveAgentActor,
} from "@/agent/grants"
import { handleAgentOAuth } from "@/agent/consent"
const config = {
  AGENT_AUTH_ORIGIN: "https://app.example",
  AGENT_RESOURCE: "https://agent.example/mcp",
}
const context = {} as ExecutionContext
const databaseName = `agent_oauth_${randomUUID().replaceAll("-", "")}`
let admin: Pool, pool: Pool, db: Database
async function consent(scopes = "training:read results:delete") {
  const request = new Request(
    `${config.AGENT_AUTH_ORIGIN}/agent/authorize?scope=${encodeURIComponent(scopes)}`,
    { headers: { Cookie: "session=athlete" } },
  )
  const response = await handleAgentOAuth(request, config, context)
  const html = await response!.text()
  const ticket = /name="ticket" value="([^"]+)"/.exec(html)![1]
  return { ticket, html }
}
async function approve(
  ticket: string,
  scopes = ["training:read"],
  teams = ["gym-a"],
  origin = config.AGENT_AUTH_ORIGIN,
  cookie = "session=athlete",
) {
  const body = new URLSearchParams({ ticket, decision: "approve" })
  scopes.forEach((s) => body.append("scope", s))
  teams.forEach((t) => body.append("teamId", t))
  return handleAgentOAuth(
    new Request(`${config.AGENT_AUTH_ORIGIN}/agent/authorize`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }),
    config,
    context,
  )
}
describe.skipIf(!mysqlTestConfig)("OAuth grants and consent on MySQL", () => {
  beforeAll(async () => {
    admin = mysql.createPool(mysqlTestConfig!)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({
      ...mysqlTestConfig,
      database: databaseName,
      connectionLimit: 5,
    })
    db = createWodsmithDb(pool)
    state.db = db
    const casing = new CasingCache("snake_case")
    for (const table of [userTable, teamTable, teamMembershipTable]) {
      const cols = Object.values(getTableColumns(table)).map(
        (c) =>
          `\`${casing.getColumnCasing(c)}\` ${c.getSQLType()} ${c.primary ? "PRIMARY KEY" : "NULL"}`,
      )
      await pool
        .promise()
        .query(`CREATE TABLE \`${getTableName(table)}\` (${cols.join(",")})`)
    }
    const migration = await readFile(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../packages/wodsmith-db/mysql-migrations/0011_agent_oauth_grants.sql",
      ),
      "utf8",
    )
    for (const statement of migration.split("--> statement-breakpoint"))
      await pool.promise().query(statement)
  })
  afterAll(async () => {
    if (pool) await pool.promise().end()
    if (admin) {
      await admin.promise().query(`DROP DATABASE IF EXISTS \`${databaseName}\``)
      await admin.promise().end()
    }
  })
  beforeEach(async () => {
    for (const table of [
      agentOAuthRequestsTable,
      agentOAuthGrantsTable,
      teamMembershipTable,
      teamTable,
      userTable,
    ])
      await pool.promise().query(`DELETE FROM \`${getTableName(table)}\``)
    await db.insert(userTable).values({
      id: "athlete",
      email: "athlete@example.com",
      passwordHash: "old-password-hash",
      authGeneration: 1,
    })
    for (const id of ["gym-a", "gym-b"]) {
      await db.insert(teamTable).values({ id, name: id, slug: id })
      await db.insert(teamMembershipTable).values({
        id,
        userId: "athlete",
        teamId: id,
        roleId: "member",
        isActive: true,
      })
    }
    await db.insert(agentOAuthGrantsTable).values({
      id: "grant",
      userId: "athlete",
      clientId: "client",
      clientName: "Test",
      resource: config.AGENT_RESOURCE,
      scopes: ["training:read", "results:write"],
      allowedTeamIds: ["gym-a"],
      authGeneration: 1,
      credentialDigest: await digest("old-password-hash"),
      expiresAt: new Date(Date.now() + 100000),
    })
    state.userId = "athlete"
    state.token = {
      userId: "athlete",
      expiresAt: Date.now() / 1000 + 100,
      audience: config.AGENT_RESOURCE,
      scope: ["training:read", "results:delete"],
      grant: {
        clientId: "client",
        props: { userId: "athlete", clientId: "client", grantId: "grant" },
      },
    }
    state.complete.mockResolvedValue({
      redirectTo: "https://client.example/callback?code=abc",
    })
  })
  it("intersects token scopes, SQL grant scopes, and current memberships", async () => {
    expect(await resolveAgentActor("token", config)).toEqual({
      userId: "athlete",
      clientId: "client",
      grantId: "grant",
      scopes: ["training:read"],
      allowedTeamIds: ["gym-a"],
    })
    await db
      .update(teamMembershipTable)
      .set({ isActive: false })
      .where(eq(teamMembershipTable.id, "gym-a"))
    expect((await resolveAgentActor("token", config))?.allowedTeamIds).toEqual(
      [],
    )
  })
  it.each(["revoked", "expired", "password", "generation", "deleted-user"])(
    "blocks %s grants despite a still-valid provider token",
    async (attack) => {
      if (attack === "revoked")
        await db.update(agentOAuthGrantsTable).set({ revokedAt: new Date() })
      if (attack === "expired")
        await db.update(agentOAuthGrantsTable).set({ expiresAt: new Date(0) })
      if (attack === "password")
        await db.update(userTable).set({ passwordHash: "new-password" })
      if (attack === "generation")
        await db.update(userTable).set({ authGeneration: 2 })
      if (attack === "deleted-user") await db.delete(userTable)
      expect(await resolveAgentActor("token", config)).toBeNull()
    },
  )
  it("rejects attacker-controlled actor fields and non-exact token audiences", async () => {
    const token = state.token as {
      audience: string
      grant: { props: Record<string, unknown> }
    }
    token.audience = "https://agent.example"
    expect(await resolveAgentActor("token", config)).toBeNull()
    token.audience = config.AGENT_RESOURCE
    token.grant.props.scopes = ["results:delete"]
    expect(await resolveAgentActor("token", config)).toBeNull()
  })
  it("renders escaped consent, grants only selected requested scopes and workspaces", async () => {
    const { ticket, html } = await consent()
    expect(html).not.toContain("<script>")
    expect(html).toContain("&lt;script&gt;")
    expect((await approve(ticket))?.status).toBe(302)
    const rows = await db.select().from(agentOAuthGrantsTable)
    expect(rows.find((r) => r.id !== "grant")).toMatchObject({
      scopes: ["training:read"],
      allowedTeamIds: ["gym-a"],
    })
    expect(state.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ["training:read"],
        props: expect.objectContaining({ userId: "athlete" }),
      }),
    )
    expect((await approve(ticket))?.status).toBe(400)
  })
  it.each(["origin", "cookie", "scope", "team"])(
    "rejects consent %s tampering",
    async (attack) => {
      const { ticket } = await consent("training:read")
      const response = await approve(
        ticket,
        attack === "scope" ? ["results:delete"] : ["training:read"],
        attack === "team" ? ["foreign-gym"] : ["gym-a"],
        attack === "origin" ? "https://evil.example" : config.AGENT_AUTH_ORIGIN,
        attack === "cookie" ? "session=another" : "session=athlete",
      )
      expect([400, 403]).toContain(response?.status)
      expect(state.complete).not.toHaveBeenCalled()
    },
  )
  it("consumes consent exactly once even under concurrent requests", async () => {
    const { ticket } = await consent()
    const results = await Promise.all([
      consumeConsentRequest(ticket, "athlete", await digest("session=athlete")),
      consumeConsentRequest(ticket, "athlete", await digest("session=athlete")),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
  it("cannot finish pre-recovery consent against a new password", async () => {
    const { ticket } = await consent()
    await db.update(userTable).set({ passwordHash: "new-password" })
    expect((await approve(ticket))?.status).toBe(401)
    expect(state.complete).not.toHaveBeenCalled()
  })
  it("revalidates narrowed grants on the transaction connection", async () => {
    const actor = await resolveAgentActor("token", config)
    expect(actor).not.toBeNull()
    await db.update(agentOAuthGrantsTable).set({ scopes: [] })
    await expect(
      db.transaction((tx) => assertLiveAgentGrant(tx, actor!, "training:read")),
    ).rejects.toThrow("NOT_AUTHORIZED")
  })
  it("serializes disconnect behind an already-authorized transaction", async () => {
    const actor = await resolveAgentActor("token", config)
    let release!: () => void
    let acquired!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const ready = new Promise<void>((resolve) => {
      acquired = resolve
    })
    const transaction = db.transaction(async (tx) => {
      await assertLiveAgentGrant(tx, actor!, "training:read")
      acquired()
      await gate
    })
    await ready
    const revoke = db
      .update(agentOAuthGrantsTable)
      .set({ revokedAt: new Date() })
      .where(eq(agentOAuthGrantsTable.id, "grant"))
      .then(() => true)
    try {
      expect(
        await Promise.race([
          revoke,
          new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 50),
          ),
        ]),
      ).toBe(false)
    } finally {
      release()
    }
    await transaction
    await revoke
    expect(await resolveAgentActor("token", config)).toBeNull()
  })
  it("leaves unrelated HTTP untouched when the gateway is disabled or misconfigured", async () => {
    expect(
      await handleAgentOAuth(
        new Request("https://app.example/training"),
        { ...config, AGENT_RESOURCE: "malformed" },
        context,
      ),
    ).toBeNull()
    expect(
      await handleAgentOAuth(
        new Request("https://app.example/agent/authorize"),
        { ...config, AGENT_RESOURCE: "" },
        context,
      ),
    ).toBeNull()
  })
  it("allows only the owner to disconnect a grant", async () => {
    state.userId = "another-user"
    await handleAgentOAuth(
      new Request(`${config.AGENT_AUTH_ORIGIN}/agent/connections`, {
        method: "POST",
        headers: {
          Cookie: "session=another",
          Origin: config.AGENT_AUTH_ORIGIN,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grantId: "grant" }).toString(),
      }),
      config,
      context,
    )
    expect(
      (await db.select().from(agentOAuthGrantsTable))[0].revokedAt,
    ).toBeNull()
  })
})
