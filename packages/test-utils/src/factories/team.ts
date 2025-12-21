import { createId } from "@paralleldrive/cuid2"

export interface TeamFactory {
	id: string
	name: string
	slug: string
	ownerId: string
	createdAt: Date
	updatedAt: Date
}

/**
 * Create a test team with sensible defaults.
 *
 * @example
 * ```ts
 * const team = createTeam()
 * const gym = createTeam({ name: "CrossFit Gym", slug: "crossfit-gym" })
 * ```
 */
export function createTeam(overrides?: Partial<TeamFactory>): TeamFactory {
	const id = overrides?.id ?? createId()
	const now = new Date()
	return {
		id,
		name: `Test Team ${id.slice(0, 4)}`,
		slug: `test-team-${id.slice(0, 8)}`,
		ownerId: createId(),
		createdAt: now,
		updatedAt: now,
		...overrides,
	}
}
