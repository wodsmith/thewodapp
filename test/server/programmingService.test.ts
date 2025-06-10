import { describe, expect, it } from "vitest"

import {
	addWorkoutToTrack,
	assignTrackToTeam,
	createProgrammingTrack,
	getProgrammingTrackById,
	getTeamTracks,
	getWorkoutsForTrack,
	updateTeamDefaultTrack,
} from "@/server/programming-tracks"

describe("programming track service – API surface", () => {
	it("should export all expected functions", () => {
		expect(createProgrammingTrack).toBeTypeOf("function")
		expect(getProgrammingTrackById).toBeTypeOf("function")
		expect(addWorkoutToTrack).toBeTypeOf("function")
		expect(getWorkoutsForTrack).toBeTypeOf("function")
		expect(assignTrackToTeam).toBeTypeOf("function")
		expect(getTeamTracks).toBeTypeOf("function")
		expect(updateTeamDefaultTrack).toBeTypeOf("function")
	})
})
