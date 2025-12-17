/**
 * Migration Script: Convert existing per-heat judge assignments to rotation model
 *
 * This script analyzes existing competition_heat_volunteers assignments and detects
 * consecutive heat patterns, converting them into judge rotations.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-judge-assignments-to-rotations.ts
 *
 * What it does:
 * 1. Query existing assignments grouped by (membershipId, trackWorkoutId)
 * 2. Detect consecutive heat patterns (e.g., heats 1,2,3,4 → rotation starting at 1, count 4)
 * 3. Create rotation records from detected patterns
 * 4. Link assignments back to rotations via rotationId FK
 * 5. Flag ambiguous cases (non-consecutive heats) for manual review
 *
 * The script is idempotent - safe to run multiple times.
 */

import { eq } from "drizzle-orm"
import { getDb } from "../src/db"
import {
	competitionHeatVolunteersTable,
	competitionJudgeRotationsTable,
	VOLUNTEER_ROLE_TYPES,
} from "../src/db/schema"

interface HeatAssignment {
	id: string
	heatId: string
	membershipId: string
	laneNumber: number | null
	position: string | null
	heatNumber: number
	trackWorkoutId: string
	competitionId: string
}

interface DetectedRotation {
	membershipId: string
	trackWorkoutId: string
	competitionId: string
	startingHeat: number
	heatsCount: number
	startingLane: number
	assignmentIds: string[]
}

interface AmbiguousCase {
	membershipId: string
	trackWorkoutId: string
	heats: number[]
}

/**
 * Detects consecutive heat sequences from assignment data
 */
function detectConsecutiveSequences(
	assignments: HeatAssignment[],
): { rotations: DetectedRotation[]; ambiguous: AmbiguousCase[] } {
	const rotations: DetectedRotation[] = []
	const ambiguous: AmbiguousCase[] = []

	// Group by (membershipId, trackWorkoutId)
	const grouped = new Map<
		string,
		{
			membershipId: string
			trackWorkoutId: string
			competitionId: string
			assignments: HeatAssignment[]
		}
	>()

	for (const assignment of assignments) {
		const key = `${assignment.membershipId}:${assignment.trackWorkoutId}`
		const existing = grouped.get(key)

		if (existing) {
			existing.assignments.push(assignment)
		} else {
			grouped.set(key, {
				membershipId: assignment.membershipId,
				trackWorkoutId: assignment.trackWorkoutId,
				competitionId: assignment.competitionId,
				assignments: [assignment],
			})
		}
	}

	// Process each group to detect consecutive sequences
	for (const group of grouped.values()) {
		// Sort by heat number
		const sorted = group.assignments.sort(
			(a, b) => a.heatNumber - b.heatNumber,
		)

		// Find consecutive sequences
		const sequences: DetectedRotation[] = []
		let currentSequence: HeatAssignment[] = [sorted[0]]

		for (let i = 1; i < sorted.length; i++) {
			const prev = sorted[i - 1]
			const curr = sorted[i]

			// Check if consecutive
			if (curr.heatNumber === prev.heatNumber + 1) {
				currentSequence.push(curr)
			} else {
				// End current sequence
				if (currentSequence.length > 0) {
					sequences.push(createRotationFromSequence(group, currentSequence))
				}
				// Start new sequence
				currentSequence = [curr]
			}
		}

		// Don't forget the last sequence
		if (currentSequence.length > 0) {
			sequences.push(createRotationFromSequence(group, currentSequence))
		}

		// If we have multiple non-consecutive sequences, flag as ambiguous
		if (sequences.length > 1) {
			ambiguous.push({
				membershipId: group.membershipId,
				trackWorkoutId: group.trackWorkoutId,
				heats: sorted.map((a) => a.heatNumber),
			})
		}

		rotations.push(...sequences)
	}

	return { rotations, ambiguous }
}

/**
 * Creates a rotation record from a consecutive sequence of assignments
 */
function createRotationFromSequence(
	group: {
		membershipId: string
		trackWorkoutId: string
		competitionId: string
	},
	sequence: HeatAssignment[],
): DetectedRotation {
	const startingHeat = sequence[0].heatNumber
	const heatsCount = sequence.length
	const startingLane = sequence[0].laneNumber || 1

	return {
		membershipId: group.membershipId,
		trackWorkoutId: group.trackWorkoutId,
		competitionId: group.competitionId,
		startingHeat,
		heatsCount,
		startingLane,
		assignmentIds: sequence.map((a) => a.id),
	}
}

