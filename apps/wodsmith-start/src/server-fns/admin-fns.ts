/**
 * Admin Server Functions for TanStack Start
 * Functions for site-wide admin operations (require ADMIN role)
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { desc } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionsTable,
	type Competition,
	type CompetitionGroup,
} from "@/db/schemas/competitions"
import type { Team } from "@/db/schemas/teams"
import { requireAdmin } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export interface AdminCompetition extends Competition {
	organizingTeam: Team | null
	competitionTeam: Team | null
	group: CompetitionGroup | null
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get ALL competitions for admin view (no team filtering)
 * This is for admin-only use - shows all competitions from all organizers.
 * Ordered by createdAt DESC to show newest first.
 */
export const getAllCompetitionsForAdminFn = createServerFn({
	method: "GET",
}).handler(async () => {
	// Require site admin role
	const session = await requireAdmin()
	if (!session) {
		throw new Error("Not authorized - admin access required")
	}

	const db = getDb()

	// Query all competitions with relations using Drizzle query builder
	const competitions = await db.query.competitionsTable.findMany({
		with: {
			competitionTeam: true,
			group: true,
			organizingTeam: true,
		},
		orderBy: [desc(competitionsTable.createdAt)],
	})

	// Cast to AdminCompetition type
	return {
		competitions: competitions as AdminCompetition[],
	}
})
