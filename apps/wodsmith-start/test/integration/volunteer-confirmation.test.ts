import { createHash, randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath, URL as NodeURL } from "node:url"
import { createWodsmithDb } from "@repo/wodsmith-db/mysql"
import { getTableColumns, getTableName } from "drizzle-orm"
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
import {
  competitionsTable,
  passKeyCredentialTable,
  teamInvitationTable,
  teamMembershipTable,
  teamTable,
  userTable,
  volunteerSignupIntentsTable,
} from "@/db/schema"
import { volunteerRegistrationAnswersTable } from "@/db/schemas/competitions"
import { waiversTable, waiverSignaturesTable } from "@/db/schemas/waivers"
import { mysqlTestConfig } from "./mysql-test-config"

const fixture = vi.hoisted(() => ({
  db: undefined as Database | undefined,
  session: null as unknown,
  mail: vi.fn(),
  login: vi.fn(),
  revoke: vi.fn(),
  hash: vi.fn(),
  kv: new Map<string, string>(),
}))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/utils/auth")>(),
  getSessionFromCookie: async () => fixture.session,
  canSignUp: async () => {},
  createAndStoreSession: (...args: unknown[]) => fixture.login(...args),
  revokeAllUserSessions: (...args: unknown[]) => fixture.revoke(...args),
}))
vi.mock("cloudflare:workers", () => ({ env: { KV_SESSION: {
  get: async (key: string) => fixture.kv.get(key) ?? null,
  put: async (key: string, value: string) => { fixture.kv.set(key, value) },
  delete: async (key: string) => { fixture.kv.delete(key) },
  list: async () => ({ keys: [], list_complete: true }),
} } }))
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(), setCookie: vi.fn(), getRequestHeaders: () => new Headers(),
}))
vi.mock("@/server/entitlements", () => ({ getUserEntitlements: async () => [], getTeamPlan: async () => undefined }))
vi.mock("@/utils/validate-captcha", () => ({ validateTurnstileToken: async () => true }))
vi.mock("@/utils/password-hasher", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/utils/password-hasher")>(),
  hashPassword: (...args: unknown[]) => fixture.hash(...args),
}))
vi.mock("@/utils/email", () => ({
  sendVerificationEmail: vi.fn(),
  sendVolunteerSignupConfirmationEmail: (...args: unknown[]) =>
    fixture.mail(...args),
}))
vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
    inputValidator: (parse: (input: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => Promise<unknown>) =>
        (ctx: { data: unknown }) =>
          fn({ data: parse(ctx.data) }),
    }),
  }),
}))
import {
  confirmVolunteerSignupFn,
  createAccountAndApplyAsVolunteerFn,
  submitVolunteerSignupFn,
} from "@/server-fns/volunteer-fns"

const databaseName = `volunteer_test_${randomUUID().replaceAll("-", "")}`
const tables = [
  userTable,
  teamTable,
  teamMembershipTable,
  teamInvitationTable,
  competitionsTable,
  passKeyCredentialTable,
  volunteerRegistrationAnswersTable,
  waiversTable,
  waiverSignaturesTable,
]
let admin: Pool
let pool: Pool
const input = {
  firstName: "Jane",
  lastName: "Doe",
  signupName: "Jane Doe",
  signupEmail: "owned@example.com",
  competitionTeamId: "team_competition",
  availability: "afternoon" as const,
  signupPhone: "555-0100",
  credentials: "L1",
  availabilityNotes: "Available after lunch",
  answers: [{ questionId: "question_shirt", answer: "Medium" }],
  waiverIds: ["waiv_terms"],
  password: "AttackerPassword123",
}
async function query(sql: string, values: unknown[] = []) {
  const [rows] = await pool.promise().query<RowDataPacket[]>(sql, values)
  return rows
}
async function request() {
  await createAccountAndApplyAsVolunteerFn({ data: input })
  return fixture.mail.mock.calls.at(-1)![0].code as string
}
async function redeem(code: string) {
  return confirmVolunteerSignupFn({ data: { code } })
}
async function seedUser(verified = false) {
  await query(
    "INSERT INTO users (id,email,first_name,last_name,password_hash,email_verified) VALUES ('usr_owner','owned@example.com','Existing','Owner','preseeded-hash',?)",
    [verified ? new Date() : null],
  )
  await query(
    "INSERT INTO passkey_credentials (id,user_id,credential_id) VALUES ('passkey_attacker','usr_owner','attacker-key')",
  )
}

