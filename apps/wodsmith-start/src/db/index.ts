/// <reference path="../../worker-configuration.d.ts" />

/**
 * Database Connection Module
 *
 * Provides database connection to PlanetScale (MySQL).
 * - In production: Uses Cloudflare Hyperdrive for connection pooling and caching.
 * - In local dev: Falls back to DATABASE_URL from .dev.vars.
 */

import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2"
import mysql from "mysql2"

import * as schema from "./schema"

declare namespace Cloudflare {
	interface Env {
		HYPERDRIVE?: Hyperdrive
		DATABASE_URL?: string
	}
}

// Type for the database instance
export type Database = MySql2Database<typeof schema>

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

	// Strip 'ssl-mode' from the connection string — Hyperdrive injects it
	// but mysql2 doesn't recognize it (uses `ssl` object instead) and warns/hangs.
	const url = new URL(connectionString)
	url.searchParams.delete("ssl-mode")

	const connection = mysql.createConnection({
		uri: url.toString(),
		disableEval: true,
	})

	return drizzle({ client: connection, schema, casing: "snake_case", mode: "planetscale" })
})

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
