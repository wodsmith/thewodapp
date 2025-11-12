import type { InferUITools } from "ai";
import { getWorkouts } from "./get-workouts";
import { getTags } from "./get-tags";
import { getMovements } from "./get-movements";

interface Params {
	teamId: string;
}

export function tools({ teamId }: Params) {
	return {
		getWorkouts: getWorkouts(teamId),
		getTags: getTags(teamId),
		getMovements: getMovements(teamId),
	};
}

export type ToolSet = InferUITools<ReturnType<typeof tools>>;
