/**
 * PostHog OpenTelemetry Logger for TanStack Start
 *
 * This module provides structured logging that sends logs to PostHog using
 * the OpenTelemetry Logs format. Designed for use in TanStack Start server functions.
 *
 * IMPORTANT: Only import this module in server-side code (server functions).
 * Do not import from client components or route files directly.
 *
 * SERVERLESS ENVIRONMENT NOTES:
 * - This module uses module-level state to cache configuration (PostHog token, endpoint).
 * - Configuration is initialized once and assumed to remain stable throughout the module's lifetime.
 * - In Cloudflare Workers, modules are cached across requests, so environment variables
 *   must remain consistent between deployments.
 *
 * PREVENTING LOG LOSS:
 * - Automatically uses cloudflare:workers' waitUntil to ensure logs complete
 * - This ensures logs complete even after the response is sent
 * - No manual configuration needed - just call logInfo(), logWarning(), or logError()
 *
 * REQUEST CONTEXT:
 * - All logs automatically include request context (requestId, userId, teamId) when available
 * - Use withRequestContext() to establish context at request entry points
 * - Use addRequestContextAttribute() to add IDs of created/modified entities
 */

// Import env and waitUntil from cloudflare:workers for server-side access to bindings
// waitUntil ensures log requests complete even after the response is sent
import { env, waitUntil } from "cloudflare:workers"
import {
	getContextAttributesForLogging,
	getRequestDuration,
} from "./request-context"

/**
 * OpenTelemetry severity numbers
 * @see https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber
 */
const SeverityNumber = {
	TRACE: 1,
	DEBUG: 5,
	INFO: 9,
	WARN: 13,
	ERROR: 17,
	FATAL: 21,
} as const

type SeverityNumberType = (typeof SeverityNumber)[keyof typeof SeverityNumber]

interface LogParams {
	message: string
	attributes?: Record<string, unknown>
	error?: unknown
	severityNumber?: SeverityNumberType
	severityText?: string
}

const DEFAULT_ENDPOINT = "https://us.i.posthog.com/i/v1/logs"

let isPostHogEnabled = false
let posthogToken: string | undefined
let endpoint: string

/**
 * Type-safe access to env vars that may or may not exist
 */
function getEnvVar(key: string): string | undefined {
	// Cast through unknown to safely access potentially undefined keys
	return (env as unknown as Record<string, string | undefined>)[key]
}

function initConfig() {
	if (posthogToken !== undefined) return

	// Access PostHog key from Cloudflare Workers env bindings
	// Falls back to VITE_ env for local dev with Vite
	posthogToken = getEnvVar("POSTHOG_KEY") ?? import.meta.env.VITE_POSTHOG_KEY
	endpoint =
		getEnvVar("POSTHOG_LOGS_ENDPOINT") ??
		import.meta.env.VITE_POSTHOG_LOGS_ENDPOINT ??
		DEFAULT_ENDPOINT
	isPostHogEnabled = !!posthogToken
}

/**
 * Send log directly to PostHog using fetch (Cloudflare Workers compatible)
 * Uses OTLP JSON format: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 * Automatically uses cloudflare:workers waitUntil to ensure logs complete
 *
 * @param params - Log parameters including message, severity, and attributes
 */
