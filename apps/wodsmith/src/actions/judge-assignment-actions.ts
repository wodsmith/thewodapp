"use server"

import { createServerAction, ZSAError } from "@repo/zsa"
import { z } from "zod"
import { getDb } from "@/db"
import {
	getActiveAssignments,
	getActiveVersion,
	getAssignmentsForVersion,
	getVersionHistory,
	publishRotations,
	rollbackToVersion,
} from "@/server/judge-assignments"

// ============================================================================
// Schemas
// ============================================================================

const publishRotationsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackWorkoutId: z.string().min(1, "Event ID is required"),
	publishedBy: z.string().min(1, "Publisher user ID is required"),
	notes: z.string().max(1000, "Notes too long").optional(),
})

const getActiveVersionSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const getVersionHistorySchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

const rollbackToVersionSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	versionId: z.string().min(1, "Version ID is required"),
})

const getAssignmentsForVersionSchema = z.object({
	versionId: z.string().min(1, "Version ID is required"),
})

const getActiveAssignmentsSchema = z.object({
	trackWorkoutId: z.string().min(1, "Event ID is required"),
})

// ============================================================================
// Actions
// ============================================================================

/**
 * Publish rotations as a new version.
 * Materializes all rotation patterns into individual heat+lane assignments.
 */
export const publishRotationsAction = createServerAction()
	.input(publishRotationsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			const version = await publishRotations(db, {
				trackWorkoutId: input.trackWorkoutId,
				publishedBy: input.publishedBy,
				notes: input.notes,
				teamId: input.teamId,
			})

			return { success: true, data: version }
		} catch (error) {
			console.error("Failed to publish rotations:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to publish rotations",
			)
		}
	})

/**
 * Get the currently active version for an event
 */
export const getActiveVersionAction = createServerAction()
	.input(getActiveVersionSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const version = await getActiveVersion(db, input.trackWorkoutId)

			return { success: true, data: version }
		} catch (error) {
			console.error("Failed to get active version:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get active version",
			)
		}
	})

/**
 * Get version history for an event
 */
export const getVersionHistoryAction = createServerAction()
	.input(getVersionHistorySchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const versions = await getVersionHistory(db, input.trackWorkoutId)

			return { success: true, data: versions }
		} catch (error) {
			console.error("Failed to get version history:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get version history",
			)
		}
	})

/**
 * Rollback to a different version by setting it as active
 */
export const rollbackToVersionAction = createServerAction()
	.input(rollbackToVersionSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()

			const version = await rollbackToVersion(db, {
				versionId: input.versionId,
				teamId: input.teamId,
			})

			return { success: true, data: version }
		} catch (error) {
			console.error("Failed to rollback version:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to rollback version")
		}
	})

/**
 * Get all assignments for a specific version
 */
export const getAssignmentsForVersionAction = createServerAction()
	.input(getAssignmentsForVersionSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const assignments = await getAssignmentsForVersion(db, input.versionId)

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to get assignments for version:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get assignments for version",
			)
		}
	})

/**
 * Get assignments for the active version of an event
 */
export const getActiveAssignmentsAction = createServerAction()
	.input(getActiveAssignmentsSchema)
	.handler(async ({ input }) => {
		try {
			const db = getDb()
			const assignments = await getActiveAssignments(db, input.trackWorkoutId)

			return { success: true, data: assignments }
		} catch (error) {
			console.error("Failed to get active assignments:", error)

			if (error instanceof ZSAError) {
				throw error
			}

			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to get active assignments",
			)
		}
	})
