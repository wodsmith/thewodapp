/**
 * Admin Team Server Functions for TanStack Start
 * Functions for site-wide admin team management (require ADMIN role)
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { desc, sql, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { teamTable, teamMembershipTable } from "@/db/schemas/teams"
import type { Team, TeamMembership } from "@/db/schemas/teams"
import { competitionsTable } from "@/db/schemas/competitions"
import {
	scheduledWorkoutInstancesTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts } from "@/db/schemas/workouts"
import { requireAdmin } from "@/utils/auth"

// ============================================================================
// Types
// ============================================================================

export interface AdminTeamWithStats extends Team {
	memberCount: number
	competitionCount: number
}

export interface AdminTeamDetail extends Team {
	memberships: Array<
		TeamMembership & {
			user: {
				id: string
				email: string
				firstName: string | null
				lastName: string | null
			}
		}
	>
	competitionCount: number
}

// ============================================================================
// Input Schemas
// ============================================================================

const getTeamByIdInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get ALL teams for admin view (no filtering by user)
 * This is for admin-only use - shows all teams from all users.
 * Ordered by createdAt DESC to show newest first.
 */
export const getAllTeamsForAdminFn = createServerFn({
	method: "GET",
}).handler(async () => {
	// Require site admin role
	const session = await requireAdmin()
	if (!session) {
		throw new Error("Not authorized - admin access required")
	}

	const db = getDb()

	// Get all teams
	const teams = await db
		.select({
			id: teamTable.id,
			name: teamTable.name,
			slug: teamTable.slug,
			description: teamTable.description,
			avatarUrl: teamTable.avatarUrl,
			type: teamTable.type,
			creditBalance: teamTable.creditBalance,
			currentPlanId: teamTable.currentPlanId,
			stripeAccountStatus: teamTable.stripeAccountStatus,
			createdAt: teamTable.createdAt,
			updatedAt: teamTable.updatedAt,
			isPersonalTeam: teamTable.isPersonalTeam,
			// Count members
			memberCount: sql<number>`(
        SELECT COUNT(*) FROM ${teamMembershipTable}
        WHERE ${teamMembershipTable.teamId} = ${teamTable.id}
        AND ${teamMembershipTable.isActive} = 1
      )`.as("memberCount"),
			// Count competitions
			competitionCount: sql<number>`(
        SELECT COUNT(*) FROM ${competitionsTable}
        WHERE ${competitionsTable.organizingTeamId} = ${teamTable.id}
        OR ${competitionsTable.competitionTeamId} = ${teamTable.id}
      )`.as("competitionCount"),
		})
		.from(teamTable)
		.orderBy(desc(teamTable.createdAt))

	return {
		teams: teams as AdminTeamWithStats[],
	}
})

/**
 * Get a single team by ID with detailed information
 * This is for admin-only use.
 */
