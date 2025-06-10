"use server"
import "server-only"
import { revalidatePath } from "next/cache"

export async function scheduleWorkoutAction(formData: FormData) {
	console.log(
		"[SchedulingActions] scheduleWorkoutAction",
		Object.fromEntries(formData),
	)
	// TODO call db
	const teamId = formData.get("teamId")
	if (typeof teamId === "string") {
		revalidatePath(`/dashboard/teams/${teamId}/schedule`)
	}
}

export async function updateScheduledWorkoutAction(
	instanceId: string,
	formData: FormData,
) {
	console.log("[SchedulingActions] updateScheduledWorkoutAction", {
		instanceId,
	})
}

export async function deleteScheduledWorkoutAction(instanceId: string) {
	console.log("[SchedulingActions] deleteScheduledWorkoutAction", {
		instanceId,
	})
}
