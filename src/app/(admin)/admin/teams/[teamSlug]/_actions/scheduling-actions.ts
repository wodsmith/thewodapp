"use server"

import { TEAM_PERMISSIONS } from "@/db/schema"
import {
	type ScheduleWorkoutInput,
	getScheduledWorkoutsForTeam,
	scheduleWorkoutForTeam,
} from "@/server/scheduling-service"
import { requireTeamPermission } from "@/utils/team-auth"
import { z } from "zod"
import { createServerAction } from "zsa"

const getScheduledWorkoutsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	startDate: z.string(),
	endDate: z.string(),
})

const scheduleWorkoutSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required"),
	scheduledDate: z.string(),
	teamSpecificNotes: z.string().optional(),
	scalingGuidanceForDay: z.string().optional(),
	classTimes: z.string().optional(),
})

/**
 * Get scheduled workouts for a team within a date range
 */
export const getScheduledWorkoutsAction = createServerAction()
	.input(getScheduledWorkoutsSchema)
	.handler(async ({ input }) => {
		const { teamId, startDate, endDate } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		const dateRange = {
			start: new Date(startDate),
			end: new Date(endDate),
		}

		const scheduledWorkouts = await getScheduledWorkoutsForTeam(
			teamId,
			dateRange,
		)

		console.log(
			`INFO: [SchedulingService] Retrieved ${scheduledWorkouts.length} scheduled workouts for teamId '${teamId}' between '${startDate}' and '${endDate}'`,
		)

		return { success: true, data: scheduledWorkouts }
	})

/**
 * Schedule a new workout for the team
 */
export const scheduleWorkoutAction = createServerAction()
	.input(scheduleWorkoutSchema)
	.handler(async ({ input }) => {
		const { teamId, trackWorkoutId, scheduledDate, ...rest } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		const scheduleData: ScheduleWorkoutInput = {
			teamId,
			trackWorkoutId,
			scheduledDate: new Date(scheduledDate),
			...rest,
		}

		const scheduledWorkout = await scheduleWorkoutForTeam(scheduleData)

		console.log(
			`INFO: [SchedulingService] Scheduled trackWorkoutId '${trackWorkoutId}' for teamId '${teamId}' on '${scheduledDate}'. InstanceId: '${scheduledWorkout.id}'`,
		)

		return { success: true, data: scheduledWorkout }
	})