describe.skipIf(!mysqlTestConfig)("volunteer confirmation on MySQL", () => {
  beforeAll(async () => {
    if (!mysqlTestConfig)
      throw new Error("Explicit local MySQL configuration required")
    admin = mysql.createPool(mysqlTestConfig)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({
      ...mysqlTestConfig,
      database: databaseName,
      connectionLimit: 6,
    })
    fixture.db = createWodsmithDb(pool)
    const casing = new CasingCache("snake_case")
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column) => {
        const defaultSql = ["string", "number", "boolean"].includes(
          typeof column.default,
        )
          ? ` DEFAULT ${mysql.escape(column.default)}`
          : ""
        return `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : "NULL"}${defaultSql}`
      })
      // The production migration adds this column to existing users.
      if (table === userTable) columns.splice(columns.findIndex((column) => column.startsWith("`auth_generation`")), 1)
      if (table === userTable)
        columns.push("UNIQUE KEY users_email_unique (email)")
      await query(
        `CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`,
      )
    }
    // Execute the actual intent-table migration, preserving its unique token hash.
    const migration = readFileSync(
      fileURLToPath(
        new NodeURL(
          "../../../../packages/wodsmith-db/mysql-migrations/0008_volunteer_signup_intents.sql",
          import.meta.url,
        ),
      ),
      "utf8",
    )
    for (const statement of migration.split("--> statement-breakpoint"))
      if (statement.trim()) await query(statement)
  })
  afterAll(async () => {
    if (pool) await pool.promise().end()
    if (admin) {
      await admin.promise().query(`DROP DATABASE \`${databaseName}\``)
      await admin.promise().end()
    }
  })
  beforeEach(async () => {
    fixture.session = null
    fixture.kv.clear()
    fixture.hash.mockReset().mockImplementation(async (data) => (await vi.importActual<typeof import("@/utils/password-hasher")>("@/utils/password-hasher")).hashPassword(data))
    fixture.mail.mockReset().mockResolvedValue(undefined)
    fixture.login.mockReset().mockResolvedValue(undefined)
    fixture.revoke.mockReset().mockResolvedValue(undefined)
    for (const table of [...tables, volunteerSignupIntentsTable])
      await query(`DELETE FROM \`${getTableName(table)}\``)
    await query(
      "INSERT INTO competitions (id,competition_team_id,competition_type,slug,name) VALUES ('comp_owned','team_competition','in-person','owned-event','Owned Event')",
    )
    await query(
      "INSERT INTO waivers (id,competition_id,required_for_volunteers) VALUES ('waiv_terms','comp_owned',1)",
    )
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#No premature identity changes]]
  it.each([false, true])(
    "stores only intent before proof for existing account verified=%s",
    async (verified) => {
      await seedUser(verified)
      const before = await query("SELECT * FROM users")
      const response = await createAccountAndApplyAsVolunteerFn({ data: input })
      expect(await query("SELECT * FROM users")).toEqual(before)
      expect(response).toEqual({ success: true, requiresVerification: true })
      const code = fixture.mail.mock.calls.at(-1)![0].code
      for (const table of [
        teamInvitationTable,
        teamMembershipTable,
        volunteerRegistrationAnswersTable,
        waiverSignaturesTable,
      ])
        expect(
          await query(`SELECT * FROM \`${getTableName(table)}\``),
        ).toHaveLength(0)
      expect(fixture.login).not.toHaveBeenCalled()
      expect(fixture.revoke).not.toHaveBeenCalled()
      const [intent] = await query("SELECT * FROM volunteer_signup_intents")
      expect(intent.code_hash).not.toBe(code)
      expect(JSON.stringify(intent)).not.toContain(input.password)
      expect(intent.consumed_at).toBeNull()
    },
  )

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Unverified credential takeover]]
  it("clears preseeded credentials, revokes sessions, then signs in with email proof", async () => {
    await seedUser()
    const code = await request()
    await redeem(code)
    const [user] = await query("SELECT * FROM users")
    expect(user.password_hash).toBeNull()
    expect(user.email_verified).toBeInstanceOf(Date)
    expect(await query("SELECT * FROM passkey_credentials")).toHaveLength(0)
    expect(fixture.revoke).toHaveBeenCalledWith("usr_owner")
    expect(fixture.login).toHaveBeenCalledWith(
      "usr_owner",
      "email-link",
      undefined,
      expect.any(Number),
      1,
    )
    expect(fixture.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      fixture.login.mock.invocationCallOrder[0],
    )
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Verified credential preservation]]
  it("preserves verified credentials and the complete saved application", async () => {
    await seedUser(true)
    const before = await query("SELECT * FROM users")
    const result = await redeem(await request())
    expect(await query("SELECT * FROM users")).toEqual(before)
    expect(await query("SELECT * FROM passkey_credentials")).toHaveLength(1)
    expect(fixture.revoke).not.toHaveBeenCalled()
    const [application] = await query("SELECT * FROM team_invitations")
    expect(JSON.parse(application.metadata)).toMatchObject({
      signupPhone: input.signupPhone,
      signupName: input.signupName,
      availability: input.availability,
      credentials: input.credentials,
      availabilityNotes: input.availabilityNotes,
      status: "pending",
    })
    expect(
      await query("SELECT answer FROM volunteer_registration_answers"),
    ).toEqual([expect.objectContaining({ answer: "Medium" })])
    expect(
      await query("SELECT waiver_id,user_id FROM waiver_signatures"),
    ).toEqual([
      expect.objectContaining({
        waiver_id: "waiv_terms",
        user_id: "usr_owner",
      }),
    ])
    expect(result.returnPath).toBe("/compete/owned-event/volunteer")
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#New account proof]]
  it("creates a passwordless verified account only after mailbox proof", async () => {
    const code = await request()
    expect(await query("SELECT * FROM users")).toHaveLength(0)
    await redeem(code)
    expect(
      await query("SELECT password_hash,email_verified FROM users"),
    ).toEqual([
      expect.objectContaining({
        password_hash: null,
        email_verified: expect.any(Date),
      }),
    ])
    expect(await query("SELECT * FROM team_memberships")).toHaveLength(1)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Atomic concurrent redemption]]
  it("allows one concurrent redemption and never revives proof when an application is deleted", async () => {
    await seedUser()
    const code = await request()
    const results = await Promise.allSettled([redeem(code), redeem(code)])
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1)
    expect(fixture.login).toHaveBeenCalledTimes(1)
    expect(await query("SELECT * FROM team_invitations")).toHaveLength(1)
    await query("DELETE FROM team_invitations")
    await expect(redeem(code)).rejects.toThrow("already used")
    expect(fixture.login).toHaveBeenCalledTimes(1)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Concurrent application intents]]
  it("serializes distinct links for the same account and competition without duplicate applications", async () => {
    await seedUser(true)
    const first = await request(),
      second = await request()
    const results = await Promise.allSettled([redeem(first), redeem(second)])
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1)
    expect(await query("SELECT * FROM team_invitations")).toHaveLength(1)
    expect(fixture.login).toHaveBeenCalledTimes(1)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Concurrent new identities]]
  it("creates only one account when two new-account intents race on the same email", async () => {
    const first = await request(),
      second = await request()
    const results = await Promise.allSettled([redeem(first), redeem(second)])
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1)
    expect(await query("SELECT * FROM users")).toHaveLength(1)
    expect(await query("SELECT * FROM team_invitations")).toHaveLength(1)
    expect(fixture.login).toHaveBeenCalledTimes(1)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Session failure boundary]]
  it("issues no email-link session if old-session revocation fails after completion", async () => {
    await seedUser()
    const code = await request()
    fixture.revoke.mockRejectedValue(new Error("Revocation unavailable"))
    await expect(redeem(code)).rejects.toThrow("Revocation unavailable")
    expect(fixture.login).not.toHaveBeenCalled()
    expect(
      (await query("SELECT password_hash,email_verified FROM users"))[0],
    ).toMatchObject({ password_hash: null, email_verified: expect.any(Date) })
    expect(await query("SELECT * FROM team_invitations")).toHaveLength(1)
    await expect(redeem(code)).rejects.toThrow("already used")
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Invalid confirmation proofs]]
  it.each(["expired", "purpose", "email", "account", "unknown"])(
    "rejects %s proof without mutations",
    async (reason) => {
      await seedUser()
      const code = await request()
      if (reason === "expired")
        await query(
          "UPDATE volunteer_signup_intents SET expires_at = '2020-01-01'",
        )
      if (reason === "purpose")
        await query(
          "UPDATE volunteer_signup_intents SET purpose = 'password-reset'",
        )
      if (reason === "email")
        await query(
          "UPDATE volunteer_signup_intents SET email = 'someone-else@example.com'",
        )
      if (reason === "account")
        await query("UPDATE volunteer_signup_intents SET user_id = 'usr_other'")
      await expect(
        redeem(reason === "unknown" ? "a".repeat(32) : code),
      ).rejects.toThrow()
      expect(
        (await query("SELECT password_hash,email_verified FROM users"))[0],
      ).toMatchObject({ password_hash: "preseeded-hash", email_verified: null })
      expect(await query("SELECT * FROM team_invitations")).toHaveLength(0)
      expect(fixture.login).not.toHaveBeenCalled()
    },
  )

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Different signed-in identity]]
  it("rejects a different signed-in user without consuming the email owner's link", async () => {
    await seedUser()
    const code = await request()
    fixture.session = {
      userId: "usr_other",
      user: { email: "other@example.com", emailVerified: new Date() },
    }
    await expect(redeem(code)).rejects.toThrow("Sign out")
    expect(
      (await query("SELECT consumed_at FROM volunteer_signup_intents"))[0]
        .consumed_at,
    ).toBeNull()
    fixture.session = null
    fixture.kv.clear()
    fixture.hash.mockReset().mockImplementation(async (data) => (await vi.importActual<typeof import("@/utils/password-hasher")>("@/utils/password-hasher")).hashPassword(data))
    await redeem(code)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Atomic completion rollback]]
  it("rolls back verification, credential clearing and token use if application completion fails", async () => {
    await seedUser()
    const code = await request()
    await query(
      "INSERT INTO waivers (id,competition_id,required_for_volunteers) VALUES ('waiv_new','comp_owned',1)",
    )
    await expect(redeem(code)).rejects.toThrow("agree to all required waivers")
    expect(
      (await query("SELECT email_verified,password_hash FROM users"))[0],
    ).toMatchObject({ email_verified: null, password_hash: "preseeded-hash" })
    expect(await query("SELECT * FROM passkey_credentials")).toHaveLength(1)
    expect(
      (await query("SELECT consumed_at FROM volunteer_signup_intents"))[0]
        .consumed_at,
    ).toBeNull()
    expect(fixture.login).not.toHaveBeenCalled()
    await query("DELETE FROM waivers WHERE id = 'waiv_new'")
    await redeem(code)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Verified direct application]]
  it("keeps direct submission for verified owners and rejects forged email or unverified sessions", async () => {
    await seedUser(true)
    fixture.session = {
      userId: "usr_owner",
      user: { email: input.signupEmail, emailVerified: new Date() },
    }
    await expect(
      submitVolunteerSignupFn({
        data: { ...input, signupEmail: "other@example.com" },
      }),
    ).rejects.toThrow("match")
    await submitVolunteerSignupFn({ data: input })
    expect(await query("SELECT * FROM team_invitations")).toHaveLength(1)
    expect(fixture.mail).not.toHaveBeenCalled()
    fixture.session = {
      userId: "usr_owner",
      user: { email: input.signupEmail, emailVerified: null },
    }
    await expect(submitVolunteerSignupFn({ data: input })).rejects.toThrow(
      "Verify",
    )
  })
  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Durable cross-app session revocation]]
  it("blocks stale browser, bearer and Crew sessions plus profile mutation even when KV revocation fails", async () => {
    await seedUser()
    const auth = await vi.importActual<typeof import("@/utils/auth")>("@/utils/auth")
    const crewAuth = await import("../../../crew/src/utils/auth")
    const { getSessionFromBearer } = await import("@/utils/bearer-auth")
    const { updateKVSession } = await import("@/utils/kv-session")
    const { updateUserProfileFn } = await import("@/server-fns/profile-fns")
    const { updateUserProfileFn: updateCrewProfile } = await import("../../../crew/src/server-fns/profile-fns")
    const { SESSION_COOKIE_NAME } = await import("@/constants")
    const sessionId = createHash("sha256").update("attacker-token").digest("hex")
    const key = `session:usr_owner:${sessionId}`
    const cachedUser = (await fixture.db!.query.userTable.findFirst())!
    fixture.kv.set(key, JSON.stringify({
      id: sessionId, userId: "usr_owner", createdAt: Date.now(), expiresAt: Date.now() + 60_000,
      authenticationType: "passkey", authenticationGeneration: 0, version: 7, user: cachedUser,
    }))
    const browser = new Request("https://wodsmith.test", { headers: { Cookie: `${SESSION_COOKIE_NAME}=usr_owner:attacker-token` } })
    const bearer = new Request("https://wodsmith.test", { headers: { Authorization: "Bearer usr_owner:attacker-token" } })
    expect(await auth.getSessionFromRequestCookie(browser)).not.toBeNull()
    expect(await crewAuth.getSessionFromRequestCookie(browser)).not.toBeNull()
    const code = await request()
    fixture.revoke.mockRejectedValue(new Error("Revocation unavailable"))
    await expect(redeem(code)).rejects.toThrow("Revocation unavailable")
    expect((await query("SELECT auth_generation FROM users"))[0].auth_generation).toBe(1)
    // No KV writes or deletes: both session and missing cutoff are stale.
    expect(fixture.kv.has(key)).toBe(true)
    expect(await auth.getSessionFromRequestCookie(browser)).toBeNull()
    expect(await crewAuth.getSessionFromRequestCookie(browser)).toBeNull()
    expect(await getSessionFromBearer(bearer)).toBeNull()
    expect(await updateKVSession(sessionId, "usr_owner", new Date(Date.now() + 60_000))).toBeNull()
    fixture.session = await auth.getSessionFromRequestCookie(browser)
    await expect(updateUserProfileFn({ data: { firstName: "Attacker", lastName: "Changed" } })).rejects.toThrow("Not authenticated")
    fixture.session = await crewAuth.getSessionFromRequestCookie(browser)
    await expect(updateCrewProfile({ data: { firstName: "Attacker", lastName: "Changed" } })).rejects.toThrow("Not authenticated")
    expect((await query("SELECT first_name FROM users"))[0].first_name).toBe("Jane")
    // Intent/application retention cannot resurrect authentication.
    await query("DELETE FROM volunteer_signup_intents")
    await query("DELETE FROM team_invitations")
    expect(await auth.getSessionFromRequestCookie(browser)).toBeNull()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Proof generation and legacy sessions]]
  it("rejects delayed old proof and legacy sessions but accepts the committed mailbox generation in the same millisecond", async () => {
    await seedUser()
    const auth = await vi.importActual<typeof import("@/utils/auth")>("@/utils/auth")
    const { getKVSession, updateKVSession } = await import("@/utils/kv-session")
    const { createSession: createCrewSession } = await import("../../../crew/src/utils/auth")
    const now = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(now)
    const old = await auth.createSession({ token: "legacy", userId: "usr_owner", authenticationType: "passkey" })
    const key = `session:usr_owner:${old.id}`
    const legacy = { ...old, authenticationGeneration: undefined, createdAt: undefined }
    fixture.kv.set(key, JSON.stringify(legacy))
    expect(await getKVSession(old.id, "usr_owner")).not.toBeNull()
    const code = await request()
    await redeem(code)
    expect(await getKVSession(old.id, "usr_owner")).toBeNull()
    for (const authenticationType of ["password", "passkey"] as const) {
      await expect(auth.createSession({ token: `late-${authenticationType}`, userId: "usr_owner", authenticationType, authenticationGeneration: 0, authenticatedAt: now + 1_000 })).rejects.toThrow("Authentication changed")
      await expect(createCrewSession({ token: `crew-late-${authenticationType}`, userId: "usr_owner", authenticationType, authenticationGeneration: 0 })).rejects.toThrow("Authentication changed")
    }
    // A fresh mailbox proof has generation 1; wall-clock boundaries do not decide ownership.
    const owner = await auth.createSession({ token: "mailbox-owner", userId: "usr_owner", authenticationType: "email-link", authenticationGeneration: 1, authenticatedAt: now })
    expect(await getKVSession(owner.id, "usr_owner")).toMatchObject({ authenticationGeneration: 1 })
    expect(await updateKVSession(owner.id, "usr_owner", new Date(now + 60_000))).toMatchObject({ authenticationGeneration: 1, createdAt: now })
    expect(await getKVSession(old.id, "usr_owner")).toBeNull()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Confirmation request cache boundary]]
  it("clears the confirming account's request cache even if revocation fails", async () => {
    await seedUser()
    const auth = await vi.importActual<typeof import("@/utils/auth")>("@/utils/auth")
    const { getCookie } = await import("@tanstack/react-start/server")
    const { env } = await import("cloudflare:workers")
    const old = await auth.createSession({ token: "cached-attacker", userId: "usr_owner" })
    vi.mocked(getCookie).mockReturnValue("usr_owner:cached-attacker")
    const code = await request()
    fixture.revoke.mockImplementation(auth.revokeAllUserSessions)
    vi.spyOn(env.KV_SESSION, "put").mockRejectedValue(new Error("KV unavailable"))
    await auth.withSessionCache(async () => {
      fixture.session = await auth.getSessionFromCookie()
      expect(fixture.session).toMatchObject({ id: old.id })
      await expect(redeem(code)).rejects.toThrow("KV unavailable")
      expect(await auth.getSessionFromCookie()).toBeNull()
    })
    expect(await auth.withSessionCache(auth.getSessionFromCookie)).toBeNull()
    expect(fixture.login).not.toHaveBeenCalled()
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Additive migration deployment boundary]]
  it("preserves existing accounts with generation zero and fails closed before migration", async () => {
    const { getUserAuthGeneration } = await import("@/utils/kv-session")
    await query("ALTER TABLE users DROP COLUMN auth_generation")
    try {
      await seedUser(true)
      await expect(getUserAuthGeneration("usr_owner")).rejects.toThrow("Unknown column")
    } finally {
      const migration = readFileSync(fileURLToPath(new NodeURL("../../../../packages/wodsmith-db/mysql-migrations/0008_volunteer_signup_intents.sql", import.meta.url)), "utf8")
      await query(migration.split("--> statement-breakpoint").find((statement) => statement.includes("ALTER TABLE `users`"))!)
    }
    expect(await getUserAuthGeneration("usr_owner")).toBe(0)
    expect((await query("SELECT password_hash, email_verified FROM users"))[0]).toMatchObject({ password_hash: "preseeded-hash", email_verified: expect.any(Date) })
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#Credential mutation claim race]]
  it.each(["wodsmith", "crew"].flatMap((app) => ["signup", "claim", "reset"].map((action) => ({ app, action }))))("prevents $app $action credential writes after confirmation commits", async ({ app, action }) => {
    await seedUser()
    if (action !== "reset") await query("UPDATE users SET password_hash = NULL")
    const endpoint = app === "wodsmith" ? await import("@/server-fns/auth-fns") : await import("../../../crew/src/server-fns/auth-fns")
    const { getClaimTokenKey, getResetTokenKey } = await import("@/utils/auth-utils")
    const token = "earlier-mailbox-token"
    fixture.kv.set(action === "reset" ? getResetTokenKey(token) : getClaimTokenKey(token), JSON.stringify({ userId: "usr_owner", expiresAt: new Date(Date.now() + 60_000).toISOString() }))
    const code = await request()
    let resume!: () => void, started!: () => void
    const blocked = new Promise<void>((resolve) => { resume = resolve })
    const reading = new Promise<void>((resolve) => { started = resolve })
    fixture.hash.mockImplementationOnce(async () => { started(); await blocked; return "attacker-restored-hash" })
    const attempt = action === "reset"
      ? endpoint.resetPasswordFn({ data: { token, password: "AttackerPassword123", confirmPassword: "AttackerPassword123" } })
      : endpoint.signUpFn({ data: { email: input.signupEmail, firstName: "Attacker", lastName: "Changed", password: "AttackerPassword123", ...(action === "claim" ? { claimToken: token } : {}) } })
    const rejected = expect(attempt).rejects.toThrow("Account changed")
    await reading
    try { await redeem(code) } finally { resume() }
    await rejected
    expect((await query("SELECT password_hash,auth_generation,first_name FROM users"))[0]).toMatchObject({ password_hash: null, auth_generation: 1, first_name: "Jane" })
    expect(await query("SELECT * FROM passkey_credentials")).toHaveLength(0)
  })

  // @lat: [[volunteer-confirmation#Volunteer email confirmation#New signup mailbox boundary]]
  it.each(["wodsmith", "crew"])("does not let anonymous %s signup manufacture a verified identity", async (app) => {
    const endpoint = app === "wodsmith" ? await import("@/server-fns/auth-fns") : await import("../../../crew/src/server-fns/auth-fns")
    const { sendVerificationEmail } = await import("@/utils/email")
    const { getVerificationTokenKey } = await import("@/utils/auth-utils")
    const result = await endpoint.signUpFn({ data: { email: input.signupEmail, firstName: "Attacker", lastName: "Seeded", password: "AttackerPassword123" } })
    expect(result.requiresVerification).toBe(true)
    expect((await query("SELECT email_verified, auth_generation FROM users"))[0]).toMatchObject({ email_verified: null, auth_generation: 0 })
    expect(fixture.login).not.toHaveBeenCalled()
    await expect(endpoint.signInFn({ data: {email: input.signupEmail, password: "AttackerPassword123"} })).rejects.toThrow("Invalid email or password")
    const proof = vi.mocked(sendVerificationEmail).mock.calls.at(-1)![0]
    expect(proof.email).toBe(input.signupEmail)
    expect(fixture.kv.has(getVerificationTokenKey(proof.verificationToken))).toBe(true)
    expect(JSON.stringify(result)).not.toContain(proof.verificationToken)
    await redeem(await request())
    expect((await query("SELECT password_hash, auth_generation FROM users"))[0]).toMatchObject({ password_hash: null, auth_generation: 1 })
  })

})
