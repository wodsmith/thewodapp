/**
 * Request Context for Observability
 *
 * Provides a way to propagate request-scoped data (correlation IDs, user context, etc.)
 * through the request lifecycle. Uses AsyncLocalStorage to maintain context across
 * async operations.
 *
 * Usage:
 * 1. Call withRequestContext() at the start of a request handler
 * 2. Use getRequestContext() anywhere in the call chain to access context
 * 3. All logs will automatically include the request context
 *
 * @example
 * ```ts
 * // In request handler
 * return withRequestContext({ userId: session?.userId }, async () => {
 *   // All operations here have access to request context
 *   logInfo({ message: "Processing request" }) // Automatically includes requestId
 * })
 * ```
 */

import { AsyncLocalStorage } from "node:async_hooks"
import { init } from "@paralleldrive/cuid2"

// Short 12-character request IDs for readability
const createRequestId = init({ length: 12 })

/**
 * Request context data that flows through the request lifecycle
 */
export interface RequestContext {
	/** Unique identifier for this request (for tracing) */
	requestId: string
	/** Timestamp when the request started */
	startTime: number
	/** User ID if authenticated */
	userId?: string
	/** Active team ID if applicable */
	teamId?: string
	/** HTTP method (GET, POST, etc.) */
	method?: string
	/** Request path/URL */
	path?: string
	/** Server function name if applicable */
	serverFn?: string
	/** Additional custom attributes */
	attributes?: Record<string, unknown>
}

// AsyncLocalStorage instance for request-scoped context
const requestContextStorage = new AsyncLocalStorage<RequestContext>()

/**
 * Get the current request context.
 * Returns undefined if called outside of a request context.
 */
export function getRequestContext(): RequestContext | undefined {
	return requestContextStorage.getStore()
}

/**
 * Get a specific field from the request context.
 * Returns undefined if the context or field doesn't exist.
 */
export function getRequestContextField<K extends keyof RequestContext>(
	field: K,
): RequestContext[K] | undefined {
	return requestContextStorage.getStore()?.[field]
}

/**
 * Get the current request ID, or generate a new one if not in context.
 * Useful for logging when you may or may not be in a request context.
 */
export function getOrCreateRequestId(): string {
	return requestContextStorage.getStore()?.requestId ?? createRequestId()
}

/**
 * Update the current request context with additional data.
 * This is useful for adding user/team info after authentication.
 *
 * @example
 * ```ts
 * // After authenticating
 * updateRequestContext({ userId: session.userId, teamId: session.activeTeamId })
 * ```
 */
export function updateRequestContext(
	updates: Partial<Omit<RequestContext, "requestId" | "startTime">>,
): void {
	const store = requestContextStorage.getStore()
	if (store) {
		Object.assign(store, updates)
	}
}

/**
 * Add custom attributes to the current request context.
 * These will be included in all subsequent logs for this request.
 *
 * @example
 * ```ts
 * addRequestContextAttribute("competitionId", competition.id)
 * addRequestContextAttribute("registrationId", registration.id)
 * ```
 */
export function addRequestContextAttribute(key: string, value: unknown): void {
	const store = requestContextStorage.getStore()
	if (store) {
		store.attributes = store.attributes ?? {}
		store.attributes[key] = value
	}
}

/**
 * Execute a function within a request context.
 * Creates a new context with a unique request ID and propagates it through
 * all async operations within the callback.
 *
 * @param initialContext - Optional initial context values (userId, teamId, etc.)
 * @param fn - The function to execute within the context
 * @returns The result of the function
 *
 * @example
 * ```ts
 * // In a route handler
 * export async function handler(request: Request) {
 *   return withRequestContext(
 *     { method: request.method, path: request.url },
 *     async () => {
 *       // All operations here have access to request context
 *       return await processRequest()
 *     }
 *   )
 * }
 * ```
 */
export function withRequestContext<T>(
	initialContext: Partial<Omit<RequestContext, "requestId" | "startTime">>,
	fn: () => T,
): T {
	const context: RequestContext = {
		requestId: createRequestId(),
		startTime: Date.now(),
		...initialContext,
	}
	return requestContextStorage.run(context, fn)
}

/**
 * Get context attributes suitable for logging.
 * Includes requestId, userId, teamId, and any custom attributes.
 * Filters out undefined values.
 */
export function getContextAttributesForLogging(): Record<string, unknown> {
	const context = requestContextStorage.getStore()
	if (!context) {
		return {}
	}

	const attrs: Record<string, unknown> = {
		requestId: context.requestId,
	}

	// Add optional fields only if they have values
	if (context.userId) attrs.userId = context.userId
	if (context.teamId) attrs.teamId = context.teamId
	if (context.method) attrs.method = context.method
	if (context.path) attrs.path = context.path
	if (context.serverFn) attrs.serverFn = context.serverFn

	// Merge any custom attributes
	if (context.attributes) {
		Object.assign(attrs, context.attributes)
	}

	return attrs
}

/**
 * Calculate the duration since the request started.
 * Returns undefined if not in a request context.
 */
export function getRequestDuration(): number | undefined {
	const startTime = requestContextStorage.getStore()?.startTime
	return startTime ? Date.now() - startTime : undefined
}

/**
 * Create a child context for sub-operations (like database queries or external API calls).
 * Maintains the parent requestId but can track operation-specific timing.
 *
 * @example
 * ```ts
 * const { span, endSpan } = createOperationSpan("db.query.users")
 * try {
 *   const users = await db.query.users.findMany()
 *   endSpan({ rowCount: users.length })
 * } catch (err) {
 *   endSpan({ error: true })
 *   throw err
 * }
 * ```
 */
export function createOperationSpan(operationName: string): {
	startTime: number
	endSpan: (attributes?: Record<string, unknown>) => {
		durationMs: number
		attributes: Record<string, unknown>
	}
} {
	const startTime = Date.now()
	const context = getRequestContext()

	return {
		startTime,
		endSpan: (attributes?: Record<string, unknown>) => {
			const durationMs = Date.now() - startTime
			return {
				durationMs,
				attributes: {
					requestId: context?.requestId,
					operation: operationName,
					durationMs,
					...attributes,
				},
			}
		},
	}
}

/**
 * Extract request info from a Request object for context initialization.
 */
export function extractRequestInfo(request: Request): {
	method: string
	path: string
	userAgent?: string
} {
	const url = new URL(request.url)
	return {
		method: request.method,
		path: url.pathname,
		userAgent: request.headers.get("user-agent") ?? undefined,
	}
}
