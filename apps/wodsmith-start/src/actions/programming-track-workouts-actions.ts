"use server"

import { getPaginatedTrackWorkoutsFn } from "~/server-functions/programming"

export async function getPaginatedTrackWorkoutsAction({
	trackId,
	teamId,
	page = 1,
	pageSize = 10,
}: {
	trackId: string
	teamId: string
	page?: number
	pageSize?: number
}) {
	return await getPaginatedTrackWorkoutsFn({
		data: { trackId, teamId, page, pageSize },
	})
}
