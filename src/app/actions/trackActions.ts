"use server"
import "server-only"
import { revalidatePath } from "next/cache"

export async function createTrackAction(formData: FormData) {
	const name = formData.get("name")
	console.log("[TrackActions] createTrackAction", { name })
	// TODO: call database service
	revalidatePath("/dashboard/admin/tracks")
}

export async function addWorkoutToTrackAction(formData: FormData) {
	const trackId = formData.get("trackId")
	const workoutId = formData.get("workoutId")
	console.log("[TrackActions] addWorkoutToTrackAction", { trackId, workoutId })
	// TODO: db call
	if (typeof trackId === "string") {
		revalidatePath(`/dashboard/admin/tracks/${trackId}`)
	}
}
