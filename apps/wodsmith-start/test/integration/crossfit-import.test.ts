import { readFileSync } from "node:fs"
import { fileURLToPath, URL as NodeURL } from "node:url"
import { createWodsmithDb, type WodsmithDb } from "@repo/wodsmith-db/mysql"
import { getTableColumns, getTableName, eq } from "drizzle-orm"
import { CasingCache } from "drizzle-orm/casing"
import mysql, { type Pool } from "mysql2"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { externalWorkoutImportsTable as imports, externalWorkoutImportItemsTable as items, programmingTracksTable, trackWorkoutsTable, workouts } from "@/db/schema"
import { appendCrossFitWorkout } from "@/server/append-crossfit-workout"
import { beginCrossFitImport, getPublishedCrossFitDays, publishCrossFitImport, snapshotCrossFitImport } from "@/server/crossfit-import"
import { CROSSFIT_OWNER_TEAM_ID, CROSSFIT_TRACK_ID, parseCrossFitResponse } from "@/lib/crossfit/source"
import { mysqlTestConfig } from "./mysql-test-config"

const databaseName = `crossfit_test_${Date.now()}`
let admin: Pool
let pool: Pool
let db: WodsmithDb
const tables = [programmingTracksTable, trackWorkoutsTable, workouts]
const conversion = { kind: "workout", components: [{ scheme: "time", scoreType: "min", evidence: "for time", timeCap: null, roundsToScore: 1 }] }

async function source(date = "2026-09-05", markdown = "For time: 100 air squats. Post time to comments.") {
  return parseCrossFitResponse({ wods: { id: `w${date.replaceAll("-", "")}`, cleanID: date.replaceAll("-", ""), url: `/${date.replaceAll("-", "").slice(2)}`, language: "en", publishingState: "published", wodRaw: markdown, modified: "2026-09-04T23:55:00Z" } }, date)
}

