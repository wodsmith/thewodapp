import { randomUUID } from "node:crypto"
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
}))
vi.mock("@/db", () => ({ getDb: () => fixture.db }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: async () => fixture.session,
  canSignUp: async () => {},
  createAndStoreSession: (...args: unknown[]) => fixture.login(...args),
  revokeAllUserSessions: (...args: unknown[]) => fixture.revoke(...args),
}))
vi.mock("@/utils/email", () => ({
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
})
