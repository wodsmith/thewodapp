"use server"

import {
	subscribeToTrackFn,
	unsubscribeFromTrackFn,
	setDefaultTrackFn,
} from "~/server-functions/programming"

export async function subscribeToTrackAction({
	teamId,
	trackId,
}: {
	teamId: string
	trackId: string
}) {
	return await subscribeToTrackFn({
		data: { teamId, trackId },
	})
}

export async function unsubscribeFromTrackAction({
	teamId,
	trackId,
}: {
	teamId: string
	trackId: string
}) {
	return await unsubscribeFromTrackFn({
		data: { teamId, trackId },
	})
}

export async function setDefaultTrackAction({
	teamId,
	trackId,
}: {
	teamId: string
	trackId: string
}) {
	return await setDefaultTrackFn({
		data: { teamId, trackId },
	})
}
