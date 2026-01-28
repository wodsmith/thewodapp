/**
 * Submission Window Notifications Cron API (Manual Trigger)
 *
 * NOTE: The primary cron trigger is now native Cloudflare scheduled events,
 * configured in alchemy.run.ts and handled by src/server.ts.
 * This HTTP endpoint is kept for manual testing and development.
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * Notifications sent:
 * - Window opens: When a submission window becomes active
 * - Window closes soon (24h): Reminder 24 hours before window closes
 * - Window closes soon (1h): Reminder 1 hour before window closes
 * - Window closes soon (15m): LAST CHANCE reminder 15 minutes before close
 * - Window closed: Notification when window has closed
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { getCronSecret } from "@/lib/env"
import { logError, logInfo, logWarning } from "@/lib/logging/posthog-otel-logger"
import { processSubmissionWindowNotifications } from "@/server/notifications"

export const Route = createFileRoute("/api/cron/submission-window-notifications")({
	server: {
		handlers: {
			/**
			 * POST /api/cron/submission-window-notifications
			 *
			 * Process all pending submission window notifications.
			 * Requires Authorization header with Bearer token matching CRON_SECRET.
			 */
			POST: async ({ request }: { request: Request }) => {
				// Verify cron secret
				const cronSecret = getCronSecret()
				if (!cronSecret) {
					logWarning({
						message: "[Cron] CRON_SECRET not configured, rejecting request",
					})
					return json({ error: "Cron not configured" }, { status: 500 })
				}

				const authHeader = request.headers.get("Authorization")
				const providedSecret = authHeader?.replace("Bearer ", "")

				if (!providedSecret || providedSecret !== cronSecret) {
					logWarning({
						message: "[Cron] Unauthorized cron request",
						attributes: {
							hasAuthHeader: !!authHeader,
						},
					})
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				// Process notifications
				try {
					logInfo({
						message: "[Cron] Starting submission window notification processing",
					})

					const result = await processSubmissionWindowNotifications()

					logInfo({
						message: "[Cron] Completed submission window notification processing",
						attributes: {
							windowOpens: result.windowOpens,
							windowCloses24h: result.windowCloses24h,
							windowCloses1h: result.windowCloses1h,
							windowCloses15m: result.windowCloses15m,
							windowClosed: result.windowClosed,
							errors: result.errors,
						},
					})

					return json({
						success: true,
						processed: {
							windowOpens: result.windowOpens,
							windowCloses24h: result.windowCloses24h,
							windowCloses1h: result.windowCloses1h,
							windowCloses15m: result.windowCloses15m,
							windowClosed: result.windowClosed,
						},
						errors: result.errors,
					})
				} catch (err) {
					logError({
						message: "[Cron] Failed to process submission window notifications",
						error: err,
					})
					return json({ error: "Processing failed" }, { status: 500 })
				}
			},

			/**
			 * GET /api/cron/submission-window-notifications
			 *
			 * Health check endpoint - returns status without processing.
			 * Still requires authentication.
			 */
			GET: async ({ request }: { request: Request }) => {
				// Verify cron secret
				const cronSecret = getCronSecret()
				if (!cronSecret) {
					return json({ error: "Cron not configured" }, { status: 500 })
				}

				const authHeader = request.headers.get("Authorization")
				const providedSecret = authHeader?.replace("Bearer ", "")

				if (!providedSecret || providedSecret !== cronSecret) {
					return json({ error: "Unauthorized" }, { status: 401 })
				}

				return json({
					status: "ok",
					endpoint: "submission-window-notifications",
					description: "POST to process notifications",
				})
			},
		},
	},
})
