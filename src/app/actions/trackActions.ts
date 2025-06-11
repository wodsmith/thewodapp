"use server"

import "server-only"
import { getDB } from "@/db" // Import getDB to obtain the database instance
import { trackWorkoutsTable } from "@/db/schema"
import {
	addWorkoutToTrack as addWorkoutToTrackServer,
	getTrackWorkoutsWithDetails as getTrackWorkoutsWithDetailsServer,
} from "@/server/programming-tracks"
import { createTeamProgrammingTrack } from "@/server/team-programming-tracks"
import { createTrack as createTrackServer } from "@/server/tracks"
import { eq } from "drizzle-orm"
import type { SQLiteBatchItem } from "drizzle-orm/sqlite-core" // Added import
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ZSAError, createServerAction } from "zsa"

// Define the schema for the action input
const UpdateTrackWorkoutDayNumbersSchema = z.object({
	trackId: z.string(),
	updates: z.array(
		z.object({
			trackWorkoutId: z.string(),
			dayNumber: z.number(),
		}),
	),
})

// Infer the type for the validated input
type UpdateTrackWorkoutDayNumbersInput = z.infer<
	typeof UpdateTrackWorkoutDayNumbersSchema
>

const createTrackSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	description: z.string().trim().nullable().optional(),
	type: z.enum(["standard", "onboarding", "template"]), // Assuming these are the valid types
	ownerTeamId: z.string().trim().nullable().optional(),
	isPublic: z.boolean().default(false),
})

export const createTrackAction = createServerAction()
	.input(createTrackSchema)
	.handler(async ({ input }) => {
		console.log("[TrackActions] createTrackAction", input)
		try {
			const track = await createTrackServer({
				name: input.name,
				description: input.description,
				type: input.type,
				ownerTeamId: input.ownerTeamId,
				isPublic: input.isPublic,
			}) // Removed currentDb

			const trackId = track.id

			if (input.ownerTeamId) {
				await createTeamProgrammingTrack({
					teamId: input.ownerTeamId,
					trackId,
					isActive: true,
				}) // Removed currentDb
			}

			revalidatePath("/dashboard/admin/tracks") // Or relevant path
			return { success: true, trackId }
		} catch (error) {
			console.error("[TrackActions] Error in createTrackAction:", error)
			if (error instanceof ZSAError) throw error
			throw new ZSAError("INTERNAL_SERVER_ERROR", "Failed to create track.")
		}
	})

const addWorkoutToTrackSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
	workoutId: z.string().min(1, "Workout ID is required"),
	dayNumber: z.coerce.number().min(1, "Day number must be at least 1"),
	weekNumber: z.coerce.number().min(1).optional().nullable(),
	notes: z.string().optional().nullable(),
})

export const addWorkoutToTrackAction = createServerAction()
	.input(addWorkoutToTrackSchema)
	.handler(async ({ input }) => {
		console.log("[TrackActions] addWorkoutToTrackAction", input)
		try {
			const trackWorkout = await addWorkoutToTrackServer({
				trackId: input.trackId,
				workoutId: input.workoutId,
				dayNumber: input.dayNumber,
				weekNumber: input.weekNumber,
				notes: input.notes,
			}) // Removed currentDb
			revalidatePath(`/dashboard/admin/tracks/${input.trackId}`)
			return trackWorkout
		} catch (error) {
			console.error("[TrackActions] Error in addWorkoutToTrackAction:", error)
			if (error instanceof ZSAError) throw error
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to add workout to track.",
			)
		}
	})

const getTrackWorkoutsSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
})

export const getTrackWorkoutsWithDetailsAction = createServerAction()
	.input(getTrackWorkoutsSchema)
	.handler(async ({ input }) => {
		console.log(
			`[TrackActions] getTrackWorkoutsWithDetailsAction for trackId: ${input.trackId}`, // Corrected console.log string
		)
		try {
			const workouts = await getTrackWorkoutsWithDetailsServer(input.trackId) // Removed currentDb
			return workouts
		} catch (error) {
			console.error(
				`[TrackActions] Error fetching workouts for track ${input.trackId}:`,
				error,
			)
			if (error instanceof ZSAError) throw error
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to fetch workouts for track.",
			)
		}
	})

const updateTrackWorkoutOrderSchema = z.object({
	trackId: z.string().min(1, "Track ID is required"),
	orderedWorkoutIds: z
		.array(z.string().min(1, "Workout ID in array cannot be empty"))
		.min(1, "Ordered workout IDs array cannot be empty"),
	// You might need to include weekNumber if it\'s part of the reordering logic
	// and how dayNumbers are recalculated.
})

export const updateTrackWorkoutOrderAction = createServerAction()
	.input(updateTrackWorkoutOrderSchema)
	.handler(async ({ input }) => {
		console.log(
			`[TrackActions] Updating workout order for track ${input.trackId}`,
			input.orderedWorkoutIds,
		)
		// const currentDb = getDB(); // Use getDB() if server function needs it
		await new Promise((resolve) => setTimeout(resolve, 500))
		revalidatePath(`/dashboard/admin/tracks/${input.trackId}`)
		return { success: true, message: "Workout order updated (placeholder)." }
	})

export const updateTrackWorkoutDayNumbersAction = createServerAction()
	.input(UpdateTrackWorkoutDayNumbersSchema)
	.handler(async ({ input }: { input: UpdateTrackWorkoutDayNumbersInput }) => {
		console.log(
			"[trackActions] updateTrackWorkoutDayNumbersAction called with input:",
			input,
		)
		try {
			const currentDb = getDB()

			if (!input.updates || input.updates.length === 0) {
				console.log("[trackActions] No updates to perform.")
				revalidatePath(`/tracks/${input.trackId}`)
				revalidatePath(`/tracks/${input.trackId}/manage`)
				return { success: true, message: "No updates provided." }
			}

			const updateStatements = input.updates.map((updateItem) =>
				currentDb
					.update(trackWorkoutsTable)
					.set({
						dayNumber: updateItem.dayNumber,
					})
					.where(eq(trackWorkoutsTable.id, updateItem.trackWorkoutId)),
			)

			console.log(
				`[trackActions] Preparing to execute ${updateStatements.length} batch updates.`,
			)

			// Ensure updateStatements is treated as a non-empty array tuple for db.batch()
			// The specific type for elements of updateStatements is inferred by TypeScript
			// from the .update().set().where() chain.
			// We cast to a generic non-empty array tuple structure that batch expects.
			await currentDb.batch(
				updateStatements as [
					(typeof updateStatements)[0],
					...(typeof updateStatements)[0][],
				],
			)

			revalidatePath(`/tracks/${input.trackId}`)
			revalidatePath(`/tracks/${input.trackId}/manage`)

			console.log(
				"[trackActions] Successfully updated day numbers for track:",
				input.trackId,
			)
			return { success: true }
		} catch (error) {
			console.error(
				"[trackActions] Error updating track workout day numbers:",
				error,
			)
			if (error instanceof ZSAError) throw error

			const message =
				error instanceof Error
					? error.message
					: "An unknown error occurred during batch update."
			throw new ZSAError("INTERNAL_SERVER_ERROR", message)
		}
	})
