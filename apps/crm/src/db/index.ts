import { env } from "cloudflare:workers"
import { createServerOnlyFn } from "@tanstack/react-start"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"

export const getDb = createServerOnlyFn((): DrizzleD1Database => {
  if (!env.DB) {
    throw new Error(
      'D1 database binding "DB" not found. Make sure your wrangler.jsonc has the D1 binding configured.',
    )
  }

  return drizzle(env.DB, { logger: true })
})
