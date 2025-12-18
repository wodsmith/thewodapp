"use server"

import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { getDb } from "@/db"
import { LANE_SHIFT_PATTERN } from "@/db/schema"
import {
	createJudgeRotation,
	deleteJudgeRotation,
	getRotationsForEvent,
	getRotationsForJudge,
	updateEventRotationDefaults,
	updateJudgeRotation,
	validateRotationConflicts,
} from "@/server/judge-rotations"

// ============================================================================
// Schemas
// ============================================================================

const createRotationSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
	startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
	heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
	laneShiftPattern: z
		.enum([
			LANE_SHIFT_PATTERN.STAY,
			LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			LANE_SHIFT_PATTERN.SHIFT_LEFT,
		])
		.optional(),
	notes: z.string().max(500, "Notes too long").optional(),
})

const updateRotationSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	rotationId: z.string().min(1, "Rotation ID is required"),
	startingHeat: z.number().int().min(1).optional(),
	startingLane: z.number().int().min(1).optional(),
	heatsCount: z.number().int().min(1).optional(),
	laneShiftPattern: z
		.enum([
			LANE_SHIFT_PATTERN.STAY,
			LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			LANE_SHIFT_PATTERN.SHIFT_LEFT,
		])
		.optional(),
	notes: z.string().max(500).optional(),
})

const deleteRotationSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	rotationId: z.string().min(1, "Rotation ID is required"),
})

const getEventRotationsSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const getJudgeRotationsSchema = z.object({
	membershipId: z.string().min(1, "Judge ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
})

const validateRotationSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	startingHeat: z.number().int().min(1),
	startingLane: z.number().int().min(1),
	heatsCount: z.number().int().min(1),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
		LANE_SHIFT_PATTERN.SHIFT_LEFT,
	]),
	rotationId: z.string().optional(), // For update validation
})

const updateEventDefaultsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	defaultHeatsCount: z.number().int().min(1).nullable().optional(),
	defaultLaneShiftPattern: z
		.enum([
			LANE_SHIFT_PATTERN.STAY,
			LANE_SHIFT_PATTERN.SHIFT_RIGHT,
			LANE_SHIFT_PATTERN.SHIFT_LEFT,
		])
		.nullable()
		.optional(),
})

// ============================================================================
// Actions
// ============================================================================

/**
 * Create a new judge rotation
 */
export const createJudgeRotationAction = createServerAction()
	.input(createRotationSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			// Validate rotation before creating
			const validation = await validateRotationConflicts(db, {
				trackWorkoutId: input.trackWorkoutId,
				membershipId: input.membershipId,
				startingHeat: input.startingHeat,
				startingLane: input.startingLane,
				heatsCount: input.heatsCount,
				laneShiftPattern: input.laneShiftPattern ?? LANE_SHIFT_PATTERN.STAY,
			})

			if (validation.conflicts.length > 0) {
				throw new ZSAError(
					"CONFLICT",
					`Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
				)
			}

			const rotation = await createJudgeRotation(db, input)
			return { success: true, data: rotation }
		} catch (error) {
			console.error("Failed to create judge rotation:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to create judge rotation",
			)
		}
	})

/**
 * Update an existing judge rotation
 */
export const updateJudgeRotationAction = createServerAction()
	.input(updateRotationSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			// Get existing rotation to merge data for validation
			const existing = await db.query.competitionJudgeRotationsTable.findFirst({
				where: (table, { eq }) => eq(table.id, input.rotationId),
			})

			if (!existing) {
				throw new ZSAError("NOT_FOUND", "Rotation not found")
			}

			// Validate with merged data
			const validation = await validateRotationConflicts(db, {
				id: input.rotationId,
				trackWorkoutId: existing.trackWorkoutId,
				membershipId: existing.membershipId,
				startingHeat: input.startingHeat ?? existing.startingHeat,
				startingLane: input.startingLane ?? existing.startingLane,
				heatsCount: input.heatsCount ?? existing.heatsCount,
				laneShiftPattern: input.laneShiftPattern ?? existing.laneShiftPattern,
			})

			if (validation.conflicts.length > 0) {
				throw new ZSAError(
					"CONFLICT",
					`Rotation has conflicts: ${validation.conflicts.map((c) => c.message).join(", ")}`,
				)
			}

			const rotation = await updateJudgeRotation(db, input)
			return { success: true, data: rotation }
		} catch (error) {
			console.error("Failed to update judge rotation:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update judge rotation",
			)
		}
	})

/**
 * Delete a judge rotation
 */
export const deleteJudgeRotationAction = createServerAction()
	.input(deleteRotationSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			await deleteJudgeRotation(db, input.rotationId, input.teamId)
			return { success: true }
		} catch (error) {
			console.error("Failed to delete judge rotation:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete judge rotation",
			)
		}
	})

/**
 * Get all rotations for an event
 */
export const getEventRotationsAction = createServerAction()
	.input(getEventRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const result = await getRotationsForEvent(db, input.trackWorkoutId)
			return { success: true, data: result }
		} catch (error) {
			console.error("Failed to get event rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get event rotations",
			)
		}
	})

/**
 * Get all rotations for a specific judge in a competition
 */
export const getJudgeRotationsAction = createServerAction()
	.input(getJudgeRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const rotations = await getRotationsForJudge(
				db,
				input.membershipId,
				input.competitionId,
			)
			return { success: true, data: rotations }
		} catch (error) {
			console.error("Failed to get judge rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get judge rotations",
			)
		}
	})

/**
 * Validate a rotation configuration without creating it.
 * Returns conflicts (blocking errors) and truncation info (non-blocking).
 */
export const validateRotationAction = createServerAction()
	.input(validateRotationSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const validation = await validateRotationConflicts(db, input)

			return {
				success: true,
				data: {
					valid: validation.conflicts.length === 0,
					conflicts: validation.conflicts,
					// Truncation info - heats that don't exist will be skipped
					effectiveHeatsCount: validation.effectiveHeatsCount,
					requestedHeatsCount: validation.requestedHeatsCount,
					truncated: validation.truncated,
				},
			}
		} catch (error) {
			console.error("Failed to validate rotation:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to validate rotation")
		}
	})

/**
 * Update default heats count and lane shift pattern for an event
 */
export const updateEventDefaultsAction = createServerAction()
	.input(updateEventDefaultsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			await updateEventRotationDefaults(db, input)

			// Revalidate the judges page to reflect the updated defaults
			revalidatePath(
				"/compete/organizer/[competitionId]/volunteers/judges",
				"page",
			)

			return { success: true }
		} catch (error) {
			console.error("Failed to update event defaults:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to update event defaults",
			)
		}
	})
