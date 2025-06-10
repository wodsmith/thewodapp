"use server"
import "server-only"
import { revalidatePath } from "next/cache"

export async function assignTrackToTeamAction(
	teamId: string,
	trackId: string,
	isActive: boolean,
) {
	console.log("[TeamProgrammingActions] assignTrackToTeamAction", {
		teamId,
		trackId,
		isActive,
	})
	revalidatePath(`/dashboard/teams/${teamId}/settings/programming`)
}

export async function updateTeamDefaultTrackAction(
	teamId: string,
	trackId: string | null,
) {
	console.log("[TeamProgrammingActions] updateTeamDefaultTrackAction", {
		teamId,
		trackId,
	})
	revalidatePath(`/dashboard/teams/${teamId}/settings/programming`)
}

export async function setTeamTrackActivityAction(
	teamId: string,
	trackId: string,
	isActive: boolean,
) {
	console.log("[TeamProgrammingActions] setTeamTrackActivityAction", {
		teamId,
		trackId,
		isActive,
	})
	revalidatePath(`/dashboard/teams/${teamId}/settings/programming`)
}
