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

// Cached drizzle instance. In Workers, module scope is per-isolate,
// so this avoids creating duplicate pools when getDb() is called
// multiple times within the same request.
let _db: Database | null = null

/**
 * Get database connection (server-only)
 *
 * Prefers Hyperdrive binding (deployed Workers) for connection pooling.
 * Falls back to DATABASE_URL (local dev via .dev.vars).
 *
 * Uses mysql2 with disableEval: true (required for Workers runtime).
 * Hyperdrive handles connection pooling externally; we use connectionLimit: 1
 * to avoid redundant client-side pooling.
 */
export const getDb = createServerOnlyFn((): Database => {
	if (_db) return _db

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

	_db = drizzle(pool, {
		schema,
		casing: "snake_case",
		mode: "planetscale",
	})

	return _db
})

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
