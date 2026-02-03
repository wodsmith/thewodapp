/**
 * Server Function Logging Wrapper
 *
 * Provides utilities to wrap server functions with automatic observability logging.
 * Logs function entry, exit (with timing), and errors.
 *
 * @example
 * ```ts
 * // Option 1: Use the wrapper helper
 * export const myServerFn = createServerFn({ method: "POST" })
 *   .inputValidator(...)
 *   .handler(withServerFnLogging("myServerFn", async ({ data }) => {
 *     // Your handler code
 *   }))
 *
 * // Option 2: Manual logging in handler
 * export const myServerFn = createServerFn({ method: "POST" })
 *   .handler(async ({ data }) => {
 *     logServerFnStart("myServerFn", data)
 *     try {
 *       const result = await doWork()
 *       logServerFnSuccess("myServerFn", { resultId: result.id })
 *       return result
 *     } catch (error) {
 *       logServerFnError("myServerFn", error)
 *       throw error
 *     }
 *   })
 * ```
 */

import {
	addRequestContextAttribute,
	logEntityCreated,
	logEntityDeleted,
	logEntityUpdated,
	logError,
	logInfo,
	logServerFnError,
	logServerFnStart,
	logServerFnSuccess,
	updateRequestContext,
} from "./posthog-otel-logger"

/**
 * Wrap a server function handler with automatic logging.
 * Logs entry, successful completion (with timing), and errors.
 *
 * @param fnName - Name of the server function (for log messages)
 * @param handler - The original handler function
 * @param options - Optional configuration
 * @returns Wrapped handler with logging
 *
 * @example
 * ```ts
 * export const getUserFn = createServerFn({ method: "GET" })
 *   .inputValidator((data) => z.object({ userId: z.string() }).parse(data))
 *   .handler(withServerFnLogging("getUserFn", async ({ data }) => {
 *     const user = await db.query.users.findFirst({ where: eq(users.id, data.userId) })
 *     return { user }
 *   }))
 * ```
 */
export function withServerFnLogging<TInput, TResult>(
	fnName: string,
	handler: (ctx: { data: TInput }) => Promise<TResult>,
	options?: {
		/** Extract IDs from result to log (e.g., ["userId", "teamId"]) */
		resultIds?: string[]
		/** Log input data (default: true, sanitized) */
		logInput?: boolean
		/** Custom attributes to include */
		attributes?: Record<string, unknown>
	},
): (ctx: { data: TInput }) => Promise<TResult> {
	const { resultIds = [], logInput = true, attributes = {} } = options ?? {}

	return async (ctx: { data: TInput }): Promise<TResult> => {
		// Log entry
		if (logInput && ctx.data && typeof ctx.data === "object") {
			logServerFnStart(fnName, ctx.data as Record<string, unknown>)
		} else {
			logServerFnStart(fnName)
		}

		// Add function name to request context
		updateRequestContext({ serverFn: fnName })

		try {
			const result = await handler(ctx)

			// Extract IDs from result if specified
			const resultAttrs: Record<string, unknown> = { ...attributes }
			if (result && typeof result === "object") {
				for (const idKey of resultIds) {
					const value = (result as Record<string, unknown>)[idKey]
					if (value !== undefined) {
						resultAttrs[idKey] = value
						// Also add to request context for downstream logs
						addRequestContextAttribute(idKey, value)
					}
				}
			}

			logServerFnSuccess(fnName, resultAttrs)
			return result
		} catch (error) {
			logServerFnError(fnName, error, attributes)
			throw error
		}
	}
}

/**
 * Context-aware handler type that includes request context setup.
 * Use this for handlers that need full request tracing.
 */
export type LoggedHandler<TInput, TResult> = (ctx: {
	data: TInput
}) => Promise<TResult>

/**
 * Create a logged server function handler with request context.
 * This is a convenience wrapper that combines withRequestContext and logging.
 *
 * @param fnName - Name of the server function
 * @param handler - The handler implementation
 * @param options - Logging options
 */
export function createLoggedHandler<TInput, TResult>(
	fnName: string,
	handler: (ctx: { data: TInput }) => Promise<TResult>,
	options?: {
		resultIds?: string[]
		logInput?: boolean
		attributes?: Record<string, unknown>
	},
): LoggedHandler<TInput, TResult> {
	return withServerFnLogging(fnName, handler, options)
}

/**
 * Helper to log created entities within a server function.
 * Adds the entity ID to request context for correlation.
 */
export function logCreated(
	entity: string,
	id: string,
	options?: {
		parentEntity?: string
		parentId?: string
		attributes?: Record<string, unknown>
	},
): void {
	addRequestContextAttribute(`created_${entity}_id`, id)
	logEntityCreated({
		entity,
		id,
		parentEntity: options?.parentEntity,
		parentId: options?.parentId,
		attributes: options?.attributes,
	})
}

/**
 * Helper to log updated entities within a server function.
 * Adds the entity ID to request context for correlation.
 */
export function logUpdated(
	entity: string,
	id: string,
	options?: {
		fields?: string[]
		attributes?: Record<string, unknown>
	},
): void {
	addRequestContextAttribute(`updated_${entity}_id`, id)
	logEntityUpdated({
		entity,
		id,
		fields: options?.fields,
		attributes: options?.attributes,
	})
}

/**
 * Helper to log deleted entities within a server function.
 * Adds the entity ID to request context for correlation.
 */
export function logDeleted(
	entity: string,
	id: string,
	attributes?: Record<string, unknown>,
): void {
	addRequestContextAttribute(`deleted_${entity}_id`, id)
	logEntityDeleted({ entity, id, attributes })
}

/**
 * Helper to log multiple created entities (e.g., batch inserts).
 */
export function logBatchCreated(
	entity: string,
	ids: string[],
	options?: {
		parentEntity?: string
		parentId?: string
	},
): void {
	if (ids.length === 0) return

	addRequestContextAttribute(`created_${entity}_ids`, ids)
	logInfo({
		message: `[Entity] Created ${ids.length} ${entity}(s)`,
		attributes: {
			entity,
			count: ids.length,
			entityIds: ids,
			...(options?.parentEntity ? { parentEntity: options.parentEntity } : {}),
			...(options?.parentId ? { parentId: options.parentId } : {}),
		},
	})
}

/**
 * Helper to log authorization checks.
 */
export function logAuthCheck(params: {
	action: string
	resource: string
	resourceId?: string
	allowed: boolean
	reason?: string
}): void {
	const logFn = params.allowed ? logInfo : logError
	logFn({
		message: `[Auth] ${params.allowed ? "Allowed" : "Denied"}: ${params.action} on ${params.resource}`,
		attributes: {
			authAction: params.action,
			authResource: params.resource,
			...(params.resourceId ? { resourceId: params.resourceId } : {}),
			allowed: params.allowed,
			...(params.reason ? { reason: params.reason } : {}),
		},
	})
}

/**
 * Helper to log external API calls (Stripe, email services, etc.).
 */
export function logExternalCall(params: {
	service: string
	operation: string
	durationMs?: number
	success: boolean
	error?: unknown
	attributes?: Record<string, unknown>
}): void {
	const logFn = params.success ? logInfo : logError
	logFn({
		message: `[External] ${params.service}.${params.operation} ${params.success ? "succeeded" : "failed"}`,
		error: params.success ? undefined : params.error,
		attributes: {
			externalService: params.service,
			externalOperation: params.operation,
			success: params.success,
			...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
			...(params.attributes ?? {}),
		},
	})
}
