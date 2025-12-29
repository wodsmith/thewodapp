/**
 * Entitlements Service Stub for TanStack Start PoC
 * This is a minimal implementation for auth flow testing.
 * Full implementation will be migrated from wodsmith app.
 */

import "server-only"

import { and, eq, gt, isNull, or } from "drizzle-orm"
import { getDb } from "@/db"
import type { Entitlement } from "@/db/schema"
import { entitlementTable } from "@/db/schema"

export type { Entitlement }

export interface EntitlementResult {
	id: string
	entitlementTypeId: string
	metadata: Record<string, unknown> | null
	expiresAt: Date | null
}

/**
 * Get user's active entitlements
 * Active = not soft-deleted (deletedAt is null) and not expired
 */
export async function getUserEntitlements(
	userId: string,
): Promise<EntitlementResult[]> {
	const db = getDb()

	const now = new Date()

	// entitlementTable uses deletedAt for soft deletes, not isActive
	const entitlements = await db.query.entitlementTable.findMany({
		where: and(
			eq(entitlementTable.userId, userId),
			isNull(entitlementTable.deletedAt),
			or(
				isNull(entitlementTable.expiresAt),
				gt(entitlementTable.expiresAt, now),
			),
		),
	})

	return entitlements.map((e) => ({
		id: e.id,
		entitlementTypeId: e.entitlementTypeId,
		metadata: e.metadata as Record<string, unknown> | null,
		expiresAt: e.expiresAt,
	}))
}

/**
 * Get team's plan with features and limits
 * Stub implementation - returns null for PoC (no plan)
 */
export async function getTeamPlan(_teamId: string): Promise<{
	id: string
	name: string
	entitlements: {
		features: string[]
		limits: Record<string, number>
	}
} | null> {
	// For PoC, return a basic free plan
	return {
		id: "free",
		name: "Free",
		entitlements: {
			features: ["basic_access"],
			limits: {
				max_workouts: 100,
				max_team_members: 5,
			},
		},
	}
}

/**
 * Create an entitlement (typically called after purchase/subscription/manual grant)
 */
export async function createEntitlement({
	userId,
	teamId,
	entitlementTypeId,
	sourceType,
	sourceId,
	metadata,
	expiresAt,
}: {
	userId: string
	teamId?: string
	entitlementTypeId: string
	sourceType: "PURCHASE" | "SUBSCRIPTION" | "MANUAL"
	sourceId: string
	metadata?: Record<string, unknown>
	expiresAt?: Date
}): Promise<Entitlement> {
	const db = getDb()

	const [entitlement] = await db
		.insert(entitlementTable)
		.values({
			userId,
			teamId,
			entitlementTypeId,
			sourceType,
			sourceId,
			metadata,
			expiresAt,
		})
		.returning()

	if (!entitlement) {
		throw new Error("Failed to create entitlement")
	}

	return entitlement
}
