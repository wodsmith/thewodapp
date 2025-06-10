import { describe, expect, it } from "vitest"

import {
	deleteScheduledWorkoutInstance,
	getScheduledWorkoutInstanceById,
	getScheduledWorkoutsForTeam,
	scheduleWorkoutForTeam,
	updateScheduledWorkoutInstance,
} from "@/server/scheduling-service"

describe("scheduling service – API surface", () => {
	it("should export all expected functions", () => {
		expect(scheduleWorkoutForTeam).toBeTypeOf("function")
		expect(getScheduledWorkoutsForTeam).toBeTypeOf("function")
		expect(getScheduledWorkoutInstanceById).toBeTypeOf("function")
		expect(updateScheduledWorkoutInstance).toBeTypeOf("function")
		expect(deleteScheduledWorkoutInstance).toBeTypeOf("function")
	})
})
