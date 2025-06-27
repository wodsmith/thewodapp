// Simple test script to verify the reorder functionality
import { reorderTrackWorkoutsSchema } from "./src/schemas/programming-track.schema.js"

// Test the schema validation
const testData = {
	teamId: "team_12345",
	trackId: "track_12345",
	updates: [
		{ trackWorkoutId: "tw_1", dayNumber: 1 },
		{ trackWorkoutId: "tw_2", dayNumber: 2 },
		{ trackWorkoutId: "tw_3", dayNumber: 3 },
	],
}

try {
	const result = reorderTrackWorkoutsSchema.parse(testData)
	console.log("✓ Schema validation passed:", result)
} catch (error) {
	console.error("✗ Schema validation failed:", error)
}

// Test invalid data
const invalidData = {
	teamId: "",
	trackId: "track_12345",
	updates: [{ trackWorkoutId: "", dayNumber: 0 }],
}

try {
	const result = reorderTrackWorkoutsSchema.parse(invalidData)
	console.log("✗ Should have failed validation:", result)
} catch (error) {
	console.log("✓ Correctly caught invalid data:", error.errors)
}
