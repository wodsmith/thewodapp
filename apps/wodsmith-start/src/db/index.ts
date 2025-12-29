/// <reference path="../../worker-configuration.d.ts" />

// Import env from cloudflare:workers - this is the official way to access bindings
// in TanStack Start with @cloudflare/vite-plugin
import { env } from "cloudflare:workers"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema"

// Don't cache the database connection globally in serverless environments
// This can cause connection issues and ECONNRESET errors
export const getDb = (): DrizzleD1Database<typeof schema> => {
	if (!env.DB) {
		throw new Error(
			'D1 database binding "DB" not found. Make sure your wrangler.jsonc has the D1 binding configured.',
		)
	}

	// Create a fresh database connection for each request
	// This prevents connection reuse issues in serverless environments
	return drizzle(env.DB, { schema, logger: true })
}

// Export env for other modules that need access to bindings (KV, R2, etc.)
export { env }
