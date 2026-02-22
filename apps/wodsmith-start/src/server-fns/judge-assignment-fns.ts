/**
 * Judge Assignment Server Functions for TanStack Start
 * Manages judge-to-heat assignments, lane assignments, and version management.
 * Port from wodsmith/src/server/judge-assignments.ts and wodsmith/src/actions/judge-assignment-actions.ts
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { JudgeAssignmentVersion, JudgeHeatAssignment } from "@/db/schema"
import {
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	competitionsTable,
	competitionVenuesTable,
	judgeAssignmentVersionsTable,
	judgeHeatAssignmentsTable,
	LANE_SHIFT_PATTERN,
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"

// ============================================================================
// Types
// ============================================================================

export interface PublishRotationsParams {
	trackWorkoutId: string
	publishedBy: string // User ID
	notes?: string
	teamId: string // For permission check
}

export interface RollbackToVersionParams {
	versionId: string
	teamId: string // For permission check
}

type MaterializedAssignment = Record<string, unknown> & {
	heatId: string
	membershipId: string
	rotationId: string
	laneNumber: number
	position: "judge" // Judge rotations always create judge assignments
}

// ============================================================================
// Input Schemas
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
// Internal Helper Functions
// ============================================================================

/**
 * Calculate lane number based on shift pattern
 */
function calculateLane(
	startingLane: number,
	heatIndex: number,
	laneShiftPattern: string,
	maxLanes: number,
): number {
	switch (laneShiftPattern) {
		case LANE_SHIFT_PATTERN.STAY:
			return startingLane

		case LANE_SHIFT_PATTERN.SHIFT_RIGHT:
			// Move right (lane + 1), wrap around
			return ((startingLane - 1 + heatIndex) % maxLanes) + 1

		default:
			return startingLane
	}
}

/**
 * Expand rotations into individual heat+lane assignments
 */
async function materializeRotations(
	trackWorkoutId: string,
	maxLanes: number,
): Promise<MaterializedAssignment[]> {
	const db = getDb()
	const assignments: MaterializedAssignment[] = []

	// Get all rotations for this event
	const rotations = await db.query.competitionJudgeRotationsTable.findMany({
		where: eq(competitionJudgeRotationsTable.trackWorkoutId, trackWorkoutId),
	})

	// Get all heats for this event, sorted by heat number
	const heats = await db
		.select({
			id: competitionHeatsTable.id,
			heatNumber: competitionHeatsTable.heatNumber,
		})
		.from(competitionHeatsTable)
		.where(eq(competitionHeatsTable.trackWorkoutId, trackWorkoutId))
		.orderBy(asc(competitionHeatsTable.heatNumber))

	// Build heat number -> ID map
	const heatMap = new Map(heats.map((h) => [h.heatNumber, h.id]))

	// Expand each rotation, deduplicating by (heatId, membershipId) to avoid
	// unique constraint violations if rotations overlap on the same heat+judge
	const seen = new Set<string>()

	for (const rotation of rotations) {
		for (let i = 0; i < rotation.heatsCount; i++) {
			const heatNumber = rotation.startingHeat + i
			const heatId = heatMap.get(heatNumber)

			if (!heatId) {
				console.warn(
					`Heat ${heatNumber} not found for rotation ${rotation.id}, skipping`,
				)
				continue
			}

			const key = `${heatId}:${rotation.membershipId}`
			if (seen.has(key)) {
				console.warn(
					`Duplicate assignment for heat ${heatNumber}, judge ${rotation.membershipId} from rotation ${rotation.id}, skipping`,
				)
				continue
			}
			seen.add(key)

			const laneNumber = calculateLane(
				rotation.startingLane,
				i,
				rotation.laneShiftPattern,
				maxLanes,
			)

			assignments.push({
				heatId,
				membershipId: rotation.membershipId,
				rotationId: rotation.id,
				laneNumber,
				position: "judge",
			})
		}
	}

	return assignments
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get the currently active version for an event.
 * Returns null if no version has been published yet.
 */
export const getActiveVersionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getActiveVersionSchema.parse(data))
	.handler(async ({ data }): Promise<JudgeAssignmentVersion | null> => {
		const db = getDb()
		const version = await db.query.judgeAssignmentVersionsTable.findFirst({
			where: and(
				eq(judgeAssignmentVersionsTable.trackWorkoutId, data.trackWorkoutId),
				eq(judgeAssignmentVersionsTable.isActive, true),
			),
		})

		return version ?? null
	})

