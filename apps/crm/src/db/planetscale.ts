/**
 * PlanetScale Database Connection Module
 *
 * Provides a database connection through Cloudflare Hyperdrive.
 *
 * - In production: Uses Cloudflare Hyperdrive for connection pooling.
 * - In local dev: Falls back to DATABASE_URL from .dev.vars.
 */

import { env } from "cloudflare:workers"
import { createServerOnlyFn } from "@tanstack/react-start"
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql from "mysql2"

export type PlanetScaleDatabase = MySql2Database

export const getPsDb = createServerOnlyFn((): PlanetScaleDatabase => {
  const hyperdrive = (env as { HYPERDRIVE?: Hyperdrive }).HYPERDRIVE
  const databaseUrl = (env as { DATABASE_URL?: string }).DATABASE_URL
  const connectionString = hyperdrive?.connectionString ?? databaseUrl

  if (!connectionString) {
    throw new Error(
      "No PlanetScale connection available. Set HYPERDRIVE binding (production) or DATABASE_URL in .dev.vars (local dev).",
    )
  }

  const url = new URL(connectionString)
  url.searchParams.delete("ssl-mode")

  const connection = mysql.createConnection({
    uri: url.toString(),
    disableEval: true,
  })

  return drizzle({
    client: connection,
    casing: "snake_case",
    mode: "planetscale",
  })
})
