import { getCloudflareContext } from "@opennextjs/cloudflare"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema"

// Don't cache the database connection globally in serverless environments
// This can cause connection issues and ECONNRESET errors
export const getDd = (): DrizzleD1Database<typeof schema> => {
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
