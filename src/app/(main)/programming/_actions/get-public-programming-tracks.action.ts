"use server"

import "server-only"

import { z } from "zod"
import { createServerAction, ZSAError } from "zsa"
import { getPublicProgrammingTracks } from "@/server/programming-tracks"

export const getPublicProgrammingTracksAction = createServerAction()
	.input(z.void())
	.handler(async () => {
		try {
			const tracks = await getPublicProgrammingTracks()
			console.log(
				`ACTION: getPublicProgrammingTracks returned ${tracks.length} tracks`,
			)
			return tracks
		} catch (error) {
			console.error("Failed to fetch public programming tracks", error)
			throw new ZSAError(
				"INTERNAL_SERVER_ERROR",
				"Failed to fetch public programming tracks",
			)
		}
	})
