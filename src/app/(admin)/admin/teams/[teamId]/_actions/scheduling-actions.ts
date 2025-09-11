"use server"

import { revalidatePath } from "next/cache"
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

		// Parse dates as UTC to ensure consistent date handling
		// If the date already includes time and timezone, use it as-is
		const startDateObj = startDate.includes("T")
			? new Date(startDate)
			: new Date(`${startDate}T00:00:00Z`)
		const endDateObj = endDate.includes("T")
			? new Date(endDate)
			: new Date(`${endDate}T23:59:59Z`)

		const dateRange = {
			start: startDateObj,
			end: endDateObj,
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

		// Parse YYYY-MM-DD string as a date at noon UTC to avoid timezone boundary issues
		// This ensures the date remains stable across all timezones
		const scheduleData: ScheduleWorkoutInput = {
			teamId,
			trackWorkoutId,
			scheduledDate: new Date(`${scheduledDate}T12:00:00Z`),
			...rest,
		}

		const scheduledWorkout = await scheduleWorkoutForTeam(scheduleData)

		console.log(
			`INFO: [SchedulingService] Scheduled trackWorkoutId '${trackWorkoutId}' for teamId '${teamId}' on '${scheduledDate}'. InstanceId: '${scheduledWorkout.id}'`,
		)

		// Revalidate the team scheduling page to refresh calendar
		revalidatePath(`/admin/teams/${teamId}`)
		revalidatePath(`/admin/teams/${teamId}/schedule`)

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

		// Parse YYYY-MM-DD string as a date at noon UTC to avoid timezone boundary issues
		// This ensures the date remains stable across all timezones
		const scheduledDateUTC = new Date(`${scheduledDate}T12:00:00Z`)

		// Create temporary track and track workout for the standalone workout
		const trackWorkout = await scheduleStandaloneWorkout({
			teamId,
			workoutId,
			scheduledDate: scheduledDateUTC,
			...rest,
		})

		// Now schedule it using the existing scheduling system
		const scheduleData: ScheduleWorkoutInput = {
			teamId,
			trackWorkoutId: trackWorkout.id,
			scheduledDate: scheduledDateUTC,
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

		// Revalidate the team scheduling page to refresh calendar
		revalidatePath(`/admin/teams/${teamId}`)
		revalidatePath(`/admin/teams/${teamId}/schedule`)

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

const updateScheduledWorkoutInstanceSchema = z.object({
	instanceId: z.string().min(1, "Instance ID is required"),
	data: z.object({
		workoutId: z.string().optional(),
		teamSpecificNotes: z.string().optional(),
		scalingGuidanceForDay: z.string().optional(),
		classTimes: z.string().optional(),
	}),
})

/**
 * Update a scheduled workout instance (including workoutId for remixes)
 */
export const updateScheduledWorkoutInstanceAction = createServerAction()
	.input(updateScheduledWorkoutInstanceSchema)
	.handler(async ({ input }) => {
		const { instanceId, data } = input

		// Get the instance to check team permissions
		const instance = await getScheduledWorkoutInstanceById(instanceId)
		if (!instance) {
			throw new Error("Scheduled workout not found")
		}

		// Check permissions
		await requireTeamPermission(
			instance.teamId,
			TEAM_PERMISSIONS.ACCESS_DASHBOARD,
		)

		const updatedInstance = await updateScheduledWorkoutInstance(
			instanceId,
			data,
		)

		console.log(
			`INFO: [SchedulingService] Updated scheduled workout instance '${instanceId}' with data:`,
			data,
		)

		// Revalidate the team scheduling page to refresh calendar
		revalidatePath(`/admin/teams/${instance.teamId}`)
		revalidatePath(`/admin/teams/${instance.teamId}/schedule`)

		return { success: true, data: updatedInstance }
	})
