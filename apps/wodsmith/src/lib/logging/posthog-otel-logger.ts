import "server-only"

import { getCloudflareContext } from "@opennextjs/cloudflare"
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api"
import { logs, type Logger, SeverityNumber } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import {
	BatchLogRecordProcessor,
	LoggerProvider,
} from "@opentelemetry/sdk-logs"

interface LogParams {
	message: string
	attributes?: Record<string, unknown>
	error?: unknown
	severityNumber?: SeverityNumber
	severityText?: string
}

const DEFAULT_ENDPOINT = "https://us.i.posthog.com/i/v1/logs"

let cachedLogger: Logger | null = null
let cachedProvider: LoggerProvider | null = null
let isPostHogEnabled = false

function buildResource() {
	return resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "wodsmith",
		// service.namespace and deployment.environment are in incubating semconv
		// Using string literals as they're stable attribute keys
		"service.namespace": "web",
		"deployment.environment.name": process.env.NODE_ENV ?? "development",
	})
}

function createLogger() {
	if (cachedLogger) {
		return cachedLogger
	}

	diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)

	const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_KEY
	const endpoint = process.env.POSTHOG_LOGS_ENDPOINT ?? DEFAULT_ENDPOINT

	if (!posthogToken) {
		diag.warn("PostHog logging disabled: missing NEXT_PUBLIC_POSTHOG_KEY")
		const provider = new LoggerProvider({ resource: buildResource() })
		logs.setGlobalLoggerProvider(provider)
		cachedProvider = provider
		cachedLogger = provider.getLogger("posthog-otel-logger", "1.0.0")
		isPostHogEnabled = false
		return cachedLogger
	}

	const exporter = new OTLPLogExporter({
		url: endpoint,
		headers: {
			Authorization: `Bearer ${posthogToken}`,
		},
	})

	const processor = new BatchLogRecordProcessor(exporter, {
		exportTimeoutMillis: 5_000,
		maxQueueSize: 512,
		maxExportBatchSize: 128,
		scheduledDelayMillis: 1_000,
	})

	const provider = new LoggerProvider({
		resource: buildResource(),
		processors: [processor],
	})

	logs.setGlobalLoggerProvider(provider)
	cachedProvider = provider
	cachedLogger = provider.getLogger("posthog-otel-logger", "1.0.0")
	isPostHogEnabled = true

	return cachedLogger
}

function ensureLogger() {
	return cachedLogger ?? createLogger()
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
 * Schedule a flush using Cloudflare's waitUntil to ensure logs are sent
 * before the worker terminates. This is critical for serverless environments.
 */
function scheduleFlush() {
	if (!isPostHogEnabled || !cachedProvider) {
		return
	}

	try {
		const { ctx } = getCloudflareContext()
		if (ctx?.waitUntil) {
			ctx.waitUntil(
				cachedProvider.forceFlush().catch((err) => {
					// Silently ignore flush errors - logging shouldn't break the app
					console.error("[posthog-otel] flush error:", err)
				}),
			)
		}
	} catch {
		// getCloudflareContext may throw if called outside request context
		// This is fine - logs will be batched and sent on next successful flush
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
	const logger = ensureLogger()
	const severityNumber = params.severityNumber ?? SeverityNumber.INFO
	const severityText = params.severityText ?? "INFO"

	logger.emit({
		body: params.message,
		severityNumber,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	scheduleFlush()
	emitToConsole(severityText, params.message, params.attributes, params.error)
}

export function logWarning(params: LogParams) {
	const logger = ensureLogger()
	const severityText = params.severityText ?? "WARN"

	logger.emit({
		body: params.message,
		severityNumber: params.severityNumber ?? SeverityNumber.WARN,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	scheduleFlush()
	emitToConsole(severityText, params.message, params.attributes, params.error)
}

export function logError(params: LogParams) {
	const logger = ensureLogger()
	const severityText = params.severityText ?? "ERROR"

	logger.emit({
		body: params.message,
		severityNumber: params.severityNumber ?? SeverityNumber.ERROR,
		severityText,
		attributes: enrichAttributes({
			attributes: params.attributes,
			error: params.error,
			severityText,
		}),
	})

	scheduleFlush()
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
 */
export async function flushLogs(): Promise<void> {
	try {
		if (cachedProvider && typeof cachedProvider.forceFlush === "function") {
			await cachedProvider.forceFlush()
		}
	} catch {
		// Ignore flush errors during shutdown
	}
}
