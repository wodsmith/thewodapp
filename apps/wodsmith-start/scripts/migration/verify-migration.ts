#!/usr/bin/env tsx
/**
 * Verify data integrity after migration
 * Run with: DATABASE_URL=... pnpm tsx scripts/migration/verify-migration.ts <d1-path>
 */

import Database from "better-sqlite3"
import mysql from "mysql2/promise"

interface RowCounts {
  [table: string]: number
}

async function getD1Counts(dbPath: string): Promise<RowCounts> {
  const db = new Database(dbPath, { readonly: true })
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[]

  const counts: RowCounts = {}
  for (const { name } of tables) {
    if (name.startsWith("_") || name.startsWith("sqlite_")) continue
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM "${name}"`).get() as { count: number }
      counts[name] = count.count
    } catch {
      // Table might not exist
    }
  }

  db.close()
  return counts
}

async function getPlanetScaleCounts(url: string): Promise<RowCounts> {
  const connection = await mysql.createConnection(url)

  const [tables] = await connection.execute("SHOW TABLES")
  const counts: RowCounts = {}

  for (const row of tables as { [key: string]: string }[]) {
    const tableName = Object.values(row)[0]
    try {
      const [[countRow]] = await connection.execute(
        `SELECT COUNT(*) as count FROM \`${tableName}\``
      ) as unknown as [[{ count: number }]]
      counts[tableName] = countRow.count
    } catch {
      // Table might not exist
    }
  }

  await connection.end()
  return counts
}

async function main() {
  const d1Path = process.argv[2]
  const psUrl = process.env.DATABASE_URL

  if (!d1Path || !psUrl) {
    console.error("Usage: DATABASE_URL=... tsx verify-migration.ts <d1-path>")
    process.exit(1)
  }

  console.log("Fetching row counts...")
  const [d1Counts, psCounts] = await Promise.all([
    getD1Counts(d1Path),
    getPlanetScaleCounts(psUrl),
  ])

  console.log("\n=== Row Count Comparison ===")
  console.log("Table".padEnd(40) + "D1".padEnd(10) + "PlanetScale".padEnd(12) + "Match")
  console.log("-".repeat(70))

  let allMatch = true
  const allTables = new Set([...Object.keys(d1Counts), ...Object.keys(psCounts)])

  for (const table of [...allTables].sort()) {
    const d1Count = d1Counts[table] || 0
    const psCount = psCounts[table] || 0
    const match = d1Count === psCount
    if (!match) allMatch = false

    console.log(
      table.padEnd(40) +
        String(d1Count).padEnd(10) +
        String(psCount).padEnd(12) +
        (match ? "OK" : "MISMATCH")
    )
  }

  console.log("\n" + (allMatch ? "All tables match!" : "ERRORS: Some tables have mismatched counts"))
  process.exit(allMatch ? 0 : 1)
}

main().catch(console.error)