export const getTeamByIdForAdminFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getTeamByIdInputSchema.parse(data))
	.handler(async ({ data }) => {
		// Require site admin role
		const session = await requireAdmin()
		if (!session) {
			throw new Error("Not authorized - admin access required")
		}

		const db = getDb()

		// Get team with relations
		const team = await db.query.teamTable.findFirst({
			where: eq(teamTable.id, data.teamId),
			with: {
				memberships: {
					with: {
						user: {
							columns: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
			},
		})

		if (!team) {
			return { team: null }
		}

		// Get competition count separately
		const [competitionCountResult] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(competitionsTable)
			.where(
				sql`${competitionsTable.organizingTeamId} = ${data.teamId}
            OR ${competitionsTable.competitionTeamId} = ${data.teamId}`,
			)

		return {
			team: {
				...team,
				competitionCount: competitionCountResult?.count ?? 0,
			} as AdminTeamDetail,
		}
	})

/**
 * Get team statistics for admin dashboard
 */
export const getAdminTeamStatsFn = createServerFn({
	method: "GET",
}).handler(async () => {
	// Require site admin role
	const session = await requireAdmin()
	if (!session) {
		throw new Error("Not authorized - admin access required")
	}

	const db = getDb()

	// Get total team count
	const [totalResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(teamTable)

	// Get gym team count (non-personal teams)
	const [gymResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(teamTable)
		.where(eq(teamTable.type, "gym"))

	// Get personal team count
	const [personalResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(teamTable)
		.where(eq(teamTable.isPersonalTeam, 1))

	// Get competition event team count
	const [competitionEventResult] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(teamTable)
		.where(eq(teamTable.type, "competition_event"))

	return {
		stats: {
			total: totalResult?.count ?? 0,
			gyms: gymResult?.count ?? 0,
			personal: personalResult?.count ?? 0,
			competitionEvents: competitionEventResult?.count ?? 0,
		},
	}
})

// ============================================================================
// Scheduling Server Functions
// ============================================================================

export interface ScheduledWorkoutEvent {
	id: string
	title: string
	start: string
	allDay: boolean
	extendedProps: {
		workoutName: string
		notes?: string
		classTimes?: string
	}
}

const getScheduledWorkoutsForAdminInputSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	startDate: z.string(),
	endDate: z.string(),
})

/**
 * Get scheduled workouts for a team (admin view)
 * Returns calendar-ready events for FullCalendar display
 */
export const getScheduledWorkoutsForAdminFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) =>
		getScheduledWorkoutsForAdminInputSchema.parse(data),
	)
	.handler(async ({ data }) => {
		// Require site admin role
		const session = await requireAdmin()
		if (!session) {
			throw new Error("Not authorized - admin access required")
		}

		const db = getDb()

		// Parse dates - handle both ISO strings and date-only strings
		const startDateObj = data.startDate.includes("T")
			? new Date(data.startDate)
			: new Date(`${data.startDate}T00:00:00Z`)
		const endDateObj = data.endDate.includes("T")
			? new Date(data.endDate)
			: new Date(`${data.endDate}T23:59:59Z`)

		// Get scheduled workouts with joins to get workout names
		const rows = await db
			.select({
				instance: scheduledWorkoutInstancesTable,
				trackWorkout: trackWorkoutsTable,
				workout: workouts,
			})
			.from(scheduledWorkoutInstancesTable)
			.leftJoin(
				trackWorkoutsTable,
				eq(
					trackWorkoutsTable.id,
					scheduledWorkoutInstancesTable.trackWorkoutId,
				),
			)
			.leftJoin(
				workouts,
				eq(workouts.id, scheduledWorkoutInstancesTable.workoutId),
			)
			.where(
				sql`${scheduledWorkoutInstancesTable.teamId} = ${data.teamId}
					AND ${scheduledWorkoutInstancesTable.scheduledDate} BETWEEN ${startDateObj} AND ${endDateObj}`,
			)

		// For rows without explicit workoutId, we need to get the workout from the track
		const trackWorkoutIds = rows
			.filter((r) => !r.instance.workoutId && r.trackWorkout?.workoutId)
			.map((r) => r.trackWorkout?.workoutId)
			.filter((id): id is string => id !== undefined)

		// Fetch workouts for track-based instances that don't have explicit workoutId
		const trackWorkoutMap = new Map<string, typeof workouts.$inferSelect>()
		if (trackWorkoutIds.length > 0) {
			const trackWorkoutsData = await db
				.select()
				.from(workouts)
				.where(inArray(workouts.id, trackWorkoutIds))
			for (const w of trackWorkoutsData) {
				trackWorkoutMap.set(w.id, w)
			}
		}

		// Convert to calendar events
		const events: ScheduledWorkoutEvent[] = rows.map((r) => {
			// Determine workout name: explicit workout > track workout's original > fallback
			let workoutName = "Unknown Workout"
			if (r.workout) {
				workoutName = r.workout.name
			} else if (r.trackWorkout?.workoutId) {
				const trackWorkout = trackWorkoutMap.get(r.trackWorkout.workoutId)
				if (trackWorkout) {
					workoutName = trackWorkout.name
				}
			}

			return {
				id: r.instance.id,
				title: workoutName,
				start: new Date(r.instance.scheduledDate).toISOString(),
				allDay: true,
				extendedProps: {
					workoutName,
					notes: r.instance.teamSpecificNotes || undefined,
					classTimes: r.instance.classTimes || undefined,
				},
			}
		})

		return { success: true, events }
	})
