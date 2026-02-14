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
import mysql from "mysql2/promise"

import * as schema from "./schema"

// Extend Cloudflare.Env with Hyperdrive binding and DATABASE_URL fallback.
// HYPERDRIVE will be in wrangler.jsonc after `pnpm alchemy:dev` deploys the binding.
// DATABASE_URL is set in .dev.vars for local development.
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
 * Creates a fresh pool per call. Workers I/O objects are bound to the
 * request that created them, so connections cannot be cached across requests.
 * Hyperdrive handles the real connection pooling externally.
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

	const pool = mysql.createPool({
		uri: connectionString,
		disableEval: true,
		connectionLimit: 1,
	})

	return drizzle(pool, {
		schema,
		casing: "snake_case",
		mode: "planetscale",
	})
})

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
