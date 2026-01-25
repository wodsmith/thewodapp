/**
 * Submission Window Notifications Cron API
 *
 * This endpoint processes submission window notifications for online competitions.
 * It should be called by a scheduled job (e.g., Cloudflare Cron Trigger or external scheduler)
 * approximately every hour.
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * Notifications sent:
 * - Window opens: When a submission window becomes active
 * - Window closes soon (24h): Reminder 24 hours before window closes
 * - Window closes soon (1h): Final reminder 1 hour before window closes
 * - Window closed: Notification when window has closed
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { getCronSecret } from "@/lib/env"
import { logError, logInfo, logWarning } from "@/lib/logging/posthog-otel-logger"
import { processSubmissionWindowNotifications } from "@/server/notifications"

// Note: Route type will be auto-generated when running build/dev
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = (createFileRoute as any)("/api/cron/submission-window-notifications")({
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
