import "server-only"

import { and, asc, desc, eq } from "drizzle-orm"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import type * as schema from "@/db/schema"
import {
	competitionHeatsTable,
	competitionJudgeRotationsTable,
	competitionsTable,
	competitionVenuesTable,
	type JudgeAssignmentVersion,
	type JudgeHeatAssignment,
	judgeAssignmentVersionsTable,
	judgeHeatAssignmentsTable,
	LANE_SHIFT_PATTERN,
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { requireTeamPermission } from "@/utils/team-auth"

type Db = DrizzleD1Database<typeof schema>

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
// Version Management Functions
// ============================================================================

/**
 * Get the currently active version for an event
 * Returns null if no version has been published yet
 */
export async function getActiveVersion(
	db: Db,
	trackWorkoutId: string,
): Promise<JudgeAssignmentVersion | null> {
	const version = await db.query.judgeAssignmentVersionsTable.findFirst({
		where: and(
			eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
			eq(judgeAssignmentVersionsTable.isActive, true),
		),
	})

	return version ?? null
}

/**
 * Get version history for an event, newest first
 */
export async function getVersionHistory(
	db: Db,
	trackWorkoutId: string,
): Promise<JudgeAssignmentVersion[]> {
	return db.query.judgeAssignmentVersionsTable.findMany({
		where: eq(judgeAssignmentVersionsTable.trackWorkoutId, trackWorkoutId),
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
}

/**
 * Rollback to a different version by setting it as active
 */
export async function rollbackToVersion(
	db: Db,
	params: RollbackToVersionParams,
): Promise<JudgeAssignmentVersion> {
	// Get the version to rollback to
	const targetVersion = await db.query.judgeAssignmentVersionsTable.findFirst({
		where: eq(judgeAssignmentVersionsTable.id, params.versionId),
	})

	if (!targetVersion) {
		throw new Error("Version not found")
	}

	// Permission check
	await requireTeamPermission(
		params.teamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

	// Deactivate all versions for this event
	await db
		.update(judgeAssignmentVersionsTable)
		.set({ isActive: false, updatedAt: new Date() })
		.where(
			eq(
				judgeAssignmentVersionsTable.trackWorkoutId,
				targetVersion.trackWorkoutId,
			),
		)

	// Activate the target version
	const [updatedVersion] = await db
		.update(judgeAssignmentVersionsTable)
		.set({ isActive: true, updatedAt: new Date() })
		.where(eq(judgeAssignmentVersionsTable.id, params.versionId))
		.returning()

	if (!updatedVersion) {
		throw new Error("Failed to activate version")
	}

	return updatedVersion
}

// ============================================================================
// Materialization Logic
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
	db: Db,
	trackWorkoutId: string,
	maxLanes: number,
): Promise<MaterializedAssignment[]> {
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

	// Expand each rotation
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

/**
 * Publish rotations as a new version
 * Creates a new version, materializes all rotations into judge_heat_assignments,
 * and deactivates the previous version.
 */
export async function publishRotations(
	db: Db,
	params: PublishRotationsParams,
): Promise<JudgeAssignmentVersion> {
	// Permission check
	await requireTeamPermission(
		params.teamId,
		TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
	)

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
		.where(eq(trackWorkoutsTable.id, params.trackWorkoutId))

	if (result.length === 0) {
		throw new Error("Event or competition not found")
	}

	// Find max lanes from venues
	const maxLanes = result.reduce(
		(max: number, row) => Math.max(max, row.venues.laneCount),
		3,
	)

	// Get next version number
	const versions = await getVersionHistory(db, params.trackWorkoutId)
	const nextVersion = versions.length > 0 ? (versions[0]?.version ?? 0) + 1 : 1

	// Deactivate previous versions (no transactions in D1)
	await db
		.update(judgeAssignmentVersionsTable)
		.set({ isActive: false, updatedAt: new Date() })
		.where(
			eq(judgeAssignmentVersionsTable.trackWorkoutId, params.trackWorkoutId),
		)

	// Create new version
	const [newVersion] = await db
		.insert(judgeAssignmentVersionsTable)
		.values({
			trackWorkoutId: params.trackWorkoutId,
			version: nextVersion,
			publishedBy: params.publishedBy,
			notes: params.notes ?? null,
			isActive: true,
		})
		.returning()

	if (!newVersion) {
		throw new Error("Failed to create version")
	}

	// Materialize all rotations
	const materializedAssignments = await materializeRotations(
		db,
		params.trackWorkoutId,
		maxLanes,
	)

	// Bulk insert assignments using manual chunking
	// Drizzle inserts all columns including auto-generated ones:
	// createdAt, updatedAt, updateCounter, id, heatId, membershipId, rotationId, versionId, laneNumber, position, instructions, isManualOverride
	// That's 11 params per row (instructions is null literal).
	// D1 has a 100 bound parameter limit (NOT 999 like standard SQLite).
	// max rows per batch = floor(100 / 11) = 9, use 8 for safety
	const INSERT_BATCH_SIZE = 8
	if (materializedAssignments.length > 0) {
		const chunks: MaterializedAssignment[][] = []
		for (
			let i = 0;
			i < materializedAssignments.length;
			i += INSERT_BATCH_SIZE
		) {
			chunks.push(materializedAssignments.slice(i, i + INSERT_BATCH_SIZE))
		}

		for (const chunk of chunks) {
			await db.insert(judgeHeatAssignmentsTable).values(
				chunk.map((a) => ({
					heatId: a.heatId,
					membershipId: a.membershipId,
					rotationId: a.rotationId,
					laneNumber: a.laneNumber,
					position: a.position,
					versionId: newVersion.id,
					isManualOverride: false,
				})),
			)
		}
	}

	return newVersion
}

/**
 * Get all assignments for a specific version
 */
export async function getAssignmentsForVersion(
	db: Db,
	versionId: string,
): Promise<JudgeHeatAssignment[]> {
	return db.query.judgeHeatAssignmentsTable.findMany({
		where: eq(judgeHeatAssignmentsTable.versionId, versionId),
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
}

/**
 * Get assignments for the active version of an event
 */
export async function getActiveAssignments(
	db: Db,
	trackWorkoutId: string,
): Promise<JudgeHeatAssignment[]> {
	const activeVersion = await getActiveVersion(db, trackWorkoutId)

	if (!activeVersion) {
		return []
	}

	return getAssignmentsForVersion(db, activeVersion.id)
}