describe.skipIf(!mysqlTestConfig)("CrossFit atomic publication on MySQL", () => {
  beforeAll(async () => {
    if (!mysqlTestConfig) throw new Error("CrossFit tests require an explicit local MySQL configuration")
    admin = mysql.createPool(mysqlTestConfig)
    await admin.promise().query(`CREATE DATABASE \`${databaseName}\``)
    pool = mysql.createPool({ ...mysqlTestConfig, database: databaseName, connectionLimit: 5 })
    db = createWodsmithDb(pool)
    const casing = new CasingCache("snake_case")
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column) => {
        const defaultSql = ["string", "number", "boolean"].includes(typeof column.default) ? ` DEFAULT ${mysql.escape(column.default)}` : ""
        return `\`${casing.getColumnCasing(column)}\` ${column.getSQLType()} ${column.primary ? "PRIMARY KEY" : column.notNull ? "NOT NULL" : "NULL"}${defaultSql}`
      })
      await pool.promise().query(`CREATE TABLE \`${getTableName(table)}\` (${columns.join(",")}) ENGINE=InnoDB`)
    }
    // Execute the actual additive migration, including its uniqueness constraints.
    const migration = readFileSync(fileURLToPath(new NodeURL("../../../../packages/wodsmith-db/mysql-migrations/0002_milky_katie_power.sql", import.meta.url)), "utf8")
    for (const statement of migration.split("--> statement-breakpoint")) if (statement.trim()) await pool.promise().query(statement)
  })
  beforeEach(async () => {
    for (const table of [items, imports, trackWorkoutsTable, workouts, programmingTracksTable]) await db.delete(table)
    await db.insert(programmingTracksTable).values({ id: CROSSFIT_TRACK_ID, name: "CrossFit.com", type: "official_3rd_party", ownerTeamId: CROSSFIT_OWNER_TEAM_ID, isPublic: 1 })
  })
  afterAll(async () => {
    await pool?.promise().end()
    if (admin) { await admin.promise().query(`DROP DATABASE \`${databaseName}\``); await admin.promise().end() }
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Atomic replay and concurrency]]
  it("publishes exactly once across concurrent calls and retries after commit", async () => {
    const snapshot = await source()
    await Promise.all([beginCrossFitImport(db, snapshot.date, "run-1"), beginCrossFitImport(db, snapshot.date, "run-2")])
    await snapshotCrossFitImport(db, snapshot)
    await Promise.all([publishCrossFitImport(db, snapshot, conversion, null), publishCrossFitImport(db, snapshot, conversion, null)])
    expect(await db.select().from(workouts)).toHaveLength(1)
    expect(await db.select().from(items)).toHaveLength(1)
    await db.update(workouts).set({ description: "Coach edited" })
    expect(await publishCrossFitImport(db, snapshot, conversion, null)).toMatchObject({ alreadyPublished: true })
    expect((await db.select().from(workouts))[0].description).toBe("Coach edited")
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Rest publication]]
  it("publishes a visible rest day without scoreable workouts and replays safely", async () => {
    const snapshot = await source("2026-09-06", "**Rest Day**")
    await beginCrossFitImport(db, snapshot.date, "rest")
    await snapshotCrossFitImport(db, snapshot)
    await publishCrossFitImport(db, snapshot, { kind: "rest", components: [] }, null)
    await publishCrossFitImport(db, snapshot, { kind: "rest", components: [] }, null)
    expect(await db.select().from(workouts)).toHaveLength(0)
    expect(await getPublishedCrossFitDays(db, CROSSFIT_TRACK_ID)).toMatchObject([{ date: snapshot.date, kind: "rest", workouts: [] }])
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Rollback and held visibility]]
  it("rolls back every public row if any component fails, and hides pending imports", async () => {
    const snapshot = await source("2026-09-04", "For time: 20 squats. Then build to a heavy single. Post time and load to comments.")
    await beginCrossFitImport(db, snapshot.date, "composite")
    await snapshotCrossFitImport(db, snapshot)
    await db.insert(workouts).values({ id: "cf-2026-09-04-2", name: "Existing collision", description: "Keep", scheme: "load" })
    await expect(publishCrossFitImport(db, snapshot, { kind: "workout", components: [...conversion.components, { scheme: "load", scoreType: "max", evidence: "heavy single", timeCap: null, roundsToScore: 1 }] }, null)).rejects.toThrow()
    expect(await db.select().from(trackWorkoutsTable)).toHaveLength(0)
    expect(await db.select().from(items)).toHaveLength(0)
    expect(await db.select().from(workouts)).toHaveLength(1)
    expect(await getPublishedCrossFitDays(db, CROSSFIT_TRACK_ID)).toEqual([])
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Manual and automated ordering]]
  it("serializes manual and automated append order and refuses the wrong destination", async () => {
    const snapshot = await source()
    await beginCrossFitImport(db, snapshot.date, "append")
    await snapshotCrossFitImport(db, snapshot)
    await db.insert(workouts).values({ id: "manual", name: "Manual", description: "Keep", scheme: "time" })
    await Promise.all([appendCrossFitWorkout(db, "manual"), publishCrossFitImport(db, snapshot, conversion, null)])
    const rows = await db.select().from(trackWorkoutsTable)
    expect(rows.map((row) => Number(row.trackOrder)).sort()).toEqual([1, 2])
    const next = await source("2026-09-07")
    await beginCrossFitImport(db, next.date, "bad-destination")
    await snapshotCrossFitImport(db, next)
    await db.update(programmingTracksTable).set({ ownerTeamId: "other" }).where(eq(programmingTracksTable.id, CROSSFIT_TRACK_ID))
    await expect(publishCrossFitImport(db, next, conversion, null)).rejects.toThrow("identity")
  })
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Missing manual workout]]
  it("refuses missing manual workouts without consuming a track position", async () => {
    await expect(appendCrossFitWorkout(db, "missing")).rejects.toThrow("Workout not found")
    expect(await db.select().from(trackWorkoutsTable)).toHaveLength(0)
  })

})
