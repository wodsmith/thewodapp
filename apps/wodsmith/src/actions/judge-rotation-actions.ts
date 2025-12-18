"use server"

import { revalidatePath } from "next/cache"
import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionJudgeRotationsTable, LANE_SHIFT_PATTERN } from "@/db/schema"
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
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
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
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
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
	]),
	rotationId: z.string().optional(), // For update validation
})

const updateEventDefaultsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	defaultHeatsCount: z.number().int().min(1).nullable().optional(),
	defaultLaneShiftPattern: z
		.enum([LANE_SHIFT_PATTERN.STAY, LANE_SHIFT_PATTERN.SHIFT_RIGHT])
		.nullable()
		.optional(),
})

const batchCreateRotationsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	rotations: z
		.array(
			z.object({
				startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
				startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
				heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
				notes: z.string().max(500, "Notes too long").optional(),
			}),
		)
		.min(1, "At least one rotation required"),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
	]),
})

const batchUpdateVolunteerRotationsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	competitionId: z.string().min(1, "Competition ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	rotations: z
		.array(
			z.object({
				startingHeat: z.number().int().min(1, "Starting heat must be at least 1"),
				startingLane: z.number().int().min(1, "Starting lane must be at least 1"),
				heatsCount: z.number().int().min(1, "Must cover at least 1 heat"),
				notes: z.string().max(500, "Notes too long").optional(),
			}),
		)
		.min(1, "At least one rotation required"),
	laneShiftPattern: z.enum([
		LANE_SHIFT_PATTERN.STAY,
		LANE_SHIFT_PATTERN.SHIFT_RIGHT,
	]),
})

const deleteVolunteerRotationsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	membershipId: z.string().min(1, "Judge ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
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

/**
 * Batch create multiple rotations for the same volunteer.
 * Validates ALL rotations before creating any (fail-fast).
 * Checks for conflicts between new rotations and existing rotations.
 */
export const batchCreateRotationsAction = createServerAction()
	.input(batchCreateRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			// Validate all rotations first (fail-fast)
			// Check both internal conflicts and conflicts with existing rotations
			const validationPromises = input.rotations.map((rotation) =>
				validateRotationConflicts(db, {
					trackWorkoutId: input.trackWorkoutId,
					membershipId: input.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: input.laneShiftPattern,
				}),
			)

			const validationResults = await Promise.all(validationPromises)

			// Collect all conflicts
			const allConflicts = validationResults.flatMap((result) => result.conflicts)

			if (allConflicts.length > 0) {
				throw new ZSAError(
					"CONFLICT",
					`Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
				)
			}

			// Check for conflicts BETWEEN the new rotations being created
			for (let i = 0; i < input.rotations.length; i++) {
				for (let j = i + 1; j < input.rotations.length; j++) {
					const rot1 = input.rotations[i]
					const rot2 = input.rotations[j]

					// Check if heat ranges overlap
					const rot1End = rot1.startingHeat + rot1.heatsCount - 1
					const rot2End = rot2.startingHeat + rot2.heatsCount - 1

					if (
						!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)
					) {
						// Ranges overlap - need to check lane assignments
						// For simplicity, we'll flag this as a potential conflict
						throw new ZSAError(
							"CONFLICT",
							`Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
						)
					}
				}
			}

			// All validations passed - create rotations in sequence
			const createdRotations = []

			for (const rotation of input.rotations) {
				const created = await createJudgeRotation(db, {
					teamId: input.teamId,
					competitionId: input.competitionId,
					trackWorkoutId: input.trackWorkoutId,
					membershipId: input.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: input.laneShiftPattern,
					notes: rotation.notes,
				})

				createdRotations.push(created)
			}

			return {
				success: true,
				data: {
					rotationIds: createdRotations.map((r) => r.id),
					rotations: createdRotations,
				},
			}
		} catch (error) {
			console.error("Failed to batch create rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to batch create rotations",
			)
		}
	})

/**
 * Replace all rotations for a volunteer with a new set.
 * Deletes existing rotations for this volunteer+event, then creates new ones.
 * Validates ALL new rotations before making any changes (fail-fast).
 */
