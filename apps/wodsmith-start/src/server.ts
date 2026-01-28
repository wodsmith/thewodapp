/**
 * Custom server entry point for TanStack Start on Cloudflare Workers.
 *
 * This file extends the default TanStack Start server entry to add
 * Cloudflare-specific handlers like scheduled (cron) triggers.
 *
 * @see https://tanstack.com/start/latest/docs/framework/react/hosting#custom-server-entry
 */

import type {
	ExecutionContext,
	ScheduledController,
} from "@cloudflare/workers-types"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { logError, logInfo } from "./lib/logging/posthog-otel-logger"

// Create the base TanStack Start entry with default fetch handling
const startEntry = createServerEntry({
	fetch(request) {
		return handler.fetch(request)
	},
})

/**
 * Export the server entry with additional Cloudflare Workers handlers.
 *
 * This object conforms to Cloudflare's ExportedHandler interface:
 * - `fetch`: Handles all HTTP requests (delegated to TanStack Start)
 * - `scheduled`: Handles cron trigger events
 */
export default {
	// TanStack Start handles all HTTP requests
	fetch: startEntry.fetch,

	// Cloudflare cron trigger handler - invoked directly by Cloudflare's scheduler.
	// Schedule configured in alchemy.run.ts (every 15 minutes).
	async scheduled(
		controller: ScheduledController,
		_env: Env,
		_ctx: ExecutionContext,
	) {
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
}
