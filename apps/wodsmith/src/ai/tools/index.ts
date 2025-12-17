import type { InferUITools } from "ai"
import { getMovements } from "./get-movements"
import { getTags } from "./get-tags"
import { getWorkouts } from "./get-workouts"

interface Params {
	teamId: string
}

export function tools({ teamId }: Params) {
	return {
		getWorkouts: getWorkouts(teamId),
		getTags: getTags(teamId),
		getMovements: getMovements(teamId),
	}
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>
