/**
 * Admin Entitlement Server Functions
 * Functions for managing workout tracking entitlement per team (require ADMIN role)
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
	featureTable,
	teamFeatureEntitlementTable,
	teamMembershipTable,
	teamTable,
} from "@/db/schema"
import {
	grantTeamFeature,
	revokeTeamFeature,
} from "@/server/organizer-onboarding"
import { requireAdmin } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export interface TeamWithWorkoutTracking {
	id: string
	name: string
	slug: string
	type: string | null
	isPersonalTeam: number
	memberCount: number
	hasWorkoutTracking: boolean
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all non-competition teams with their workout_tracking entitlement status
 */
export const getTeamsWithWorkoutTrackingFn = createServerFn({
	method: "GET",
}).handler(async () => {
	await requireAdmin()

	const db = getDb()

	// Get the workout_tracking feature ID
	const feature = await db.query.featureTable.findFirst({
		where: eq(featureTable.key, FEATURES.WORKOUT_TRACKING),
	})

	// Get all gym/personal teams with member counts
	const teams = await db
		.select({
			id: teamTable.id,
			name: teamTable.name,
			slug: teamTable.slug,
			type: teamTable.type,
			isPersonalTeam: teamTable.isPersonalTeam,
			memberCount: sql<number>`(
				SELECT COUNT(*) FROM ${teamMembershipTable}
				WHERE ${teamMembershipTable.teamId} = ${teamTable.id}
				AND ${teamMembershipTable.isActive} = 1
			)`.as("memberCount"),
		})
		.from(teamTable)
		.where(
			sql`${teamTable.type} NOT IN ('competition_event', 'competition_team')`,
		)
		.orderBy(desc(teamTable.createdAt))

	// Get teams that have the workout_tracking feature active
	const enabledTeamIds = new Set<string>()
	if (feature) {
		const entries = await db
			.select({ teamId: teamFeatureEntitlementTable.teamId })
			.from(teamFeatureEntitlementTable)
			.where(
				and(
					eq(teamFeatureEntitlementTable.featureId, feature.id),
					eq(teamFeatureEntitlementTable.isActive, 1),
				),
			)
		for (const e of entries) {
			enabledTeamIds.add(e.teamId)
		}
	}

	return {
		teams: teams.map((t) => ({
			...t,
			hasWorkoutTracking: enabledTeamIds.has(t.id),
		})) as TeamWithWorkoutTracking[],
	}
})

/**
 * Toggle workout tracking for a team
 */
export const toggleWorkoutTrackingFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				teamId: z.string().min(1),
				enabled: z.boolean(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin()

		if (data.enabled) {
			await grantTeamFeature(data.teamId, FEATURES.WORKOUT_TRACKING)
		} else {
			await revokeTeamFeature(data.teamId, FEATURES.WORKOUT_TRACKING)
		}

		return { success: true }
	})
