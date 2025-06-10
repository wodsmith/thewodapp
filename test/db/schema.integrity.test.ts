import { describe, expect, it } from "vitest"

import {
	programmingTracksTable,
	teamProgrammingTracksTable,
	trackWorkoutsTable,
} from "@/db/schema"

// Basic compile-time/run-time existence checks for newly added tables.

describe("schema integrity – programming tracks", () => {
	it("should export programming tracks tables", () => {
		expect(programmingTracksTable).toBeDefined()
		expect(teamProgrammingTracksTable).toBeDefined()
		expect(trackWorkoutsTable).toBeDefined()
	})
})
