import { createHash, randomUUID } from "node:crypto"
import mysql, { type RowDataPacket } from "mysql2/promise"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import globalSetup from "../../e2e/global-setup"
import { verifyPreparedCrewDatabase } from "../../e2e/fixtures/prepared-database"

const databaseUrl = process.env.CREW_TEST_DATABASE_URL
const fixtureDatabase = `crew_prepared_${randomUUID().replaceAll("-", "")}_test`
let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined
let fixtureUrl: string
let createdFixture = false

// @lat: [[crew#Prepared Crew real database preserves seeded data]]
describe.skipIf(!databaseUrl)("prepared Crew database integration", () => {
  beforeAll(async () => {
    // Validate the caller-supplied endpoint before creating any test-owned state.
    await verifyPreparedCrewDatabase(databaseUrl, "true")
    const url = new URL(databaseUrl!)
    connection = await mysql.createConnection({ uri: databaseUrl! })
    await connection.execute(`CREATE DATABASE \`${fixtureDatabase}\``)
    createdFixture = true
    url.pathname = `/${fixtureDatabase}`
    fixtureUrl = url.toString()
    await connection.execute(`CREATE TABLE \`${fixtureDatabase}\`.competition_invites (
      championship_competition_id varchar(64) NOT NULL, email varchar(255) NOT NULL,
      championship_division_id varchar(64) NOT NULL, active_marker varchar(8) NOT NULL,
      UNIQUE KEY competition_invites_active_invite_idx (championship_competition_id, email, championship_division_id, active_marker)
    )`)
    await connection.execute(
      `INSERT INTO \`${fixtureDatabase}\`.competition_invites VALUES (?, ?, ?, ?)`,
      ["fixture", "fixture@example.com", "division", "active"],
    )
  })
  afterAll(async () => {
    if (!connection) return
    try {
      if (createdFixture)
        await connection.execute(`DROP DATABASE \`${fixtureDatabase}\``)
    } finally {
      await connection.end()
    }
  })
  it("runs the actual prepared global setup without changing any seeded table", async () => {
    const [tables] = await connection!.execute<RowDataPacket[]>(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME",
    )
    const names = tables
      .map((row) => `\`${String(row.name).replaceAll("`", "``")}\``)
      .join(", ")
    async function digest() {
      const [rows] = await connection!.query<RowDataPacket[]>(
        `CHECKSUM TABLE ${names} EXTENDED`,
      )
      expect(rows).toHaveLength(tables.length)
      const normalizedRows = rows.map((row) => {
        const checksum: unknown = row.Checksum
        let normalized: string
        if (
          typeof checksum === "number" &&
          Number.isSafeInteger(checksum) &&
          checksum >= 0
        ) {
          normalized = String(checksum)
        } else if (
          typeof checksum === "string" &&
          checksum.length > 0 &&
          !/\D/.test(checksum)
        ) {
          normalized = BigInt(checksum).toString()
        } else {
          throw new Error(
            "CHECKSUM TABLE returned an invalid or unavailable checksum",
          )
        }
        return { ...row, Checksum: normalized }
      })
      return createHash("sha256")
        .update(JSON.stringify(normalizedRows))
        .digest("hex")
    }
    const before = await digest()
    const prior = {
      CI: process.env.CI,
      DATABASE_URL: process.env.DATABASE_URL,
      CREW_E2E_DB_PREPARED: process.env.CREW_E2E_DB_PREPARED,
    }
    try {
      process.env.CI = "true"
      process.env.DATABASE_URL = databaseUrl
      process.env.CREW_E2E_DB_PREPARED = "1"
      await globalSetup()
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
    expect(await digest()).toBe(before)
  })
  it("rejects a missing index on a separate fixture and preserves its row after restoration", async () => {
    await verifyPreparedCrewDatabase(fixtureUrl, "true")
    const [before] = await connection!.query(
      `SELECT * FROM \`${fixtureDatabase}\`.competition_invites`,
    )
    await connection!.execute(
      `ALTER TABLE \`${fixtureDatabase}\`.competition_invites DROP INDEX competition_invites_active_invite_idx`,
    )
    try {
      await expect(
        verifyPreparedCrewDatabase(fixtureUrl, "true"),
      ).rejects.toThrow("missing the exact unique")
    } finally {
      await connection!.execute(
        `ALTER TABLE \`${fixtureDatabase}\`.competition_invites ADD UNIQUE INDEX competition_invites_active_invite_idx (championship_competition_id, email, championship_division_id, active_marker)`,
      )
    }
    await verifyPreparedCrewDatabase(fixtureUrl, "true")
    const [after] = await connection!.query(
      `SELECT * FROM \`${fixtureDatabase}\`.competition_invites`,
    )
    expect(after).toEqual(before)
  })
})
