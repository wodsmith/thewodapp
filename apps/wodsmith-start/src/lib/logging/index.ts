/**
 * Observability Logging Module
 *
 * This module provides comprehensive logging utilities for request tracing
 * and observability throughout the application.
 *
 * Key Features:
 * - Request correlation IDs for tracing requests across logs
 * - Automatic context propagation (userId, teamId, etc.)
 * - Server function logging wrappers
 * - Entity lifecycle logging (created, updated, deleted)
 * - External service call logging
 *
 * Usage:
 * ```ts
 * import {
 *   logInfo,
 *   logError,
 *   withRequestContext,
 *   logCreated,
 *   withServerFnLogging,
 * } from "@/lib/logging"
 *
 * // In request handler - establish context
 * return withRequestContext({ userId: session?.userId }, async () => {
 *   logInfo({ message: "Processing request" })
 *   // ...
 * })
 *
 * // In server function - wrap with automatic logging
 * export const myFn = createServerFn()
 *   .handler(withServerFnLogging("myFn", async ({ data }) => {
 *     const result = await db.insert(table).values(data).returning()
 *     logCreated("entity", result[0].id)
 *     return result[0]
 *   }))
 * ```
 */

// Core logging functions
export {
	flushLogs,
	logDebug,
	logDbOperation,
	logEntityCreated,
	logEntityDeleted,
	logEntityUpdated,
	logError,
	logInfo,
	logRequest,
	logResponse,
	logServerFnError,
	logServerFnStart,
	logServerFnSuccess,
	logWarning,
} from "./posthog-otel-logger"

// Request context utilities
export {
	addRequestContextAttribute,
	createOperationSpan,
	extractRequestInfo,
	getOrCreateRequestId,
	getRequestContext,
	getRequestContextField,
	getRequestDuration,
	type RequestContext,
	updateRequestContext,
	withRequestContext,
} from "./request-context"

// Server function logging helpers
export {
	createLoggedHandler,
	logAuthCheck,
	logBatchCreated,
	logCreated,
	logDeleted,
	logExternalCall,
	type LoggedHandler,
	logUpdated,
	withServerFnLogging,
} from "./server-fn-wrapper"