/**
 * Get version history for an event, newest first
 */
export const getVersionHistoryFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getVersionHistorySchema.parse(data))
	.handler(async ({ data }): Promise<JudgeAssignmentVersion[]> => {
		const db = getDb()
		return db.query.judgeAssignmentVersionsTable.findMany({
			where: eq(
				judgeAssignmentVersionsTable.trackWorkoutId,
				data.trackWorkoutId,
			),
			orderBy: desc(judgeAssignmentVersionsTable.version),
			with: {
				publishedByUser: {
					columns: {
						id: true,
						firstName: true,
						lastName: true,
						email: true,
					},
				},
			},
		})
	})

/**
 * Get all assignments for a specific version
 */
export const getAssignmentsForVersionFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getAssignmentsForVersionSchema.parse(data))
	.handler(async ({ data }): Promise<JudgeHeatAssignment[]> => {
		const db = getDb()
		return db.query.judgeHeatAssignmentsTable.findMany({
			where: eq(judgeHeatAssignmentsTable.versionId, data.versionId),
			with: {
				heat: true,
				membership: {
					with: {
						user: {
							columns: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				rotation: true,
			},
			orderBy: [
				asc(judgeHeatAssignmentsTable.heatId),
				asc(judgeHeatAssignmentsTable.laneNumber),
			],
		})
	})

/**
 * Get assignments for the active version of an event
 */
export const getActiveAssignmentsFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getActiveAssignmentsSchema.parse(data))
	.handler(async ({ data }): Promise<JudgeHeatAssignment[]> => {
		const db = getDb()

		// First get the active version
		const activeVersion = await db.query.judgeAssignmentVersionsTable.findFirst(
			{
				where: and(
					eq(judgeAssignmentVersionsTable.trackWorkoutId, data.trackWorkoutId),
					eq(judgeAssignmentVersionsTable.isActive, true),
				),
			},
		)

		if (!activeVersion) {
			return []
		}

		// Then get assignments for that version
		return db.query.judgeHeatAssignmentsTable.findMany({
			where: eq(judgeHeatAssignmentsTable.versionId, activeVersion.id),
			with: {
				heat: true,
				membership: {
					with: {
						user: {
							columns: {
								id: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				rotation: true,
			},
			orderBy: [
				asc(judgeHeatAssignmentsTable.heatId),
				asc(judgeHeatAssignmentsTable.laneNumber),
			],
		})
	})

// ============================================================================
// Mutation Functions
// ============================================================================

/**
 * Publish rotations as a new version.
 * Creates a new version, materializes all rotations into judge_heat_assignments,
 * and deactivates the previous version.
 */
export const publishRotationsFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => publishRotationsSchema.parse(data))
	.handler(async ({ data }): Promise<JudgeAssignmentVersion> => {
		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		const db = getDb()

		// Get event info to find maxLanes - using manual join to get competition venues
		const result = await db
			.select({
				competitionId: programmingTracksTable.competitionId,
				venues: competitionVenuesTable,
			})
			.from(trackWorkoutsTable)
			.innerJoin(
				programmingTracksTable,
				eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
			)
			.innerJoin(
				competitionsTable,
				eq(programmingTracksTable.competitionId, competitionsTable.id),
			)
			.innerJoin(
				competitionVenuesTable,
				eq(competitionsTable.id, competitionVenuesTable.competitionId),
			)
			.where(eq(trackWorkoutsTable.id, data.trackWorkoutId))

		if (result.length === 0) {
			throw new Error("Event or competition not found")
		}

		// Find max lanes from venues
		const maxLanes = result.reduce(
			(max: number, row) => Math.max(max, row.venues.laneCount),
			3,
		)

		// Get next version number
		const versions = await db.query.judgeAssignmentVersionsTable.findMany({
			where: eq(
				judgeAssignmentVersionsTable.trackWorkoutId,
				data.trackWorkoutId,
			),
			orderBy: desc(judgeAssignmentVersionsTable.version),
		})
		const nextVersion =
			versions.length > 0 ? (versions[0]?.version ?? 0) + 1 : 1

		// Materialize all rotations (read-only, before transaction)
		const materializedAssignments = await materializeRotations(
			data.trackWorkoutId,
			maxLanes,
		)

		const { createJudgeAssignmentVersionId } = await import("@/db/schema")
		const newVersionId = createJudgeAssignmentVersionId()

		// Use transaction for atomic version switch + assignment creation
		const newVersion = await db.transaction(async (tx) => {
			// Deactivate previous versions
			await tx
				.update(judgeAssignmentVersionsTable)
				.set({ isActive: false, updatedAt: new Date() })
				.where(
					eq(judgeAssignmentVersionsTable.trackWorkoutId, data.trackWorkoutId),
				)

			// Create new version
			await tx.insert(judgeAssignmentVersionsTable).values({
				id: newVersionId,
				trackWorkoutId: data.trackWorkoutId,
				version: nextVersion,
				publishedBy: data.publishedBy,
				notes: data.notes ?? null,
				isActive: true,
			})

			const version = await tx.query.judgeAssignmentVersionsTable.findFirst({
				where: eq(judgeAssignmentVersionsTable.id, newVersionId),
			})

			if (!version) {
				throw new Error("Failed to create version")
			}

			// Bulk insert all assignments in a single query (MySQL has no param limit)
			if (materializedAssignments.length > 0) {
				await tx.insert(judgeHeatAssignmentsTable).values(
					materializedAssignments.map((a) => ({
						heatId: a.heatId,
						membershipId: a.membershipId,
						rotationId: a.rotationId,
						laneNumber: a.laneNumber,
						position: a.position,
						versionId: version.id,
						isManualOverride: false,
					})),
				)
			}

			return version
		})

		return newVersion
	})

/**
 * Rollback to a different version by setting it as active
 */
export const rollbackToVersionFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => rollbackToVersionSchema.parse(data))
	.handler(async ({ data }): Promise<JudgeAssignmentVersion> => {
		const db = getDb()

		// Get the version to rollback to
		const targetVersion = await db.query.judgeAssignmentVersionsTable.findFirst(
			{
				where: eq(judgeAssignmentVersionsTable.id, data.versionId),
			},
		)

		if (!targetVersion) {
			throw new Error("Version not found")
		}

		// Permission check
		await requireTeamPermission(
			data.teamId,
			TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
		)

		// Use transaction for atomic version switch
		const updatedVersion = await db.transaction(async (tx) => {
			// Deactivate all versions for this event
			await tx
				.update(judgeAssignmentVersionsTable)
				.set({ isActive: false, updatedAt: new Date() })
				.where(
					eq(
						judgeAssignmentVersionsTable.trackWorkoutId,
						targetVersion.trackWorkoutId,
					),
				)

			// Activate the target version
			await tx
				.update(judgeAssignmentVersionsTable)
				.set({ isActive: true, updatedAt: new Date() })
				.where(eq(judgeAssignmentVersionsTable.id, data.versionId))

			const version =
				await tx.query.judgeAssignmentVersionsTable.findFirst({
					where: eq(judgeAssignmentVersionsTable.id, data.versionId),
				})

			if (!version) {
				throw new Error("Failed to activate version")
			}

			return version
		})

		return updatedVersion
	})
