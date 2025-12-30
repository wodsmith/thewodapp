/**
 * Affiliate Server Functions for TanStack Start
 * Functions for searching and managing gym affiliates
 */

import { createServerFn } from "@tanstack/react-start"
import { like } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { Affiliate } from "@/db/schemas/affiliates"
import { affiliatesTable } from "@/db/schemas/affiliates"

// ===========================
// Input Schemas
// ===========================

const searchAffiliatesInputSchema = z.object({
	query: z.string(),
})

// ===========================
// Helper Functions
// ===========================

/**
 * Get top affiliates for initial dropdown display
 * Returns up to 25 affiliates ordered alphabetically
 */
async function getTopAffiliates(): Promise<Affiliate[]> {
	const db = getDb()

	const affiliates = await db.query.affiliatesTable.findMany({
		limit: 25,
		orderBy: (table, { asc }) => [asc(table.name)],
	})

	return affiliates
}

// ===========================
// Server Functions
// ===========================

/**
 * Search affiliates by name (for autocomplete)
 * Returns up to 25 matching affiliates
 */
export const searchAffiliatesFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => searchAffiliatesInputSchema.parse(data))
	.handler(async ({ data }) => {
		const db = getDb()

		if (!data.query || data.query.trim().length < 2) {
			// Return top affiliates if no query
			return getTopAffiliates()
		}

		const affiliates = await db.query.affiliatesTable.findMany({
			where: like(affiliatesTable.name, `%${data.query.trim()}%`),
			limit: 25,
			orderBy: (table, { asc }) => [asc(table.name)],
		})

		return affiliates.map((a) => ({
			id: a.id,
			name: a.name,
			verificationStatus: a.verificationStatus,
			location: a.location,
		}))
	})
