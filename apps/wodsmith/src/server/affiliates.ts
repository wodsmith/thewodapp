import "server-only"
import { eq, like } from "drizzle-orm"
import { getDb } from "@/db"
import { type Affiliate, affiliatesTable } from "@/db/schema"

/**
 * Normalize affiliate name to title case for consistent storage
 */
function toTitleCase(str: string): string {
	return str
		.trim()
		.toLowerCase()
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
}

/**
 * Find or create affiliate by name (case-insensitive, normalized)
 * Returns the affiliate ID
 */
export async function findOrCreateAffiliate(name: string): Promise<string> {
	const db = getDb()
	const normalized = toTitleCase(name.trim())

	// Try to find existing affiliate with exact match (case-insensitive)
	const existing = await db.query.affiliatesTable.findFirst({
		where: eq(affiliatesTable.name, normalized),
	})

	if (existing) {
		return existing.id
	}

	// Create new affiliate
	const result = await db.insert(affiliatesTable).values({ name: normalized }).returning()

	const [created] = Array.isArray(result) ? result : []
	if (!created) {
		throw new Error("Failed to create affiliate")
	}

	return created.id
}

/**
 * Get affiliate by ID
 */
export async function getAffiliate(id: string): Promise<Affiliate | null> {
	const db = getDb()

	const affiliate = await db.query.affiliatesTable.findFirst({
		where: eq(affiliatesTable.id, id),
	})

	return affiliate ?? null
}

/**
 * Search affiliates by name (for autocomplete)
 * Returns up to 10 matching affiliates
 */
export async function searchAffiliates(query: string): Promise<Affiliate[]> {
	const db = getDb()

	if (!query || query.trim().length < 2) {
		return []
	}

	const affiliates = await db.query.affiliatesTable.findMany({
		where: like(affiliatesTable.name, `%${query.trim()}%`),
		limit: 10,
	})

	return affiliates
}

/**
 * Get all affiliates (for admin purposes)
 */
export async function getAllAffiliates(): Promise<Affiliate[]> {
	const db = getDb()

	const affiliates = await db.query.affiliatesTable.findMany({
		orderBy: (table, { asc }) => [asc(table.name)],
	})

	return affiliates
}
