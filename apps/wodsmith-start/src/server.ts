/**
 * Custom server entry point for TanStack Start on Cloudflare Workers.
 *
 * This file extends the default TanStack Start server entry to add
 * Cloudflare-specific handlers like scheduled (cron) triggers.
 *
 * OBSERVABILITY:
 * - All HTTP requests are wrapped with request context for tracing
 * - Each request gets a unique requestId that flows through all logs
 * - Request/response logging provides visibility into traffic
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/hosting#custom-server-entry
 */

import type {
	ExecutionContext,
	ScheduledController,
} from "@cloudflare/workers-types"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import {
	extractRequestInfo,
	logError,
	logInfo,
	logRequest,
	logResponse,
	withRequestContext,
} from "./lib/logging"

// Create the base TanStack Start entry with default fetch handling
const startEntry = createServerEntry({
	fetch(request) {
		return handler.fetch(request)
	},
})

/**
 * Wrap fetch handler with request context and logging.
 * Establishes a unique requestId for each request that flows through all logs.
 */
async function fetchWithLogging(
	request: Request,
	_env: Env,
	_ctx: ExecutionContext,
): Promise<Response> {
	const requestInfo = extractRequestInfo(request)
	const startTime = Date.now()

	// Skip detailed logging for static assets and health checks
	const isStaticAsset =
		requestInfo.path.startsWith("/_build/") ||
		requestInfo.path.startsWith("/assets/") ||
		requestInfo.path.endsWith(".js") ||
		requestInfo.path.endsWith(".css") ||
		requestInfo.path.endsWith(".ico") ||
		requestInfo.path.endsWith(".png") ||
		requestInfo.path.endsWith(".jpg") ||
		requestInfo.path.endsWith(".svg") ||
		requestInfo.path.endsWith(".woff2")

	return withRequestContext(
		{
			method: requestInfo.method,
			path: requestInfo.path,
		},
		async () => {
			// Log request entry (skip for static assets)
			if (!isStaticAsset) {
				logRequest({
					method: requestInfo.method,
					path: requestInfo.path,
					userAgent: requestInfo.userAgent,
				})
			}

			try {
				// Call the original fetch handler
				const response = await startEntry.fetch(request)
				const durationMs = Date.now() - startTime

				// Log response (skip for static assets unless error)
				if (!isStaticAsset || response.status >= 400) {
					logResponse({
						method: requestInfo.method,
						path: requestInfo.path,
						status: response.status,
						durationMs,
					})
				}

				return response
			} catch (error) {
				const durationMs = Date.now() - startTime

				logError({
					message: `[HTTP] ${requestInfo.method} ${requestInfo.path} -> Error`,
					error,
					attributes: {
						httpMethod: requestInfo.method,
						httpPath: requestInfo.path,
						durationMs,
					},
				})

				// Re-throw to let the framework handle the error
				throw error
			}
		},
	)
}

/**
 * Export the server entry with additional Cloudflare Workers handlers.
 *
 * This object conforms to Cloudflare's ExportedHandler interface:
 * - `fetch`: Handles all HTTP requests (with logging and request context)
 * - `scheduled`: Handles cron trigger events
 */
export default {
	// HTTP requests with logging and request context
	fetch: fetchWithLogging,

	// Cloudflare cron trigger handler - invoked directly by Cloudflare's scheduler.
	// Schedule configured in alchemy.run.ts (every 15 minutes).
	async scheduled(
		controller: ScheduledController,
		_env: Env,
		_ctx: ExecutionContext,
	) {
		// Wrap cron execution with request context for tracing
		return withRequestContext(
			{
				method: "CRON",
				path: controller.cron,
			},
			async () => {
				logInfo({
					message: "[Cron] Scheduled handler triggered",
					attributes: {
						cron: controller.cron,
						scheduledTime: controller.scheduledTime,
					},
				})

				try {
					// Dynamic import to keep cold start fast
					const { processSubmissionWindowNotifications } = await import(
						"./server/notifications/submission-window"
					)

					const result = await processSubmissionWindowNotifications()

					logInfo({
						message: "[Cron] Submission window notifications processed",
						attributes: {
							cron: controller.cron,
							windowOpens: result.windowOpens,
							windowCloses24h: result.windowCloses24h,
							windowCloses1h: result.windowCloses1h,
							windowCloses15m: result.windowCloses15m,
							windowClosed: result.windowClosed,
							errors: result.errors,
						},
					})
				} catch (err) {
					logError({
						message: "[Cron] Failed to process submission window notifications",
						error: err,
						attributes: {
							cron: controller.cron,
							scheduledTime: controller.scheduledTime,
						},
					})
				}
			},
		)
	},
}
