import { createId } from "@paralleldrive/cuid2"

/**
 * Volunteer metadata structure for team memberships with volunteer role
 */
export interface VolunteerMetadata {
	volunteerRoleTypes?: string[]
	availability?: string[]
	credentials?: string[]
	availabilityNotes?: string
}

export interface TeamMembershipFactory {
	id: string
	teamId: string
	userId: string
	roleId: string
	isSystemRole: number
	invitedBy: string | null
	invitedAt: Date | null
	joinedAt: Date | null
	expiresAt: Date | null
	isActive: number
	metadata: string | null
	createdAt: Date
	updatedAt: Date
}

/**
 * Create a test team membership with sensible defaults.
 * All properties can be overridden.
 *
 * @example
 * ```ts
 * const membership = createTeamMembership({ teamId: "team_123", userId: "usr_456" })
 * const volunteerMembership = createTeamMembership({
 *   roleId: "volunteer",
 *   metadata: JSON.stringify({
 *     volunteerRoleTypes: ["judge", "scoreboard"],
 *     availability: ["saturday", "sunday"],
 *     credentials: ["crossfit-l1"]
 *   })
 * })
 * ```
 */
export function createTeamMembership(
	overrides?: Partial<TeamMembershipFactory>,
): TeamMembershipFactory {
	const id = overrides?.id ?? `tmem_${createId()}`
	const now = new Date()
	return {
		id,
		teamId: createId(),
		userId: createId(),
		roleId: "member",
		isSystemRole: 1,
		invitedBy: null,
		invitedAt: null,
		joinedAt: now,
		expiresAt: null,
		isActive: 1,
		metadata: null,
		createdAt: now,
		updatedAt: now,
		...overrides,
	}
}

/**
 * Helper to create team membership with volunteer metadata
 */
export function createVolunteerMembership(
	volunteerMetadata: VolunteerMetadata,
	overrides?: Partial<TeamMembershipFactory>,
): TeamMembershipFactory {
	return createTeamMembership({
		roleId: "volunteer",
		metadata: JSON.stringify(volunteerMetadata),
		...overrides,
	})
}
