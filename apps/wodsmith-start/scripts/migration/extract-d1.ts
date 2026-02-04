#!/usr/bin/env tsx
/**
 * Extract data from D1 database for migration to PlanetScale
 * Run with: pnpm tsx scripts/migration/extract-d1.ts
 */

import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

// Tables in dependency order (parents before children)
const TABLES_IN_ORDER = [
  "user",
  "passkey_credential",
  "team",
  "team_membership",
  "team_role",
  "team_invitation",
  "programming_track",
  "team_programming_track",
  "track_workout",
  "scheduled_workout_instance",
  "workouts",
  "workout_tags",
  "competition_groups",
  "competitions",
  "competition_divisions",
  "competition_registrations",
  "competition_registration_teammates",
  "competition_venues",
  "competition_heats",
  "competition_heat_assignments",
  "credit_transaction",
  "purchased_item",
  "commerce_product",
  "commerce_purchase",
  "scores",
  "results",
  "scaling_groups",
  "scaling_levels",
  "workout_scaling_descriptions",
  "affiliates",
  "sponsor_groups",
  "sponsors",
  "waivers",
  "waiver_signatures",
  "video_submissions",
  "submission_window_notifications",
  "event_resources",
  "event_judging_sheets",
  "organizer_request",
  "competition_registration_questions",
  "competition_registration_answers",
  "heat_volunteers",
  "judge_assignment_versions",
  "judge_heat_assignments",
  "competition_judge_rotations",
]

interface ExtractionResult {
  table: string
  rowCount: number
  data: Record<string, unknown>[]
}

async function extractTable(
  db: Database.Database,
  tableName: string
): Promise<ExtractionResult> {
  try {
    const rows = db.prepare(`SELECT * FROM "${tableName}"`).all()
    console.log(`Extracted ${rows.length} rows from ${tableName}`)
    return {
      table: tableName,
      rowCount: rows.length,
      data: rows as Record<string, unknown>[],
    }
  } catch (error) {
    console.log(`Table ${tableName} not found, skipping`)
    return { table: tableName, rowCount: 0, data: [] }
  }
}

function findD1Database(): string | null {
  const possiblePaths = [
    ".alchemy/local/.wrangler/state/v3/d1",
    ".wrangler/state/v3/d1",
  ]

  for (const basePath of possiblePaths) {
    try {
      const entries = fs.readdirSync(basePath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subPath = path.join(basePath, entry.name)
          const files = fs.readdirSync(subPath)
          const dbFile = files.find((f) => f.endsWith(".sqlite"))
          if (dbFile) {
            return path.join(subPath, dbFile)
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }
  return null
}

async function main() {
  const d1Path = findD1Database()
  if (!d1Path) {
    console.error("D1 database not found. Run 'pnpm alchemy:dev' first.")
    process.exit(1)
  }

  console.log(`Found D1 database at: ${d1Path}`)
  const db = new Database(d1Path, { readonly: true })

  const outputDir = path.join(__dirname, "extracted-data")
  fs.mkdirSync(outputDir, { recursive: true })

  const manifest: { tables: string[]; extractedAt: string; rowCounts: Record<string, number> } = {
    tables: [],
    extractedAt: new Date().toISOString(),
    rowCounts: {},
  }

  for (const table of TABLES_IN_ORDER) {
    const result = await extractTable(db, table)
    if (result.rowCount > 0) {
      const outputPath = path.join(outputDir, `${table}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2))
      manifest.tables.push(table)
      manifest.rowCounts[table] = result.rowCount
    }
  }

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )

  db.close()
  console.log(`\nExtraction complete. Data saved to ${outputDir}`)
  console.log(`Total tables: ${manifest.tables.length}`)
}

main().catch(console.error)