async function main() {
	console.log("🔄 Starting judge assignments → rotations migration...\n")

	const db = getDb()

	// Step 1: Query all existing judge assignments with heat details
	console.log("📊 Step 1: Querying existing assignments...\n")

	const assignments = await db.query.competitionHeatVolunteersTable.findMany({
		with: {
			heat: true,
		},
		where: eq(
			competitionHeatVolunteersTable.position,
			VOLUNTEER_ROLE_TYPES.JUDGE,
		),
	})

	console.log(`   Found ${assignments.length} judge assignments\n`)

	if (assignments.length === 0) {
		console.log("✅ No assignments found. Nothing to migrate.\n")
		return
	}

	// Transform to simplified structure
	const transformedAssignments: HeatAssignment[] = assignments.map((a) => ({
		id: a.id,
		heatId: a.heatId,
		membershipId: a.membershipId,
		laneNumber: a.laneNumber,
		position: a.position,
		heatNumber: a.heat.heatNumber,
		trackWorkoutId: a.heat.trackWorkoutId,
		competitionId: a.heat.competitionId,
	}))

	// Step 2: Detect consecutive sequences
	console.log("🔍 Step 2: Detecting consecutive heat patterns...\n")

	const { rotations, ambiguous } = detectConsecutiveSequences(
		transformedAssignments,
	)

	console.log(`   Detected ${rotations.length} rotation(s)\n`)

	if (ambiguous.length > 0) {
		console.log(`   ⚠️  Found ${ambiguous.length} ambiguous case(s):\n`)
		for (const amb of ambiguous) {
			console.log(
				`      • Membership ${amb.membershipId.slice(0, 8)}... on workout ${amb.trackWorkoutId.slice(0, 8)}...`,
			)
			console.log(`        Non-consecutive heats: ${amb.heats.join(", ")}\n`)
		}
	}

	// Step 3: Create rotation records
	console.log("💾 Step 3: Creating rotation records...\n")

	let createdCount = 0
	const rotationIdMap = new Map<string, string>() // assignmentId -> rotationId

	for (const rotation of rotations) {
		try {
			// Insert rotation
			const [inserted] = await db
				.insert(competitionJudgeRotationsTable)
				.values({
					competitionId: rotation.competitionId,
					trackWorkoutId: rotation.trackWorkoutId,
					membershipId: rotation.membershipId,
					startingHeat: rotation.startingHeat,
					startingLane: rotation.startingLane,
					heatsCount: rotation.heatsCount,
					laneShiftPattern: "stay", // Default to staying in same lane
				})
				.returning()

			// Map assignment IDs to rotation ID
			for (const assignmentId of rotation.assignmentIds) {
				rotationIdMap.set(assignmentId, inserted.id)
			}

			createdCount++
			console.log(
				`   ✅ Created rotation: Heat ${rotation.startingHeat}, Count ${rotation.heatsCount}, Lane ${rotation.startingLane}`,
			)
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			console.error(
				`   ❌ Failed to create rotation for membership ${rotation.membershipId}: ${msg}`,
			)
		}
	}

	console.log(`\n   Created ${createdCount} rotation record(s)\n`)

	// Step 4: Update assignment records with rotationId
	console.log("🔗 Step 4: Linking assignments to rotations...\n")

	let linkedCount = 0
	const assignmentIds = Array.from(rotationIdMap.keys())

	// Use autochunk to handle potential large datasets
	for (const assignmentId of assignmentIds) {
		const rotationId = rotationIdMap.get(assignmentId)
		if (!rotationId) continue

		try {
			await db
				.update(competitionHeatVolunteersTable)
				.set({ rotationId })
				.where(eq(competitionHeatVolunteersTable.id, assignmentId))

			linkedCount++
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			console.error(`   ❌ Failed to link assignment ${assignmentId}: ${msg}`)
		}
	}

	console.log(`   Linked ${linkedCount} assignment(s)\n`)

	// Final report
	console.log("━".repeat(60))
	console.log("\n📋 Migration Summary:\n")
	console.log(`   Total assignments found:     ${assignments.length}`)
	console.log(`   Rotations detected:          ${rotations.length}`)
	console.log(`   Rotations created:           ${createdCount}`)
	console.log(`   Assignments linked:          ${linkedCount}`)
	console.log(`   Ambiguous cases (review):    ${ambiguous.length}\n`)

	if (ambiguous.length > 0) {
		console.log("⚠️  Manual review needed for ambiguous cases above.\n")
	}

	console.log("✨ Migration complete!\n")
}

main()
	.then(() => {
		process.exit(0)
	})
	.catch((error) => {
		console.error("Fatal error:", error)
		process.exit(1)
	})
