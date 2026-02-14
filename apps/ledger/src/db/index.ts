import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema"

export const getDb = createServerOnlyFn(
	(): DrizzleD1Database<typeof schema> => {
		if (!env.DB) {
			throw new Error(
				'D1 database binding "DB" not found. Make sure your wrangler.jsonc has the D1 binding configured.',
			)
		}

		return drizzle(env.DB, { schema, logger: true })
	},
)
