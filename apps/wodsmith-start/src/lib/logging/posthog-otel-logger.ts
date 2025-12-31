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
 */

// Import env from cloudflare:workers for server-side access to bindings
import { env } from "cloudflare:workers"

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
 *
 * @param params - Log parameters including message, severity, and attributes
 * @param ctx - Optional Cloudflare Workers ExecutionContext for reliable delivery
 * @returns Promise that resolves when the log is sent (or undefined if logging is disabled)
 */
function sendLogToPostHog(
	params: {
		message: string
		severityNumber: SeverityNumberType
		severityText: string
		attributes: Record<string, unknown>
	},
	ctx?: ExecutionContext,
): Promise<void> | undefined {
	if (!isPostHogEnabled || !posthogToken) return undefined

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

	const fetchPromise = fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${posthogToken}`,
		},
		body: JSON.stringify(body),
		signal: controller.signal,
	})
		.then(() => {
			// Discard response, we only care about success
		})
		.catch((err) => {
			if (err instanceof Error && err.name === "AbortError") {
				console.error("[posthog-otel] Request timed out after 5s")
			} else {
				console.error("[posthog-otel] Error sending log:", err)
			}
		})
		.finally(() => {
			clearTimeout(timeoutId)
		})

	// Use ctx.waitUntil to ensure the request completes in serverless environments
	if (ctx) {
		ctx.waitUntil(fetchPromise)
	}

	return fetchPromise
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
	if (!error) {
		return { ...attributes, severity_text: severityText }
	}

	const errorValue =
		error instanceof Error
			? { message: error.message, stack: error.stack }
			: { message: String(error) }

	return {
		...attributes,
		severity_text: severityText,
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
 */
function emitToConsole(
	severityText: string,
	message: string,
	attributes?: Record<string, unknown>,
	error?: unknown,
) {
	// Always emit to console in development, or when PostHog is disabled
	if (isDev() || !isPostHogEnabled) {
		const logData = attributes ? { ...attributes } : {}
		if (error) {
			logData.error =
				error instanceof Error
					? { message: error.message, stack: error.stack }
					: String(error)
		}

		const hasLogData = Object.keys(logData).length > 0

		switch (severityText) {
			case "ERROR":
				if (hasLogData) {
					console.error(`[ERROR] ${message}`, logData)
				} else {
					console.error(`[ERROR] ${message}`)
				}
				break
			case "WARN":
				if (hasLogData) {
					console.warn(`[WARN] ${message}`, logData)
				} else {
					console.warn(`[WARN] ${message}`)
				}
				break
			default:
				if (hasLogData) {
					console.info(`[INFO] ${message}`, logData)
				} else {
					console.info(`[INFO] ${message}`)
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
 * @param ctx - Optional Cloudflare Workers ExecutionContext for reliable delivery
 * @returns Promise that resolves when the log is sent (or undefined if logging is disabled)
 */
export function logInfo(
	params: LogParams,
	ctx?: ExecutionContext,
): Promise<void> | undefined {
	initConfig()
	const severityNumber = params.severityNumber ?? SeverityNumber.INFO
	const severityText = params.severityText ?? "INFO"

	const result = sendLogToPostHog(
		{
			message: params.message,
			severityNumber,
			severityText,
			attributes: enrichAttributes({
				attributes: params.attributes,
				error: params.error,
				severityText,
			}),
		},
		ctx,
	)

	emitToConsole(severityText, params.message, params.attributes, params.error)
	return result
}

/**
 * Log a warning message.
 * Use for potentially problematic situations that don't prevent operation.
 *
 * @param params - Log parameters
 * @param params.message - The log message
 * @param params.attributes - Optional key-value pairs for structured data
 * @param params.error - Optional error object to include
 * @param ctx - Optional Cloudflare Workers ExecutionContext for reliable delivery
 * @returns Promise that resolves when the log is sent (or undefined if logging is disabled)
 */
export function logWarning(
	params: LogParams,
	ctx?: ExecutionContext,
): Promise<void> | undefined {
	initConfig()
	const severityText = params.severityText ?? "WARN"
	const severityNumber = params.severityNumber ?? SeverityNumber.WARN

	const result = sendLogToPostHog(
		{
			message: params.message,
			severityNumber,
			severityText,
			attributes: enrichAttributes({
				attributes: params.attributes,
				error: params.error,
				severityText,
			}),
		},
		ctx,
	)

	emitToConsole(severityText, params.message, params.attributes, params.error)
	return result
}

/**
 * Log an error message.
 * Use for error conditions, exceptions, and failures.
 *
 * @param params - Log parameters
 * @param params.message - The log message
 * @param params.attributes - Optional key-value pairs for structured data
 * @param params.error - Optional error object to include (recommended)
 * @param ctx - Optional Cloudflare Workers ExecutionContext for reliable delivery
 * @returns Promise that resolves when the log is sent (or undefined if logging is disabled)
 */
export function logError(
	params: LogParams,
	ctx?: ExecutionContext,
): Promise<void> | undefined {
	initConfig()
	const severityText = params.severityText ?? "ERROR"
	const severityNumber = params.severityNumber ?? SeverityNumber.ERROR

	const result = sendLogToPostHog(
		{
			message: params.message,
			severityNumber,
			severityText,
			attributes: enrichAttributes({
				attributes: params.attributes,
				error: params.error,
				severityText,
			}),
		},
		ctx,
	)

	emitToConsole(severityText, params.message, params.attributes, params.error)
	return result
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
