import mysql, { type RowDataPacket } from "mysql2/promise"

const requiredColumns = [
  "championship_competition_id",
  "email",
  "championship_division_id",
  "active_marker",
]

/**
 * Read-only early guard for the active-invite unique index, not whole-schema or
 * seed-completeness verification. CI's successful schema push and both seeds
 * own preparation; this check does not replace those ordered steps.
 */
export async function verifyPreparedCrewDatabase(
  databaseUrl: string | undefined,
  ci: string | undefined,
): Promise<void> {
  if (ci !== "true") {
    throw new Error("CREW_E2E_DB_PREPARED is only allowed in CI")
  }
  let url: URL
  try {
    url = new URL(databaseUrl ?? "")
    if (
      url.protocol !== "mysql:" ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !/^\/[a-zA-Z0-9_]+_(?:test|e2e)$/.test(url.pathname) ||
      url.search ||
      url.hash
    ) {
      throw new Error("Unsafe database URL")
    }
  } catch {
    throw new Error(
      "Prepared Crew CI requires a local MySQL DATABASE_URL ending in _test or _e2e",
    )
  }

  const database = url.pathname.slice(1)
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectTimeout: 5_000,
  })
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS sequence,
              COLUMN_NAME AS columnName, SUB_PART AS subPart
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
       ORDER BY SEQ_IN_INDEX`,
      [
        database,
        "competition_invites",
        "competition_invites_active_invite_idx",
      ],
    )
    if (
      rows.length !== requiredColumns.length ||
      rows.some(
        (row, index) =>
          row.nonUnique !== 0 ||
          row.sequence !== index + 1 ||
          row.columnName !== requiredColumns[index] ||
          row.subPart !== null,
      )
    ) {
      throw new Error(
        "Prepared Crew database is missing the exact unique competition_invites_active_invite_idx constraint; fix the initial CI preparation before running browsers",
      )
    }
  } finally {
    await connection.end()
  }
}