export const batchUpdateVolunteerRotationsAction = createServerAction()
	.input(batchUpdateVolunteerRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			// Validate all NEW rotations first (fail-fast)
			// Pass excludeAllForMembership: true because we're replacing ALL rotations
			// for this member, so we don't need to check conflicts with their existing rotations
			const validationPromises = input.rotations.map((rotation) =>
				validateRotationConflicts(
					db,
					{
						trackWorkoutId: input.trackWorkoutId,
						membershipId: input.membershipId,
						startingHeat: rotation.startingHeat,
						startingLane: rotation.startingLane,
						heatsCount: rotation.heatsCount,
						laneShiftPattern: input.laneShiftPattern,
					},
					{ excludeAllForMembership: true },
				),
			)

			const validationResults = await Promise.all(validationPromises)

			// Check for conflicts BETWEEN the new rotations being created
			// (we still need to ensure the new rotations don't conflict with each other)
			for (let i = 0; i < input.rotations.length; i++) {
				for (let j = i + 1; j < input.rotations.length; j++) {
					const rot1 = input.rotations[i]
					const rot2 = input.rotations[j]

					// Check if heat ranges overlap
					const rot1End = rot1.startingHeat + rot1.heatsCount - 1
					const rot2End = rot2.startingHeat + rot2.heatsCount - 1

					if (
						!(rot1End < rot2.startingHeat || rot2End < rot1.startingHeat)
					) {
						// Ranges overlap - need to check lane assignments
						throw new ZSAError(
							"CONFLICT",
							`Rotations ${i + 1} and ${j + 1} have overlapping heat ranges and may conflict`,
						)
					}
				}
			}

			// Collect validation errors (invalid lanes, missing heats - NOT double-booking since we excluded that)
			const allConflicts = validationResults.flatMap((result) => result.conflicts)

			if (allConflicts.length > 0) {
				throw new ZSAError(
					"CONFLICT",
					`Rotations have conflicts: ${allConflicts.map((c) => c.message).join(", ")}`,
				)
			}

			// Delete existing rotations for this volunteer+event
			const existingRotations = await db
				.select()
				.from(competitionJudgeRotationsTable)
				.where(
					and(
						eq(competitionJudgeRotationsTable.trackWorkoutId, input.trackWorkoutId),
						eq(competitionJudgeRotationsTable.membershipId, input.membershipId),
					),
				)

			for (const existing of existingRotations) {
				await deleteJudgeRotation(db, existing.id, input.teamId)
			}

			// Create new rotations in sequence
			const createdRotations = []

			for (const rotation of input.rotations) {
				const created = await createJudgeRotation(db, {
					teamId: input.teamId,
					competitionId: input.competitionId,
					trackWorkoutId: input.trackWorkoutId,
					membershipId: input.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: input.laneShiftPattern,
					notes: rotation.notes,
				})

				createdRotations.push(created)
			}

			return {
				success: true,
				data: {
					rotationIds: createdRotations.map((r) => r.id),
					rotations: createdRotations,
				},
			}
		} catch (error) {
			console.error("Failed to batch update volunteer rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to batch update volunteer rotations",
			)
		}
	})

/**
 * Delete all rotations for a specific volunteer in an event
 */
export const deleteVolunteerRotationsAction = createServerAction()
	.input(deleteVolunteerRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			// Delete all rotations for this volunteer in this event
			const result = await db
				.delete(competitionJudgeRotationsTable)
				.where(
					and(
						eq(competitionJudgeRotationsTable.teamId, input.teamId),
						eq(competitionJudgeRotationsTable.membershipId, input.membershipId),
						eq(
							competitionJudgeRotationsTable.trackWorkoutId,
							input.trackWorkoutId,
						),
					),
				)
				.returning({ id: competitionJudgeRotationsTable.id })

			// Revalidate the rotation list
			revalidatePath(
				`/compete/organizer/${input.teamId}/volunteers/judges`,
				"page",
			)

			return {
				success: true,
				data: { deletedCount: result.length },
			}
		} catch (error) {
			console.error("Failed to delete volunteer rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to delete volunteer rotations",
			)
		}
	})
