"use server"

import { z } from "zod"
import { createServerAction } from "zsa"
import { TEAM_PERMISSIONS } from "@/db/schema"
import { scheduleStandaloneWorkout } from "@/server/programming-tracks"
import {
	deleteScheduledWorkoutInstance,
	getScheduledWorkoutInstanceById,
	getScheduledWorkoutsForTeam,
	type ScheduleWorkoutInput,
	scheduleWorkoutForTeam,
	updateScheduledWorkoutInstance,
} from "@/server/scheduling-service"
import { requireTeamPermission } from "@/utils/team-auth"

const getScheduledWorkoutsSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	startDate: z.string(),
	endDate: z.string(),
})

const scheduleWorkoutSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	trackWorkoutId: z.string().min(1, "Track workout ID is required").optional(),
	scheduledDate: z.string(),
	teamSpecificNotes: z.string().optional(),
	scalingGuidanceForDay: z.string().optional(),
	classTimes: z.string().optional(),
})

const scheduleStandaloneWorkoutSchema = z.object({
	teamId: z.string().min(1, "Team ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	scheduledDate: z.string(),
	teamSpecificNotes: z.string().optional(),
	scalingGuidanceForDay: z.string().optional(),
	classTimes: z.string().optional(),
})

const updateScheduledWorkoutSchema = z.object({
	instanceId: z.string().min(1, "Instance ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
	teamSpecificNotes: z.string().optional(),
	scalingGuidanceForDay: z.string().optional(),
	classTimes: z.string().optional(),
})

const deleteScheduledWorkoutSchema = z.object({
	instanceId: z.string().min(1, "Instance ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
})

const getScheduledWorkoutSchema = z.object({
	instanceId: z.string().min(1, "Instance ID is required"),
	teamId: z.string().min(1, "Team ID is required"),
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

		if (!trackWorkoutId) {
			throw new Error("Track workout ID is required to schedule a workout")
		}

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

/**
 * Schedule a standalone workout (not from a programming track)
 */
export const scheduleStandaloneWorkoutAction = createServerAction()
	.input(scheduleStandaloneWorkoutSchema)
	.handler(async ({ input }) => {
		const { teamId, workoutId, scheduledDate, ...rest } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Create temporary track and track workout for the standalone workout
		const trackWorkout = await scheduleStandaloneWorkout({
			teamId,
			workoutId,
			scheduledDate: new Date(scheduledDate),
			...rest,
		})

		// Now schedule it using the existing scheduling system
		const scheduleData: ScheduleWorkoutInput = {
			teamId,
			trackWorkoutId: trackWorkout.id,
			scheduledDate: new Date(scheduledDate),
			...rest,
		}

		const scheduledWorkout = await scheduleWorkoutForTeam(scheduleData)

		console.log(
			`INFO: [SchedulingService] Scheduled standalone workoutId '${workoutId}' for teamId '${teamId}' on '${scheduledDate}'. InstanceId: '${scheduledWorkout.id}'`,
		)

		return { success: true, data: scheduledWorkout }
	})

/**
 * Update a scheduled workout instance
 */
export const updateScheduledWorkoutAction = createServerAction()
	.input(updateScheduledWorkoutSchema)
	.handler(async ({ input }) => {
		const { instanceId, teamId, ...updateData } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		// Verify that the instance exists and belongs to the specified team for extra security
		const existingInstance = await getScheduledWorkoutInstanceById(instanceId)
		if (!existingInstance) {
			throw new Error("Scheduled workout not found")
		}

		// Verify the instance belongs to the team
		if (existingInstance.teamId !== teamId) {
			throw new Error(
				"Unauthorized: This scheduled workout belongs to a different team",
			)
		}

		const updatedInstance = await updateScheduledWorkoutInstance(
			instanceId,
			updateData,
		)

		console.log(
			`INFO: [SchedulingService] Updated scheduled workout instance '${instanceId}' for teamId '${teamId}'`,
		)

		return { success: true, data: updatedInstance }
	})

/**
 * Delete a scheduled workout instance
 */
export const deleteScheduledWorkoutAction = createServerAction()
	.input(deleteScheduledWorkoutSchema)
	.handler(async ({ input }) => {
		const { instanceId, teamId } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		await deleteScheduledWorkoutInstance(instanceId)

		console.log(
			`INFO: [SchedulingService] Deleted scheduled workout instance '${instanceId}' for teamId '${teamId}'`,
		)

		return { success: true }
	})

/**
 * Get a single scheduled workout instance
 */
export const getScheduledWorkoutAction = createServerAction()
	.input(getScheduledWorkoutSchema)
	.handler(async ({ input }) => {
		const { instanceId, teamId } = input

		// Check permissions
		await requireTeamPermission(teamId, TEAM_PERMISSIONS.ACCESS_DASHBOARD)

		const instance = await getScheduledWorkoutInstanceById(instanceId)

		if (!instance) {
			throw new Error("Scheduled workout not found")
		}

		console.log(
			`INFO: [SchedulingService] Retrieved scheduled workout instance '${instanceId}' for teamId '${teamId}'`,
		)

		return { success: true, data: instance }
	})
