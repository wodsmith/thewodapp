import "server-only"

import { SeverityNumber } from "@opentelemetry/api-logs"

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

	posthogToken = process.env.NEXT_PUBLIC_POSTHOG_KEY
	endpoint = process.env.POSTHOG_LOGS_ENDPOINT ?? DEFAULT_ENDPOINT
	isPostHogEnabled = !!posthogToken
}

/**
 * Send log directly to PostHog using fetch (Cloudflare Workers compatible)
 * Uses OTLP JSON format: https://opentelemetry.io/docs/specs/otlp/#json-protobuf-encoding
 */
async function sendLogToPostHog(params: {
	message: string
	severityNumber: SeverityNumber
	severityText: string
	attributes: Record<string, unknown>
}) {
	if (!isPostHogEnabled || !posthogToken) return

	const now = Date.now()
	const body = {
		resourceLogs: [
			{
				resource: {
					attributes: [
						{ key: "service.name", value: { stringValue: "wodsmith" } },
						{ key: "service.namespace", value: { stringValue: "web" } },
						{
							key: "deployment.environment.name",
							value: { stringValue: process.env.NODE_ENV ?? "development" },
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

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${posthogToken}`,
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			console.error(
				"[posthog-otel] Failed to send log:",
				response.status,
				await response.text(),
			)
		}
	} catch (err) {
		console.error("[posthog-otel] Error sending log:", err)
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
	if (process.env.NODE_ENV === "development" || !isPostHogEnabled) {
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

export function logInfo(params: LogParams) {
	initConfig()
	const severityNumber = params.severityNumber ?? SeverityNumber.INFO
	const severityText = params.severityText ?? "INFO"

	// Fire and forget - don't await to avoid blocking
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

export function logWarning(params: LogParams) {
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

export function logError(params: LogParams) {
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
 */
export function logDebug(params: Omit<LogParams, "severityNumber" | "severityText">) {
	if (process.env.NODE_ENV === "development") {
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
