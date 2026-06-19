/// <reference path="../../worker-configuration.d.ts" />

/**
 * Database Connection Module
 *
 * Provides database connection to PlanetScale (MySQL).
 * - In production: Uses Cloudflare Hyperdrive for connection pooling and caching.
 * - In local dev: Falls back to DATABASE_URL from .dev.vars.
 */

import { env } from "cloudflare:workers"
import {
  createWodsmithDb,
  createWodsmithMysqlConnection,
  type WodsmithDb,
} from "@repo/wodsmith-db/mysql"
import { createServerOnlyFn } from "@tanstack/react-start"

declare namespace Cloudflare {
  interface Env {
    HYPERDRIVE?: Hyperdrive
    DATABASE_URL?: string
  }
}

// Type for the database instance
export type Database = WodsmithDb

/**
 * Get database connection (server-only)
 *
 * Prefers Hyperdrive binding (deployed Workers) for connection pooling.
 * Falls back to DATABASE_URL (local dev via .dev.vars).
 *
 * Uses a single connection (not a pool) since Hyperdrive handles
 * connection pooling externally at the Cloudflare level.
 */
export const getDb = createServerOnlyFn((): Database => {
  const hyperdrive = (env as { HYPERDRIVE?: Hyperdrive }).HYPERDRIVE
  const connectionString =
    hyperdrive?.connectionString ??
    (env as { DATABASE_URL?: string }).DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "No database connection available. Set HYPERDRIVE binding (production) or DATABASE_URL in .dev.vars (local dev).",
    )
  }

  const connection = createWodsmithMysqlConnection(connectionString)

  return createWodsmithDb(connection)
})

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