function sendLogToPostHog(params: {
	message: string
	severityNumber: SeverityNumberType
	severityText: string
	attributes: Record<string, unknown>
}): void {
	if (!isPostHogEnabled || !posthogToken) return

	const now = Date.now()
	const body = {
		resourceLogs: [
			{
				resource: {
					attributes: [
						{ key: "service.name", value: { stringValue: "wodsmith-start" } },
						{ key: "service.namespace", value: { stringValue: "web" } },
						{
							key: "deployment.environment.name",
							value: {
								stringValue:
									getEnvVar("ENVIRONMENT") ??
									(import.meta.env.DEV ? "development" : "production"),
							},
						},
					],
				},
				scopeLogs: [
					{
						scope: { name: "posthog-otel-logger", version: "1.0.0" },
						logRecords: [
							{
								timeUnixNano: String(now * 1_000_000),
								severityNumber: params.severityNumber,
								severityText: params.severityText,
								body: { stringValue: params.message },
								attributes: Object.entries(params.attributes).map(
									([key, value]) => ({
										key,
										value: formatAttributeValue(value),
									}),
								),
							},
						],
					},
				],
			},
		],
	}

	// Create AbortController with 5s timeout to prevent hanging requests
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), 5000)

	const fetchPromise = (async () => {
		try {
			const response = await fetch(endpoint, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${posthogToken}`,
				},
				body: JSON.stringify(body),
				signal: controller.signal,
			})

			if (!response.ok) {
				console.error(
					"[posthog-otel] Failed to send log:",
					response.status,
					await response.text(),
				)
			}
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") {
				console.error("[posthog-otel] Request timed out after 5s")
			} else {
				console.error("[posthog-otel] Error sending log:", err)
			}
		} finally {
			clearTimeout(timeoutId)
		}
	})()

	// Use cloudflare:workers waitUntil to ensure the request completes
	// This is equivalent to OpenNext's getCloudflareContext().ctx.waitUntil
	try {
		waitUntil(fetchPromise)
	} catch (_err) {
		// waitUntil may not be available in some contexts (e.g., local dev without workers)
		// The fetch will still be attempted but may not complete if execution terminates early
	}
}

function formatAttributeValue(value: unknown): Record<string, unknown> {
	if (typeof value === "string") {
		return { stringValue: value }
	}
	if (typeof value === "number") {
		return Number.isInteger(value)
			? { intValue: String(value) }
			: { doubleValue: value }
	}
	if (typeof value === "boolean") {
		return { boolValue: value }
	}
	if (Array.isArray(value)) {
		return {
			arrayValue: {
				values: value.map((v) => formatAttributeValue(v)),
			},
		}
	}
	if (value !== null && typeof value === "object") {
		return { stringValue: JSON.stringify(value) }
	}
	return { stringValue: String(value) }
}

function enrichAttributes({
	attributes,
	error,
	severityText,
}: Pick<LogParams, "attributes" | "error" | "severityText">) {
	// Get request context attributes (requestId, userId, teamId, etc.)
	const contextAttrs = getContextAttributesForLogging()

	const baseAttrs = {
		...contextAttrs,
		...attributes,
		severity_text: severityText,
	}

	if (!error) {
		return baseAttrs
	}

	const errorValue =
		error instanceof Error
			? { message: error.message, stack: error.stack }
			: { message: String(error) }

	return {
		...baseAttrs,
		error: errorValue,
	}
}

/**
 * Check if we're in development mode
 */
function isDev(): boolean {
	return (
		getEnvVar("ENVIRONMENT") === "development" || import.meta.env.DEV === true
	)
}

/**
 * Emit to console as fallback when PostHog is disabled or in development.
 * This ensures logs are always visible somewhere.
 * Includes request context (requestId, userId, etc.) for easier local debugging.
 */
function emitToConsole(
	severityText: string,
	message: string,
	attributes?: Record<string, unknown>,
	error?: unknown,
) {
	// Always emit to console in development, or when PostHog is disabled
	if (isDev() || !isPostHogEnabled) {
		// Include request context in console output
		const contextAttrs = getContextAttributesForLogging()
		const logData = { ...contextAttrs, ...attributes }

		if (error) {
			logData.error =
				error instanceof Error
					? { message: error.message, stack: error.stack }
					: String(error)
		}

		const hasLogData = Object.keys(logData).length > 0

		// Format requestId prefix for easier log correlation
		const requestIdPrefix = contextAttrs.requestId
			? `[${contextAttrs.requestId}] `
			: ""

		switch (severityText) {
			case "ERROR":
				if (hasLogData) {
					console.error(`[ERROR] ${requestIdPrefix}${message}`, logData)
				} else {
					console.error(`[ERROR] ${requestIdPrefix}${message}`)
				}
				break
			case "WARN":
				if (hasLogData) {
					console.warn(`[WARN] ${requestIdPrefix}${message}`, logData)
				} else {
					console.warn(`[WARN] ${requestIdPrefix}${message}`)
				}
				break
			default:
				if (hasLogData) {
					console.info(`[INFO] ${requestIdPrefix}${message}`, logData)
				} else {
					console.info(`[INFO] ${requestIdPrefix}${message}`)
				}
		}
	}
}

/**
 * Log an informational message.
 * Use for general application events, successful operations, and status updates.
 *
 * @param params - Log parameters
 * @param params.message - The log message
 * @param params.attributes - Optional key-value pairs for structured data
 * @param params.error - Optional error object to include
 */
export function logInfo(params: LogParams): void {
	initConfig()
	const severityNumber = params.severityNumber ?? SeverityNumber.INFO
	const severityText = params.severityText ?? "INFO"

	sendLogToPostHog({
		message: params.message,
		severityNumber,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	emitToConsole(severityText, params.message, params.attributes, params.error)
}

/**
 * Log a warning message.
 * Use for potentially problematic situations that don't prevent operation.
 *
 * @param params - Log parameters
 * @param params.message - The log message
 * @param params.attributes - Optional key-value pairs for structured data
 * @param params.error - Optional error object to include
 */
export function logWarning(params: LogParams): void {
	initConfig()
	const severityText = params.severityText ?? "WARN"
	const severityNumber = params.severityNumber ?? SeverityNumber.WARN

	sendLogToPostHog({
		message: params.message,
		severityNumber,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	emitToConsole(severityText, params.message, params.attributes, params.error)
}

/**
 * Log an error message.
 * Use for error conditions, exceptions, and failures.
 *
 * @param params - Log parameters
 * @param params.message - The log message
 * @param params.attributes - Optional key-value pairs for structured data
 * @param params.error - Optional error object to include (recommended)
 */
export function logError(params: LogParams): void {
	initConfig()
	const severityText = params.severityText ?? "ERROR"
	const severityNumber = params.severityNumber ?? SeverityNumber.ERROR

	sendLogToPostHog({
		message: params.message,
		severityNumber,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	emitToConsole(severityText, params.message, params.attributes, params.error)
}

/**
 * Debug logging - only emitted in development, never sent to PostHog.
 * Use this for temporary debugging statements.
 *
 * @param params - Log parameters (severityNumber and severityText are fixed)
 */
export function logDebug(
	params: Omit<LogParams, "severityNumber" | "severityText">,
) {
	if (isDev()) {
		const logData = params.attributes ? { ...params.attributes } : {}
		if (params.error) {
			logData.error =
				params.error instanceof Error
					? { message: params.error.message, stack: params.error.stack }
					: String(params.error)
		}

		const hasLogData = Object.keys(logData).length > 0
		if (hasLogData) {
			console.debug(`[DEBUG] ${params.message}`, logData)
		} else {
			console.debug(`[DEBUG] ${params.message}`)
		}
	}
}

/**
 * Flush all pending logs. Call this before process shutdown.
 * No-op with fetch-based implementation since logs are sent immediately.
 */
export async function flushLogs(): Promise<void> {
	// No-op - logs are sent immediately with fetch
}

// Re-export request context utilities for convenience
export {
	addRequestContextAttribute,
	createOperationSpan,
	extractRequestInfo,
	getOrCreateRequestId,
	getRequestContext,
	getRequestContextField,
	getRequestDuration,
	updateRequestContext,
	withRequestContext,
	type RequestContext,
} from "./request-context"

/**
 * Log the start of a server function execution.
 * Use at the beginning of server functions to track entry.
 *
 * @param fnName - Name of the server function
 * @param input - Input data (will be sanitized to remove sensitive fields)
 */
export function logServerFnStart(
	fnName: string,
	input?: Record<string, unknown>,
): void {
	const sanitizedInput = input ? sanitizeInput(input) : undefined
	logInfo({
		message: `[ServerFn] ${fnName} started`,
		attributes: {
			serverFn: fnName,
			...(sanitizedInput ? { input: sanitizedInput } : {}),
		},
	})
}

/**
 * Log the successful completion of a server function.
 * Includes duration if request context is available.
 *
 * @param fnName - Name of the server function
 * @param result - Optional result metadata (IDs, counts, etc.)
 */
export function logServerFnSuccess(
	fnName: string,
	result?: Record<string, unknown>,
): void {
	const duration = getRequestDuration()
	logInfo({
		message: `[ServerFn] ${fnName} completed`,
		attributes: {
			serverFn: fnName,
			...(duration !== undefined ? { durationMs: duration } : {}),
			...(result ?? {}),
		},
	})
}

/**
 * Log a server function error.
 * Includes duration and error details.
 *
 * @param fnName - Name of the server function
 * @param error - The error that occurred
 * @param context - Additional context about the error
 */
export function logServerFnError(
	fnName: string,
	error: unknown,
	context?: Record<string, unknown>,
): void {
	const duration = getRequestDuration()
	logError({
		message: `[ServerFn] ${fnName} failed`,
		error,
		attributes: {
			serverFn: fnName,
			...(duration !== undefined ? { durationMs: duration } : {}),
			...(context ?? {}),
		},
	})
}

/**
 * Log an HTTP request (entry point).
 * Call at the start of request handling.
 */
export function logRequest(params: {
	method: string
	path: string
	userAgent?: string
}): void {
	logInfo({
		message: `[HTTP] ${params.method} ${params.path}`,
		attributes: {
			httpMethod: params.method,
			httpPath: params.path,
			...(params.userAgent ? { userAgent: params.userAgent } : {}),
		},
	})
}

/**
 * Log an HTTP response.
 * Call when sending a response.
 */
export function logResponse(params: {
	method: string
	path: string
	status: number
	durationMs?: number
}): void {
	const level = params.status >= 500 ? "error" : params.status >= 400 ? "warn" : "info"
	const logFn = level === "error" ? logError : level === "warn" ? logWarning : logInfo

	logFn({
		message: `[HTTP] ${params.method} ${params.path} -> ${params.status}`,
		attributes: {
			httpMethod: params.method,
			httpPath: params.path,
			httpStatus: params.status,
			...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
		},
	})
}

/**
 * Log a database operation.
 * Use for tracking important database operations.
 */
export function logDbOperation(params: {
	operation: "insert" | "update" | "delete" | "query"
	table: string
	durationMs?: number
	rowCount?: number
	ids?: string[]
}): void {
	logInfo({
		message: `[DB] ${params.operation} ${params.table}`,
		attributes: {
			dbOperation: params.operation,
			dbTable: params.table,
			...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
			...(params.rowCount !== undefined ? { rowCount: params.rowCount } : {}),
			...(params.ids?.length ? { affectedIds: params.ids } : {}),
		},
	})
}

/**
 * Log entity creation with its ID.
 * Use when creating new records to track what was created.
 */
export function logEntityCreated(params: {
	entity: string
	id: string
	parentId?: string
	parentEntity?: string
	attributes?: Record<string, unknown>
}): void {
	logInfo({
		message: `[Entity] Created ${params.entity}`,
		attributes: {
			entity: params.entity,
			entityId: params.id,
			...(params.parentId ? { parentId: params.parentId } : {}),
			...(params.parentEntity ? { parentEntity: params.parentEntity } : {}),
			...(params.attributes ?? {}),
		},
	})
}

/**
 * Log entity update with its ID.
 * Use when updating records to track what was modified.
 */
export function logEntityUpdated(params: {
	entity: string
	id: string
	fields?: string[]
	attributes?: Record<string, unknown>
}): void {
	logInfo({
		message: `[Entity] Updated ${params.entity}`,
		attributes: {
			entity: params.entity,
			entityId: params.id,
			...(params.fields?.length ? { updatedFields: params.fields } : {}),
			...(params.attributes ?? {}),
		},
	})
}

/**
 * Log entity deletion with its ID.
 * Use when deleting records to track what was removed.
 */
export function logEntityDeleted(params: {
	entity: string
	id: string
	attributes?: Record<string, unknown>
}): void {
	logInfo({
		message: `[Entity] Deleted ${params.entity}`,
		attributes: {
			entity: params.entity,
			entityId: params.id,
			...(params.attributes ?? {}),
		},
	})
}

/**
 * Sanitize input data by removing sensitive fields.
 * Used to prevent logging passwords, tokens, etc.
 */
function sanitizeInput(input: Record<string, unknown>): Record<string, unknown> {
	const sensitiveFields = [
		"password",
		"passwordHash",
		"token",
		"secret",
		"apiKey",
		"authorization",
		"creditCard",
		"ssn",
		"captchaToken",
	]

	const sanitized: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(input)) {
		const lowerKey = key.toLowerCase()
		if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
			sanitized[key] = "[REDACTED]"
		} else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
			sanitized[key] = sanitizeInput(value as Record<string, unknown>)
		} else {
			sanitized[key] = value
		}
	}
	return sanitized
}
