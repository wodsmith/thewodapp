import { createId } from "@paralleldrive/cuid2"

/**
 * User object within a KVSession.
 * Matches the KVSessionUser type from apps/wodsmith/src/utils/kv-session.ts
 */
export interface KVSessionUser {
	id: string
	email: string
	firstName: string | null
	lastName: string | null
	role: "user" | "admin"
	emailVerified: Date | null
	avatar: string | null
	createdAt: Date
	updatedAt: Date
	currentCredits: number
	lastCreditRefreshAt: Date | null
	initials?: string
}

/**
 * Team object within a KVSession.
 * Matches the teams array structure in KVSession.
 */
export interface KVSessionTeam {
	id: string
	name: string
	slug: string
	type?: string
	isPersonalTeam: boolean
	role: {
		id: string
		name: string
		isSystemRole: boolean
	}
	permissions: string[]
	plan?: {
		id: string
		name: string
		features: string[]
		limits: Record<string, number>
	}
}

/**
 * Matches the KVSession type from apps/wodsmith/src/utils/kv-session.ts
 * This is the actual session structure used in the wodsmith app.
 */
export interface KVSession {
	id: string
	userId: string
	expiresAt: number
	createdAt: number
	user: KVSessionUser
	country?: string
	city?: string
	continent?: string
	ip?: string | null
	userAgent?: string | null
	authenticationType?: "passkey" | "password" | "google-oauth"
	passkeyCredentialId?: string
	teams?: KVSessionTeam[]
	entitlements?: {
		id: string
		type: string
		metadata: Record<string, unknown>
		expiresAt: Date | null
	}[]
	version?: number
}

/**
 * SessionWithMeta extends KVSession with isCurrentSession flag.
 * Matches the type from apps/wodsmith/src/types.ts
 */
export interface SessionWithMeta extends KVSession {
	isCurrentSession?: boolean
}

export interface SessionFactoryOptions {
	userId?: string
	teamId?: string
	teamSlug?: string
	role?: "user" | "admin"
	teamRole?: string
	permissions?: string[]
	expiresInMs?: number
	isPersonalTeam?: boolean
}

/**
 * Create a test session matching the KVSession/SessionWithMeta structure.
 *
 * @example
 * ```ts
 * const session = createTestSession()
 * const adminSession = createTestSession({ role: "admin", teamRole: "owner" })
 * const expiredSession = createTestSession({ expiresInMs: -1000 })
 * const withPermissions = createTestSession({ permissions: ["edit_components", "create_components"] })
 * ```
 */
export function createTestSession(
	overrides?: Partial<SessionWithMeta> & SessionFactoryOptions,
): SessionWithMeta {
	const userId = overrides?.userId ?? createId()
	const teamId = overrides?.teamId ?? createId()
	const teamSlug = overrides?.teamSlug ?? `test-team-${teamId.slice(0, 8)}`
	const now = new Date()
	const createdAt = Date.now()
	const expiresAt = createdAt + (overrides?.expiresInMs ?? 86400000) // 24h default

	const defaultPermissions = [
		"access_dashboard",
		"create_components",
		"edit_components",
	]

	return {
		id: createId(),
		userId,
		expiresAt,
		createdAt,
		isCurrentSession: true,
		user: {
			id: userId,
			email: `test-${userId.slice(0, 4)}@example.com`,
			firstName: "Test",
			lastName: `User ${userId.slice(0, 4)}`,
			role: overrides?.role ?? "user",
			emailVerified: now,
			avatar: null,
			createdAt: now,
			updatedAt: now,
			currentCredits: 100,
			lastCreditRefreshAt: null,
			...overrides?.user,
		},
		teams: overrides?.teams ?? [
			{
				id: teamId,
				name: `Test Team ${teamId.slice(0, 4)}`,
				slug: teamSlug,
				type: "gym",
				isPersonalTeam: overrides?.isPersonalTeam ?? false,
				role: {
					id: overrides?.teamRole ?? "member",
					name: overrides?.teamRole === "owner" ? "Owner" : "Member",
					isSystemRole: true,
				},
				permissions: overrides?.permissions ?? defaultPermissions,
			},
		],
		version: 5,
		...overrides,
	}
}

/**
 * In-memory session store for testing KV-based sessions.
 *
 * @example
 * ```ts
 * const store = new FakeSessionStore()
 * await store.set(session)
 * const retrieved = await store.get(session.id)
 * ```
 */
export class FakeSessionStore {
	private sessions = new Map<string, SessionWithMeta>()

	async get(sessionId: string): Promise<SessionWithMeta | null> {
		return this.sessions.get(sessionId) ?? null
	}

	async set(session: SessionWithMeta): Promise<void> {
		this.sessions.set(session.id, session)
	}

	async delete(sessionId: string): Promise<void> {
		this.sessions.delete(sessionId)
	}

	reset(): void {
		this.sessions.clear()
	}
}
