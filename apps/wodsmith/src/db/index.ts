import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema"

// Test database injection - uses `unknown` to avoid type conflicts between D1 and better-sqlite3
// biome-ignore lint/suspicious/noExplicitAny: Test injection needs flexible typing
let testDbInstance: any = null

/**
 * Set a test database instance. Use this in tests to inject an in-memory SQLite DB.
 * Call with null to clear the test instance.
 *
 * @example
 * ```ts
 * import { createTestDb, cleanupTestDb } from '../lib/test-db'
 * import { setTestDb } from '@/db'
 *
 * beforeEach(() => {
 *   const { db } = createTestDb()
 *   setTestDb(db)
 * })
 *
 * afterEach(() => {
 *   setTestDb(null)
 * })
 * ```
 */
// biome-ignore lint/suspicious/noExplicitAny: Test injection needs flexible typing
export function setTestDb(db: any) {
	testDbInstance = db
}

// Don't cache the database connection globally in serverless environments
// This can cause connection issues and ECONNRESET errors
export const getDb = (): DrizzleD1Database<typeof schema> => {
	// Return injected test DB if available (cast to preserve production types)
	if (testDbInstance) {
		return testDbInstance as DrizzleD1Database<typeof schema>
	}

	try {
		const { env } = getCloudflareContext()

		if (!env.NEXT_TAG_CACHE_D1) {
			throw new Error("D1 database not found")
		}

		// Create a fresh database connection for each request
		// This prevents connection reuse issues in serverless environments
		return drizzle(env.NEXT_TAG_CACHE_D1, { schema, logger: true })
	} catch (error) {
		console.error("Error getting Cloudflare context:", error)
		throw new Error(
			"Failed to initialize database connection. Make sure you're running in a Cloudflare Workers environment or have properly configured development mode.",
		)
	}
}
