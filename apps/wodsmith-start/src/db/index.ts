/// <reference path="../../worker-configuration.d.ts" />

/**
 * Database Connection Module
 *
 * Provides database connection to PlanetScale (MySQL).
 * Migration status: Switched from D1/SQLite to PlanetScale/MySQL.
 */

import { env } from "cloudflare:workers"
import { Client } from "@planetscale/database"
import { drizzle } from "drizzle-orm/planetscale-serverless"

import * as schema from "./schema"

// Extend Env type to include DATABASE_URL
// This should be set as a secret in .dev.vars and Cloudflare dashboard
declare module "cloudflare:workers" {
	interface Env {
		DATABASE_URL?: string
	}
}

// Type for the database instance
export type Database = ReturnType<typeof drizzle<typeof schema>>

/**
 * Get database connection
 *
 * Creates a fresh PlanetScale connection for each request.
 * This is the recommended pattern for serverless environments.
 */
export const getDb = (): Database => {
	// Cast to access DATABASE_URL from .dev.vars (not in wrangler.jsonc bindings)
	const databaseUrl = (env as unknown as { DATABASE_URL?: string }).DATABASE_URL
	if (!databaseUrl) {
		throw new Error(
			'DATABASE_URL not found. Make sure your environment has the PlanetScale connection string configured.',
		)
	}

	const client = new Client({
		url: databaseUrl,
	})

	return drizzle(client, { schema, logger: true })
}

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
