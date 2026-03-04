/**
 * Admin Entitlement Server Functions
 * Functions for managing feature entitlements per team (require ADMIN role)
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, sql } from "drizzle-orm"
import { z } from "zod"
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

export interface FeatureOption {
	id: string
	key: string
	name: string
	description: string | null
	category: string | null
}

export interface TeamWithEntitlement {
	id: string
	name: string
	slug: string
	type: string | null
	isPersonalTeam: boolean
	memberCount: number
	hasFeature: boolean
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all available features for the dropdown
 */
export const getFeaturesFn = createServerFn({
	method: "GET",
}).handler(async () => {
	await requireAdmin()
	const db = getDb()

	const features = await db
		.select({
			id: featureTable.id,
			key: featureTable.key,
			name: featureTable.name,
			description: featureTable.description,
			category: featureTable.category,
		})
		.from(featureTable)
		.where(eq(featureTable.isActive, 1))
		.orderBy(featureTable.category, featureTable.name)

	return { features: features as FeatureOption[] }
})

/**
 * Get all non-competition teams with their entitlement status for a given feature
 */
export const getTeamsWithEntitlementFn = createServerFn({
	method: "GET",
})
	.inputValidator((data: unknown) =>
		z
			.object({
				featureKey: z.string().min(1),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin()

		const db = getDb()

		const feature = await db.query.featureTable.findFirst({
			where: eq(featureTable.key, data.featureKey),
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

		// Get teams that have this feature active
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
				hasFeature: enabledTeamIds.has(t.id),
			})) as TeamWithEntitlement[],
		}
	})

/**
 * Toggle a feature entitlement for a team
 */
export const toggleFeatureEntitlementFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		z
			.object({
				teamId: z.string().min(1),
				featureKey: z.string().min(1),
				enabled: z.boolean(),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin()

		if (data.enabled) {
			await grantTeamFeature(data.teamId, data.featureKey)
		} else {
			await revokeTeamFeature(data.teamId, data.featureKey)
		}

		return { success: true }
	})
