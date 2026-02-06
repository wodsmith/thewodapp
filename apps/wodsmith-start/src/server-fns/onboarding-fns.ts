/**
 * Onboarding Server Functions
 *
 * Server functions for managing organizer onboarding state:
 * - Setup checklist progress
 * - Tip dismissals
 * - Tour completion tracking
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { onboardingStateTable } from "@/db/schemas/onboarding"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getOnboardingStateInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().optional(),
})

const updateOnboardingStateInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().optional(),
	key: z.string().min(1, "Key is required"),
	completed: z.boolean(),
	metadata: z.string().optional(),
})

const resetOnboardingStateInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().optional(),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all onboarding state for a user/team, optionally scoped to a competition
 */
export const getOnboardingStateFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getOnboardingStateInputSchema.parse(data))
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			return { states: [] }
		}

		const db = getDb()

		const conditions = [
			eq(onboardingStateTable.userId, session.userId),
			eq(onboardingStateTable.teamId, data.teamId),
		]

		if (data.competitionId) {
			conditions.push(
				eq(onboardingStateTable.competitionId, data.competitionId),
			)
		}

		const states = await db
			.select({
				id: onboardingStateTable.id,
				key: onboardingStateTable.key,
				completed: onboardingStateTable.completed,
				completedAt: onboardingStateTable.completedAt,
				metadata: onboardingStateTable.metadata,
			})
			.from(onboardingStateTable)
			.where(and(...conditions))

		return { states }
	})

/**
 * Update a single onboarding state entry (upsert)
 */
export const updateOnboardingStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		updateOnboardingStateInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		const db = getDb()

		// Check if a record already exists
		const conditions = [
			eq(onboardingStateTable.userId, session.userId),
			eq(onboardingStateTable.teamId, data.teamId),
			eq(onboardingStateTable.key, data.key),
		]

		if (data.competitionId) {
			conditions.push(
				eq(onboardingStateTable.competitionId, data.competitionId),
			)
		}

		const existing = await db
			.select({ id: onboardingStateTable.id })
			.from(onboardingStateTable)
			.where(and(...conditions))
			.limit(1)

		if (existing[0]) {
			// Update existing
			await db
				.update(onboardingStateTable)
				.set({
					completed: data.completed,
					completedAt: data.completed ? new Date() : null,
					metadata: data.metadata,
				})
				.where(eq(onboardingStateTable.id, existing[0].id))
		} else {
			// Insert new
			await db.insert(onboardingStateTable).values({
				userId: session.userId,
				teamId: data.teamId,
				competitionId: data.competitionId,
				key: data.key,
				completed: data.completed,
				completedAt: data.completed ? new Date() : null,
				metadata: data.metadata,
			})
		}

		return { success: true }
	})

/**
 * Reset all onboarding state for a user/team (optionally scoped to competition)
 * Used for "Show tips again" functionality
 */
export const resetOnboardingStateFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) =>
		resetOnboardingStateInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		const session = await getSessionFromCookie()
		if (!session?.userId) {
			throw new Error("Unauthorized")
		}

		const db = getDb()

		const conditions = [
			eq(onboardingStateTable.userId, session.userId),
			eq(onboardingStateTable.teamId, data.teamId),
		]

		if (data.competitionId) {
			conditions.push(
				eq(onboardingStateTable.competitionId, data.competitionId),
			)
		}

		await db.delete(onboardingStateTable).where(and(...conditions))

		return { success: true }
	})
