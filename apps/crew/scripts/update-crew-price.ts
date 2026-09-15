/**
 * Update only the Crew Event catalog price. Historical purchases and pending
 * Checkout attempts keep their original amounts.
 *
 * CREW_DATABASE_URL=... pnpm --filter crew exec tsx scripts/update-crew-price.ts --stage=demo
 * Add --apply --expected-database=DATABASE_NAME after reviewing the dry run.
 */
import { pathToFileURL } from "node:url"
import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise"

export const CREW_EVENT_PRICE_CENTS = 3000
const PREVIOUS_CREW_EVENT_PRICE_CENTS = 20000

export interface CrewPriceUpdateOptions {
  stage: "prod" | "demo"
  apply: boolean
  expectedDatabase?: string
}

export function parseCrewPriceUpdateArgs(args: string[]): CrewPriceUpdateOptions {
  const unknown = args.filter(
    (arg) =>
      arg !== "--apply" &&
      !arg.startsWith("--stage=") &&
      !arg.startsWith("--expected-database="),
  )
  if (unknown.length) throw new Error(`Unknown argument: ${unknown[0]}`)
  const stage = args.find((arg) => arg.startsWith("--stage="))?.slice(8)
  if (stage !== "prod" && stage !== "demo") {
    throw new Error("Specify --stage=prod or --stage=demo.")
  }
  const apply = args.includes("--apply")
  const expectedDatabase = args
    .find((arg) => arg.startsWith("--expected-database="))
    ?.slice("--expected-database=".length)
  if (apply && !expectedDatabase) {
    throw new Error("Applying requires --expected-database from the reviewed dry run.")
  }
  return { stage, apply, expectedDatabase }
}

export async function runCrewPriceUpdate(
  connection: Connection,
  options: CrewPriceUpdateOptions,
) {
  if (options.apply && !options.expectedDatabase) {
    throw new Error("Applying requires the expected database name.")
  }
  const [databaseRows] = await connection.execute<RowDataPacket[]>(
    "SELECT DATABASE() AS databaseName",
  )
  const database = databaseRows[0]?.databaseName as string | undefined
  if (!database || (options.expectedDatabase && options.expectedDatabase !== database)) {
    throw new Error("Connected database does not match the expected database.")
  }

  if (options.apply) await connection.beginTransaction()
  try {
    const [plans] = await connection.execute<RowDataPacket[]>(
      `SELECT price, \`interval\`, is_active AS isActive, is_public AS isPublic FROM plans WHERE id = ?${options.apply ? " FOR UPDATE" : ""}`,
      ["crew_basic"],
    )
    const plan = plans[0]
    if (!plan || plan.interval !== null || plan.isActive !== 1 || plan.isPublic !== 1) {
      throw new Error("Expected an active, public, one-time crew_basic catalog row.")
    }
    if (plan.price !== PREVIOUS_CREW_EVENT_PRICE_CENTS && plan.price !== CREW_EVENT_PRICE_CENTS) {
      throw new Error("Crew catalog has an unexpected price; review it before changing it.")
    }

    const [pending] = await connection.execute<RowDataPacket[]>(
      "SELECT competition_id AS eventId, crew_billing_amount_cents AS amountCents FROM crew_event_settings WHERE crew_billing_state = ? AND crew_billing_plan_id = ? AND crew_billing_amount_cents <> ? ORDER BY competition_id",
      ["pending", "crew_basic", CREW_EVENT_PRICE_CENTS],
    )
    const needsUpdate = plan.price !== CREW_EVENT_PRICE_CENTS
    if (options.apply && needsUpdate) {
      const [result] = await connection.execute(
        "UPDATE plans SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND price = ? AND is_active = 1 AND is_public = 1 AND `interval` IS NULL",
        [CREW_EVENT_PRICE_CENTS, "crew_basic", PREVIOUS_CREW_EVENT_PRICE_CENTS],
      )
      if ((result as { affectedRows: number }).affectedRows !== 1) {
        throw new Error("Crew catalog changed during the update; no update was committed.")
      }
    }
    if (options.apply) await connection.commit()
    return {
      stage: options.stage,
      database,
      mode: options.apply ? "apply" : "dry_run",
      status: needsUpdate ? (options.apply ? "updated" : "would_update") : "already_current",
      previousPriceCents: plan.price as number,
      priceCents: CREW_EVENT_PRICE_CENTS,
      pendingAtOtherPrices: pending.map((row) => ({
        eventId: row.eventId as string,
        amountCents: row.amountCents as number,
      })),
      note: "Existing purchases and Checkout attempts retain their recorded amounts. Review pending attempts in Stripe before replacing them.",
    }
  } catch (error) {
    if (options.apply) await connection.rollback()
    throw error
  }
}

async function main() {
  const options = parseCrewPriceUpdateArgs(process.argv.slice(2))
  const databaseUrl = process.env.CREW_DATABASE_URL
  if (!databaseUrl) throw new Error("Set CREW_DATABASE_URL for the selected stage.")
  const connection = await createConnection({ uri: databaseUrl })
  try {
    console.log(JSON.stringify(await runCrewPriceUpdate(connection, options), null, 2))
  } finally {
    await connection.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Crew price update failed.")
    process.exitCode = 1
  })
}
