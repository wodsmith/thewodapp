import { createId } from "@paralleldrive/cuid2"

/**
 * Matches the SessionWithMeta type from @/utils/auth
 * This is the structure Lucia returns for authenticated sessions.
 */
export interface SessionWithMeta {
	id: string
	userId: string
	expiresAt: number
	fresh: boolean
	user: {
		id: string
		email: string
		emailVerified: boolean
		name: string
		avatarUrl: string | null
		createdAt: Date
		updatedAt: Date
	}
	teams: Array<{
		teamId: string
		teamName: string
		teamSlug: string
		roleId: string
		isOwner: boolean
	}>
	activeTeamId: string
}

export interface SessionFactoryOptions {
	userId?: string
	teamId?: string
	roles?: string[]
	expiresInMs?: number
}

/**
 * Create a test session matching Lucia's SessionWithMeta structure.
 *
 * @example
 * ```ts
 * const session = createTestSession()
 * const adminSession = createTestSession({ roles: ["admin"] })
 * const expiredSession = createTestSession({ expiresInMs: -1000 })
 * ```
 */
export function createTestSession(
	overrides?: Partial<SessionWithMeta> & SessionFactoryOptions,
): SessionWithMeta {
	const userId = overrides?.userId ?? createId()
	const teamId = overrides?.teamId ?? createId()
	const expiresAt = Date.now() + (overrides?.expiresInMs ?? 86400000) // 24h default
	const now = new Date()

	return {
		id: createId(),
		userId,
		expiresAt,
		fresh: true,
		user: {
			id: userId,
			email: `test-${userId.slice(0, 4)}@example.com`,
			emailVerified: true,
			name: `Test User ${userId.slice(0, 4)}`,
			avatarUrl: null,
			createdAt: now,
			updatedAt: now,
			...overrides?.user,
		},
		teams: overrides?.teams ?? [
			{
				teamId,
				teamName: `Test Team ${teamId.slice(0, 4)}`,
				teamSlug: `test-team-${teamId.slice(0, 8)}`,
				roleId: overrides?.roles?.[0] ?? "member",
				isOwner: false,
			},
		],
		activeTeamId: teamId,
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
