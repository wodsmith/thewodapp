import { describe, expect, it } from "vitest"

import {
	programmingTracksTable,
	scheduledWorkoutInstancesTable,
	teamProgrammingTracksTable,
	trackWorkoutsTable,
} from "@/db/schema"

// Basic existence checks for newly added tables.

describe("schema integrity – programming tracks & scheduling", () => {
	it("should export new scheduling-related tables", () => {
		expect(programmingTracksTable).toBeDefined()
		expect(teamProgrammingTracksTable).toBeDefined()
		expect(trackWorkoutsTable).toBeDefined()
		expect(scheduledWorkoutInstancesTable).toBeDefined()
	})
})
