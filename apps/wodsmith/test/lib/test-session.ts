import type { KVSession } from "@/utils/kv-session"

/**
 * Default test user data
 */
const DEFAULT_USER = {
	id: "test-user-id",
	email: "test@example.com",
	firstName: "Test",
	lastName: "User",
	role: "user" as const,
	avatar: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	emailVerified: new Date(),
	currentCredits: 100,
	lastCreditRefreshAt: null,
}

/**
 * Default test team data
 */
const DEFAULT_TEAM = {
	id: "test-team-id",
	name: "Test Team",
	slug: "test-team",
	type: "gym" as const,
	isPersonalTeam: false,
	role: {
		id: "admin",
		name: "Admin",
		isSystemRole: true,
	},
	permissions: [
		"access_dashboard",
		"create_components",
		"edit_components",
		"delete_components",
		"manage_programming",
		"edit_team_settings",
	],
	plan: {
		id: "pro",
		name: "Pro",
		features: ["programming_tracks", "competitions"],
		limits: { max_members: 100 },
	},
}

export interface CreateTestSessionOptions {
	userId?: string
	user?: Partial<typeof DEFAULT_USER>
	teams?: Array<Partial<typeof DEFAULT_TEAM>>
	entitlements?: KVSession["entitlements"]
}

/**
 * Create a test session for mocking authentication.
 *
 * @example
 * ```ts
 * // Default session (admin with all permissions)
 * const session = createTestSession()
 *
 * // Custom user
 * const session = createTestSession({
 *   userId: 'custom-id',
 *   user: { email: 'custom@test.com' }
 * })
 *
 * // Member with limited permissions
 * const session = createTestSession({
 *   teams: [{
 *     id: 'team-1',
 *     role: { id: 'member', name: 'Member', isSystemRole: true },
 *     permissions: ['access_dashboard']
 *   }]
 * })
 * ```
 */
export function createTestSession(
	options: CreateTestSessionOptions = {},
): KVSession {
	const userId = options.userId ?? DEFAULT_USER.id

	const user = {
		...DEFAULT_USER,
		...options.user,
		id: userId,
	}

	const teams =
		options.teams?.map((t) => ({
			...DEFAULT_TEAM,
			...t,
			role: { ...DEFAULT_TEAM.role, ...t.role },
			plan: t.plan === undefined ? DEFAULT_TEAM.plan : t.plan,
		})) ?? [DEFAULT_TEAM]

	return {
		id: "test-session-id",
		userId,
		expiresAt: Date.now() + 86400000, // 24 hours from now
		createdAt: Date.now() - 3600000, // 1 hour ago
		user,
		teams,
		entitlements: options.entitlements ?? [],
		authenticationType: "password",
		version: 5,
	}
}

/**
 * Create a session with no team access (for testing unauthorized scenarios)
 */
export function createTestSessionNoTeams(): KVSession {
	return createTestSession({ teams: [] })
}

/**
 * Create a member session with limited permissions
 */
export function createTestSessionAsMember(teamId = "test-team-id"): KVSession {
	return createTestSession({
		teams: [
			{
				id: teamId,
				role: { id: "member", name: "Member", isSystemRole: true },
				permissions: ["access_dashboard"],
			},
		],
	})
}
