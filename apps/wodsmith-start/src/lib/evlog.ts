/**
 * Evlog — Wide Event Logging for Cloudflare Workers
 *
 * Provides request-scoped "wide event" logging where context is accumulated
 * throughout a request lifecycle via `log.set()`, then emitted once at the end.
 *
 * This complements the existing PostHog OTLP logger — evlog produces a single
 * structured wide event per request while the PostHog logger handles individual
 * log entries throughout the request.
 *
 * @see https://www.evlog.dev/frameworks/cloudflare-workers
 *
 * @example
 * ```ts
 * import { getEvlog } from "@/lib/evlog"
 *
 * // In a server function:
 * const log = getEvlog()
 * if (log) {
 *   log.set({ user: { id: userId, plan: "pro" } })
 *   log.set({ action: "create_competition" })
 * }
 * ```
 */

import type { RequestLogger } from "evlog"
import { AsyncLocalStorage } from "node:async_hooks"

// Store the evlog request logger in AsyncLocalStorage so it's accessible
// anywhere in the request call chain (matching the existing request-context pattern)
const evlogStorage = new AsyncLocalStorage<RequestLogger>()

/**
 * Get the current request's evlog logger.
 * Returns undefined if called outside a request context.
 */
export function getEvlog(): RequestLogger | undefined {
	return evlogStorage.getStore()
}

/**
 * Run a function with an evlog request logger available via getEvlog().
 */
export function withEvlog<T>(logger: RequestLogger, fn: () => T): T {
	return evlogStorage.run(logger, fn)
}

/**
 * Set the authenticated user on the evlog wide event.
 * Call this after resolving the session so every wide event
 * includes who performed the action.
 *
 * Uses `loggedInUserId` to distinguish from entity-level userIds
 * (e.g., the athlete whose score is being entered).
 */
export function setEvlogUser(userId: string, teamId?: string): void {
	const log = evlogStorage.getStore()
	if (!log) return
	const fields: Record<string, unknown> = { loggedInUserId: userId }
	if (teamId) fields.activeTeamId = teamId
	log.set(fields)
}
