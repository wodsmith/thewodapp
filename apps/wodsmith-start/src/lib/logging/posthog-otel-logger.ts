import { SeverityNumber } from "@opentelemetry/api-logs"

/**
 * PostHog OpenTelemetry Logger for Cloudflare Workers via TanStack Start
 *
 * SERVERLESS ENVIRONMENT NOTES:
 * - This module uses module-level state to cache configuration (PostHog token, endpoint).
 * - Configuration is initialized once and assumed to remain stable throughout the module's lifetime.
 * - In Cloudflare Workers, modules are cached across requests, so environment variables
 *   must remain consistent between deployments.
 * - If environment variables change between deployments, restart the worker to pick up new values.
 *
 * PREVENTING LOG LOSS:
 * - For TanStack Start on Cloudflare Workers, logs are sent via fetch
 * - Use env.waitUntil if available in request context for guaranteed delivery
 * - No manual configuration needed - just call logInfo(), logWarning(), or logError()
 */

interface LogParams {
	message: string
	attributes?: Record<string, unknown>
	error?: unknown
	severityNumber?: SeverityNumber
	severityText?: string
}

const DEFAULT_ENDPOINT = "https://us.i.posthog.com/i/v1/logs"

let isPostHogEnabled = false
let posthogToken: string | undefined
let endpoint: string

function initConfig() {
	if (posthogToken !== undefined) return

	posthogToken = process.env.VITE_PUBLIC_POSTHOG_KEY
	endpoint = process.env.POSTHOG_LOGS_ENDPOINT ?? DEFAULT_ENDPOINT
	isPostHogEnabled = !!posthogToken
}

/**
 * Send log directly to PostHog using fetch (Cloudflare Workers compatible)
 * Uses OTLP JSON format: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 */
function sendLogToPostHog(params: {
	message: string
	attributes?: Record<string, unknown>
	error?: unknown
	severityNumber?: SeverityNumber
	severityText?: string
}) {
	initConfig()

	if (!isPostHogEnabled) {
		return Promise.resolve()
	}

	const {
		message,
		attributes = {},
		error,
		severityNumber = SeverityNumber.UNSPECIFIED,
		severityText = "UNSPECIFIED",
	} = params

	// Build error details if provided
	const errorAttributes = error
		? {
				"error.type":
					error instanceof Error ? error.constructor.name : typeof error,
				"error.message": error instanceof Error ? error.message : String(error),
				"error.stack": error instanceof Error ? error.stack : undefined,
			}
		: {}

	// Merge all attributes
	const mergedAttributes = {
		...attributes,
		...errorAttributes,
	}

	// OTLP JSON format
	const body = {
		resourceLogs: [
			{
				resource: {
					attributes: [
						{
							key: "service.name",
							value: { stringValue: "wodsmith-api" },
						},
					],
				},
				scopeLogs: [
					{
						scope: {
							name: "PostHog",
						},
						logRecords: [
							{
								timeUnixNano: String(Date.now() * 1_000_000),
								severityNumber,
								severityText,
								body: {
									stringValue: message,
								},
								attributes: Object.entries(mergedAttributes).map(
									([key, value]) => ({
										key,
										value: {
											stringValue: String(value),
										},
									}),
								),
							},
						],
					},
				],
			},
		],
	}

	// Fire and forget - don't await
	fetch(endpoint, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${posthogToken}`,
		},
		body: JSON.stringify(body),
	}).catch((err) => {
		// Silently fail - logging shouldn't break the app
		console.error("[PostHog Log Error]", err)
	})

	return Promise.resolve()
}

/**
 * Log info level message to PostHog
 */
export function logInfo(
	params: Omit<LogParams, "severityNumber" | "severityText">,
) {
	return sendLogToPostHog({
		...params,
		severityNumber: SeverityNumber.INFO,
		severityText: "INFO",
	})
}

/**
 * Log warning level message to PostHog
 */
export function logWarning(
	params: Omit<LogParams, "severityNumber" | "severityText">,
) {
	return sendLogToPostHog({
		...params,
		severityNumber: SeverityNumber.WARN,
		severityText: "WARN",
	})
}

/**
 * Log error level message to PostHog
 */
export function logError(
	params: Omit<LogParams, "severityNumber" | "severityText">,
) {
	return sendLogToPostHog({
		...params,
		severityNumber: SeverityNumber.ERROR,
		severityText: "ERROR",
	})
}
