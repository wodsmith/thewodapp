import { env } from "cloudflare:workers"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema.server"

// TanStack Start pattern: use env from cloudflare:workers
// D1 binding is named "DB"
// Don't cache globally in serverless - create fresh connection per request
export const getDb = (): DrizzleD1Database<typeof schema> => {
	try {
		if (!env.DB) {
			throw new Error("D1 database binding 'DB' not found")
		}

		// Create a fresh database connection for each request
		// This prevents connection reuse issues in serverless environments
		return drizzle(env.DB, { schema, logger: true })
	} catch (error) {
		console.error("Error initializing database:", error)
		throw new Error(
			"Failed to initialize database connection. Make sure you're running in a Cloudflare Workers environment with DB binding configured.",
		)
	}
}
