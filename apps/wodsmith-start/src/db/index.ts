/// <reference path="../../worker-configuration.d.ts" />

/**
 * Database Connection Module
 *
 * Provides database connection to PlanetScale (MySQL).
 * Uses cloudflare:workers env for the connection URL.
 */

import { env } from "cloudflare:workers"

import { createDrizzleFromUrl, type Database } from "./connection"

// Extend Env type to include DATABASE_URL
declare module "cloudflare:workers" {
	interface Env {
		DATABASE_URL?: string
	}
}

export type { Database }

/**
 * Get database connection from Cloudflare Workers env.
 *
 * Creates a fresh PlanetScale connection for each request.
 * This is the recommended pattern for serverless environments.
 */
export const getDb = (): Database => {
	const databaseUrl = (env as unknown as { DATABASE_URL?: string }).DATABASE_URL
	if (!databaseUrl) {
		throw new Error(
			"DATABASE_URL not found. Make sure your environment has the PlanetScale connection string configured.",
		)
	}
	return createDrizzleFromUrl(databaseUrl)
}

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
