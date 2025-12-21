import { createId } from "@paralleldrive/cuid2"

export interface UserFactory {
	id: string
	email: string
	emailVerified: boolean
	name: string
	avatarUrl: string | null
	createdAt: Date
	updatedAt: Date
}

/**
 * Create a test user with sensible defaults.
 * All properties can be overridden.
 *
 * @example
 * ```ts
 * const user = createUser()
 * const admin = createUser({ name: "Admin User" })
 * ```
 */
export function createUser(overrides?: Partial<UserFactory>): UserFactory {
	const id = overrides?.id ?? createId()
	const now = new Date()
	return {
		id,
		email: `user-${id.slice(0, 8)}@example.com`,
		emailVerified: true,
		name: `Test User ${id.slice(0, 4)}`,
		avatarUrl: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	}
}
