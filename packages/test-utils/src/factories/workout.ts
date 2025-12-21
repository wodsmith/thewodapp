import { createId } from "@paralleldrive/cuid2"

export interface WorkoutFactory {
	id: string
	teamId: string
	name: string
	description: string | null
	type: "amrap" | "fortime" | "emom" | "strength" | "custom"
	createdById: string
	createdAt: Date
	updatedAt: Date
}

/**
 * Create a test workout with sensible defaults.
 *
 * @example
 * ```ts
 * const workout = createWorkout({ teamId: team.id })
 * const amrap = createWorkout({ type: "amrap", name: "20 Min AMRAP" })
 * ```
 */
export function createWorkout(
	overrides?: Partial<WorkoutFactory>,
): WorkoutFactory {
	const id = overrides?.id ?? createId()
	const now = new Date()
	return {
		id,
		teamId: createId(),
		name: `Test Workout ${id.slice(0, 4)}`,
		description: null,
		type: "amrap",
		createdById: createId(),
		createdAt: now,
		updatedAt: now,
		...overrides,
	}
}
