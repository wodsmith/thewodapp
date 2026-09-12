import { randomUUID } from "node:crypto"
import { getTableColumns, getTableName } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { programmingTracksTable, teamProgrammingTracksTable, teamTable, teamMembershipTable, userTable } from "@/db/schema"
import { trainingSessionsTable } from "@repo/wodsmith-db/schemas/training"
import { seedAdminTraining } from "../../scripts/seed/admin-training"
import { mysqlTestConfig } from "./mysql-test-config"

const database = `admin_training_test_${randomUUID().replaceAll("-", "")}`
const tables = [userTable, teamTable, teamMembershipTable, programmingTracksTable, teamProgrammingTracksTable, trainingSessionsTable]
let admin: Connection
let client: Connection

describe.skipIf(!mysqlTestConfig)("additive admin training seed", () => {
  beforeAll(async () => {
    if (!mysqlTestConfig) throw new Error("Missing local MySQL configuration")
    admin = await mysql.createConnection(mysqlTestConfig)
    await admin.query(`CREATE DATABASE \`${database}\``)
    client = await mysql.createConnection({ ...mysqlTestConfig, database })
    const casing = new CasingCache("snake_case")
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column) =>
        `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : "NULL"}`,
      )
      await client.query(`CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`)
    }
    await client.query("ALTER TABLE training_sessions ADD UNIQUE INDEX training_session_occurrence_uq (team_id, track_id, training_date)")
  })
  afterAll(async () => {
    await client?.end()
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS \`${database}\``)
      await admin.end()
    }
  })
  beforeEach(async () => {
    for (const table of tables) await client.query(`DELETE FROM \`${getTableName(table)}\``)
    await client.query("INSERT INTO users (id, email) VALUES ('admin', 'admin@example.com')")
    await client.query("INSERT INTO teams (id, name, type, is_personal_team) VALUES ('gym', 'CrossFit Box One', 'gym', 0)")
    await client.query("INSERT INTO team_memberships (id, team_id, user_id, is_active, is_system_role, role_id) VALUES ('membership', 'gym', 'admin', 1, 1, 'owner')")
  })

  // @lat: [[training-seed#Admin Training Seed#Dry-run safety]]
  it("previews the full date range without creating a track, default, or session", async () => {
    expect(await seedAdminTraining(client, { email: "admin@example.com", startDate: "2026-09-12" })).toMatchObject({
      applied: false, teamId: "gym", publishedDays: 61, createDefault: true,
    })
    const [tracks] = await client.query("SELECT * FROM programming_tracks")
    const [sessions] = await client.query("SELECT * FROM training_sessions")
    const [teams] = await client.query<RowDataPacket[]>("SELECT default_track_id FROM teams")
    expect(tracks).toEqual([])
    expect(sessions).toEqual([])
    expect(teams[0].default_track_id).toBeNull()
  })

  // @lat: [[training-seed#Admin Training Seed#Existing programming and retries]]
  it("preserves a coach's draft and makes repeated seeding a no-op", async () => {
    await client.query("INSERT INTO programming_tracks (id, name, type, owner_team_id, is_public) VALUES ('default', 'Gym programming', 'team_owned', 'gym', 0)")
    await client.query("UPDATE teams SET default_track_id = 'default'")
    await client.query(`INSERT INTO training_sessions (id, team_id, track_id, training_date, revision, published_version, draft)
      VALUES ('coach-day', 'gym', 'default', '2026-09-14', 9, 0, '{"title":"Keep my draft"}')`)
    const [before] = await client.query("SELECT * FROM training_sessions WHERE id = 'coach-day'")
    const options = { email: "admin@example.com", startDate: "2026-09-12", apply: true }
    expect(await seedAdminTraining(client, options)).toMatchObject({ publishedDays: 60, preservedDays: 1, createDefault: false })
    expect(await seedAdminTraining(client, options)).toMatchObject({ publishedDays: 0, preservedDays: 61 })
    const [after] = await client.query("SELECT * FROM training_sessions WHERE id = 'coach-day'")
    expect(after).toEqual(before)
    const [published] = await client.query<RowDataPacket[]>("SELECT published FROM training_sessions WHERE published_version = 1")
    expect(published).toHaveLength(60)
  })

  // @lat: [[training-seed#Admin Training Seed#Default creation]]
  it("creates and assigns a team-owned default when none exists", async () => {
    const result = await seedAdminTraining(client, { email: "admin@example.com", startDate: "2026-09-12", apply: true })
    const [rows] = await client.query<RowDataPacket[]>("SELECT t.default_track_id, p.owner_team_id FROM teams t JOIN programming_tracks p ON p.id = t.default_track_id")
    expect(rows).toMatchObject([{ default_track_id: result.trackId, owner_team_id: "gym" }])
    expect(result).toMatchObject({ publishedDays: 61, createDefault: true })
  })

  // @lat: [[training-seed#Admin Training Seed#Source and target boundaries]]
  it("rejects unavailable defaults and unauthorized targets without seeding", async () => {
    await client.query("UPDATE teams SET default_track_id = 'foreign'")
    await expect(seedAdminTraining(client, { email: "admin@example.com", startDate: "2026-09-12", apply: true })).rejects.toThrow("default track is unavailable")
    await expect(seedAdminTraining(client, { email: "outsider@example.com", teamId: "gym", startDate: "2026-09-12", apply: true })).rejects.toThrow("Expected one managed team")
    const [sessions] = await client.query("SELECT * FROM training_sessions")
    expect(sessions).toEqual([])
  })
})
