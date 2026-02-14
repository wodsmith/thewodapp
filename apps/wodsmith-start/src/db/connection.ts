/**
 * Runtime-agnostic database connection factory.
 *
 * Creates a Drizzle ORM instance from a PlanetScale connection URL.
 * No dependency on `cloudflare:workers` — works in both Cloudflare Workers
 * and Node.js (e.g. `mastra dev`).
 */

import { Client } from "@planetscale/database"
import { drizzle } from "drizzle-orm/planetscale-serverless"

import * as schema from "./schema"

export type Database = ReturnType<typeof drizzle<typeof schema>>

/**
 * Create a Drizzle database instance from a PlanetScale connection URL.
 *
 * @param databaseUrl - PlanetScale connection string (mysql://...)
 * @returns Drizzle ORM instance with schema
 */
export function createDrizzleFromUrl(databaseUrl: string): Database {
	const client = new Client({ url: databaseUrl })
	return drizzle(client, { schema, logger: true, casing: "snake_case" })
}
