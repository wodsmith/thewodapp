import { createWorkoutAction } from "@/actions/workout-actions"
import { getDd } from "@/db"
import { teamTable } from "@/db/schema"
import { beforeAll, expect, test } from "vitest"

beforeAll(async () => {
	const db = getDd()
	await db
		.insert(teamTable)
		.values({
			id: "test_team_id",
			name: "Test Team",
			slug: "test-team",
		})
		.onConflictDoNothing()
})

test("should create a workout with a teamId", async () => {
	const workout = {
		name: "Test Workout",
		description: "Test Description",
		scope: "private",
		scheme: "reps",
		repsPerRound: 10,
		roundsToScore: 5,
		sugarId: null,
		tiebreakScheme: null,
		secondaryScheme: null,
	}

	const [data, err] = await createWorkoutAction({
		workout,
		tagIds: [],
		movementIds: [],
		teamId: "test_team_id",
	})

	expect(err).toBeNull()
	expect(data).toBeDefined()
	expect(data.teamId).toBe("test_team_id")
})
