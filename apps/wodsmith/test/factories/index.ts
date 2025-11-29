import { createId } from "@paralleldrive/cuid2"

/**
 * ID generators matching the codebase patterns
 */
const createUserId = () => `usr_${createId()}`
const createTeamId = () => `team_${createId()}`
const createWorkoutId = () => `workout_${createId()}`
const createCompetitionId = () => `comp_${createId()}`
const createTeamMembershipId = () => `tmem_${createId()}`
const createDivisionId = () => `div_${createId()}`
const createRegistrationId = () => `creg_${createId()}`

/**
 * Factory functions for creating test entities.
 *
 * These create plain objects matching the database schema shapes.
 * Use with db.insert() to seed test data.
 */
export const factories = {
	/**
	 * Create a user entity
	 */
	user: (overrides: Record<string, unknown> = {}) => ({
		id: createUserId(),
		email: `user-${createId().slice(0, 8)}@test.com`,
		firstName: "Test",
		lastName: "User",
		role: "user" as const,
		emailVerified: new Date(),
		passwordHash: null,
		currentCredits: 100,
		lastCreditRefreshAt: null,
		avatar: null,
		signUpIpAddress: null,
		googleAccountId: null,
		gender: null,
		dateOfBirth: null,
		bio: null,
		city: null,
		state: null,
		country: null,
		affiliationId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a team entity
	 */
	team: (overrides: Record<string, unknown> = {}) => ({
		id: createTeamId(),
		name: "Test Team",
		slug: `test-team-${createId().slice(0, 8)}`,
		type: "gym" as const,
		isPersonalTeam: false,
		parentTeamId: null,
		logo: null,
		currentPlanId: null,
		planSubscriptionId: null,
		planEntitlementVersion: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a workout entity
	 */
	workout: (teamId: string, overrides: Record<string, unknown> = {}) => ({
		id: createWorkoutId(),
		name: "Test Workout",
		description: "21-15-9 Thrusters and Pull-ups",
		scheme: "time" as const,
		scope: "private" as const,
		teamId,
		userId: null,
		sugarId: null,
		tiebreakScheme: null,
		secondaryScheme: null,
		repsPerRound: null,
		roundsToScore: null,
		scalingGroupId: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a competition entity
	 */
	competition: (
		organizingTeamId: string,
		overrides: Record<string, unknown> = {},
	) => ({
		id: createCompetitionId(),
		organizingTeamId,
		competitionTeamId: overrides.competitionTeamId ?? organizingTeamId,
		competitionGroupId: null,
		name: "Test Competition",
		slug: `test-comp-${createId().slice(0, 8)}`,
		description: "A test competition",
		location: "Test Location",
		startDate: new Date(Date.now() + 86400000 * 30), // 30 days from now
		endDate: new Date(Date.now() + 86400000 * 31), // 31 days from now
		registrationOpensAt: new Date(Date.now() - 86400000), // Yesterday
		registrationClosesAt: new Date(Date.now() + 86400000 * 29), // 29 days from now
		settings: {},
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a team membership entity
	 */
	teamMembership: (
		teamId: string,
		userId: string,
		overrides: Record<string, unknown> = {},
	) => ({
		id: createTeamMembershipId(),
		teamId,
		userId,
		roleId: "admin",
		isSystemRole: true,
		isActive: true,
		joinedAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a competition division entity
	 */
	competitionDivision: (
		competitionId: string,
		overrides: Record<string, unknown> = {},
	) => ({
		id: createDivisionId(),
		competitionId,
		name: "RX",
		description: "As prescribed",
		scalingGroupId: null,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),

	/**
	 * Create a competition registration entity
	 */
	competitionRegistration: (
		competitionId: string,
		userId: string,
		divisionId: string,
		overrides: Record<string, unknown> = {},
	) => ({
		id: createRegistrationId(),
		competitionId,
		userId,
		divisionId,
		registeredTeamId: null,
		teamName: null,
		registrationType: "individual" as const,
		affiliateId: null,
		status: "registered" as const,
		paymentStatus: "pending" as const,
		paymentIntentId: null,
		amountPaid: null,
		registeredAt: new Date(),
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),
}
