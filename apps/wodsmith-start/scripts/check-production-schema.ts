import { readFile, readdir } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { createConnection, type RowDataPacket } from "mysql2/promise"

type SchemaSnapshot = {
  tables: Record<string, { name: string; columns: Record<string, { name: string }> }>
}

export function missingSchemaColumns(
  snapshot: SchemaSnapshot,
  columns: { tableName: string; columnName: string }[],
): string[] {
  const present = new Set(columns.map((column) => `${column.tableName}.${column.columnName}`))
  return Object.values(snapshot.tables).flatMap((table) =>
    Object.values(table.columns)
      .map((column) => `${table.name}.${column.name}`)
      .filter((column) => !present.has(column)),
  )
}

async function main() {
  if (process.env.STAGE !== "prod") return
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error("DATABASE_URL is required for the production schema check")
  const metadata = new URL("../../../packages/wodsmith-db/mysql-migrations/meta/", import.meta.url)
  const snapshots = (await readdir(metadata)).filter((file) => /^\d+_snapshot\.json$/.test(file)).sort()
  const latest = snapshots.at(-1)
  if (!latest) throw new Error("No committed schema snapshot found")
  const snapshot: SchemaSnapshot = JSON.parse(await readFile(new URL(latest, metadata), "utf8"))
  const client = await createConnection({ uri: databaseUrl, ssl: { rejectUnauthorized: true } })
  try {
    const [columns] = await client.query<(RowDataPacket & { tableName: string; columnName: string })[]>(
      "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()",
    )
    const missing = missingSchemaColumns(snapshot, columns)
    if (missing.length) {
      console.error(`Production is missing required schema columns:\n${missing.join("\n")}`)
      throw new Error("Apply the reviewed PlanetScale schema deploy request before deploying application code")
    }
    console.log(`Production contains all required tables and columns from ${latest}`)
  } finally {
    await client.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("Production schema readiness check failed; application deployment stopped.")
    process.exitCode = 1
  })
}
