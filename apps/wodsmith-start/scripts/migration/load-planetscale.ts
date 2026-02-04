#!/usr/bin/env tsx
/**
 * Load transformed data into PlanetScale
 * Run with: DATABASE_URL=... pnpm tsx scripts/migration/load-planetscale.ts
 */

import mysql from "mysql2/promise"
import fs from "node:fs"
import path from "node:path"

const transformedDir = path.join(__dirname, "transformed-data")
const BATCH_SIZE = 1000

async function loadTable(
  connection: mysql.Connection,
  tableName: string
): Promise<number> {
  const dataPath = path.join(transformedDir, `${tableName}.json`)
  if (!fs.existsSync(dataPath)) {
    console.log(`No data file for ${tableName}, skipping`)
    return 0
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as Record<string, unknown>[]

  if (data.length === 0) {
    console.log(`No rows for ${tableName}`)
    return 0
  }

  // Get column names from first row
  const columns = Object.keys(data[0])
  const placeholders = columns.map(() => "?").join(", ")
  const columnList = columns.map((c) => `\`${c}\``).join(", ")

  const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`

  let inserted = 0
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const values = columns.map((col) => row[col])

      try {
        await connection.execute(insertSql, values)
        inserted++
      } catch (error) {
        console.error(`Error inserting row into ${tableName}:`, error)
        console.error("Row:", JSON.stringify(row, null, 2))
      }
    }

    console.log(`  ${tableName}: ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} rows`)
  }

  return inserted
}

async function main() {
  const connectionUrl = process.env.DATABASE_URL
  if (!connectionUrl) {
    console.error("DATABASE_URL environment variable required")
    process.exit(1)
  }

  const manifestPath = path.join(transformedDir, "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    console.error("manifest.json not found. Run transform-data.ts first.")
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

  const connection = await mysql.createConnection(connectionUrl)
  console.log("Connected to PlanetScale")

  // Disable foreign key checks during import
  await connection.execute("SET FOREIGN_KEY_CHECKS = 0")

  const results: { table: string; rows: number }[] = []

  for (const table of manifest.tables) {
    console.log(`Loading ${table}...`)
    const rows = await loadTable(connection, table)
    results.push({ table, rows })
  }

  // Re-enable foreign key checks
  await connection.execute("SET FOREIGN_KEY_CHECKS = 1")

  await connection.end()

  console.log("\n=== Migration Summary ===")
  for (const { table, rows } of results) {
    console.log(`${table}: ${rows} rows`)
  }
}

main().catch(console.error)
