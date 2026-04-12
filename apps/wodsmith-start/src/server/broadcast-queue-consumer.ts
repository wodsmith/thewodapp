// @lat: [[organizer-dashboard#Broadcasts]]
/**
 * Cloudflare Queue consumer for broadcast email delivery.
 *
 * Processes batched broadcast email messages enqueued by sendBroadcastFn.
 * Each message contains up to 100 recipients with pre-rendered HTML.
 * Sends individual emails via Resend with idempotency keys per recipient to prevent
 * duplicate emails on retry.
 *
 * @see docs/adr/0008-organizer-broadcast-messaging.md
 */

import type { MessageBatch } from "@cloudflare/workers-types"
import { inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	BROADCAST_EMAIL_DELIVERY_STATUS,
	competitionBroadcastRecipientsTable,
} from "@/db/schemas/broadcasts"
import { getResendApiKey, getEmailFrom, getEmailFromName } from "@/lib/env"
import { logError, logInfo } from "@/lib/logging"

/**
 * Delay between individual email sends to stay under Resend's 5 emails/s
 * account-wide rate limit.
 *
 * IMPORTANT: this throttle only works because the queue consumer is pinned to
 * `maxConcurrency: 1` in alchemy.run.ts. Without that, Cloudflare autoscales
 * multiple consumer invocations and the aggregate send rate would blow past
 * Resend's limit.
 *
 * 250ms → ~4 emails/s, leaving headroom for clock skew and Resend's
 * token-bucket edges.
 */
const SEND_DELAY_MS = 250

/**
 * Base back-off (in seconds) when Resend returns HTTP 429. The message is
 * re-queued and re-delivered after at least this many seconds, letting
 * Resend's rate-limit window drain.
 */
const RATE_LIMIT_BACKOFF_SECONDS = 10

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Shape of each queue message — matches what sendBroadcastFn enqueues.
 */
export interface BroadcastEmailMessage {
	broadcastId: string
	competitionId: string
	batch: Array<{
		recipientId: string
		email: string
		athleteName: string
	}>
	subject: string
	bodyHtml: string
	replyTo?: string
}

/**
 * Queue consumer handler — called by the Workers runtime when messages arrive.
 *
 * Idempotency strategy:
 * 1. Filter out recipients already in 'sent' state (defense-in-depth)
 * 2. Send individual emails with Resend Idempotency-Key header per recipient
 * 3. Update delivery status atomically per recipient
 */
export async function handleBroadcastEmailQueue(
	batch: MessageBatch,
): Promise<void> {
	const db = getDb()
	const resendApiKey = getResendApiKey()

	if (!resendApiKey) {
		// Dev mode: log emails and mark as sent instead of failing
		logInfo({
			message: "[BroadcastQueue] No RESEND_API_KEY — logging emails (dev mode)",
			attributes: { messageCount: batch.messages.length },
		})
		for (const message of batch.messages) {
			const { broadcastId, batch: msgRecipients, subject } =
				message.body as BroadcastEmailMessage
			for (const r of msgRecipients) {
				console.log(
					`[Email Preview] To: ${r.email} | Subject: ${subject} | Broadcast: ${broadcastId}`,
				)
			}
			// Mark recipients as skipped — no API key means no email was sent
			const recipientIds = msgRecipients.map((r) => r.recipientId)
			if (recipientIds.length > 0) {
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SKIPPED,
					})
					.where(
						inArray(
							competitionBroadcastRecipientsTable.id,
							recipientIds,
						),
					)
			}
			message.ack()
		}
		return
	}

	const emailFrom = getEmailFrom()
	const emailFromName = getEmailFromName()

	for (const message of batch.messages) {
		const { broadcastId, batch: recipients, subject, bodyHtml, replyTo } =
			message.body as BroadcastEmailMessage

		logInfo({
			message: "[BroadcastQueue] Processing queued message",
			attributes: {
				broadcastId,
				recipientCount: recipients.length,
			},
		})

		try {
			// Step 1: Filter out already-sent recipients (idempotency defense-in-depth)
			const recipientIds = recipients.map((r) => r.recipientId)
			const existingRecipients = await db
				.select({
					id: competitionBroadcastRecipientsTable.id,
					emailDeliveryStatus:
						competitionBroadcastRecipientsTable.emailDeliveryStatus,
				})
				.from(competitionBroadcastRecipientsTable)
				.where(
					inArray(competitionBroadcastRecipientsTable.id, recipientIds),
				)

			const alreadySent = new Set(
				existingRecipients
					.filter(
						(r) =>
							r.emailDeliveryStatus ===
							BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
					)
					.map((r) => r.id),
			)

			const pendingRecipients = recipients.filter(
				(r) => !alreadySent.has(r.recipientId),
			)

			if (pendingRecipients.length === 0) {
				logInfo({
					message: "[BroadcastQueue] All recipients already sent, skipping",
					attributes: { broadcastId, skipped: recipients.length },
				})
				message.ack()
				continue
			}

			// Step 2: Send emails individually with idempotency keys
			const results: Array<{
				recipientId: string
				success: boolean
			}> = []

			let rateLimited = false

			for (const recipient of pendingRecipients) {
				try {
					const response = await fetch(
						"https://api.resend.com/emails",
						{
							method: "POST",
							headers: {
								Authorization: `Bearer ${resendApiKey}`,
								"Content-Type": "application/json",
								"Idempotency-Key": `broadcast-${recipient.recipientId}`,
							},
							body: JSON.stringify({
								from: `${emailFromName} <${emailFrom}>`,
								to: [recipient.email],
								subject,
								html: bodyHtml,
								reply_to: replyTo ?? "support@mail.wodsmith.com",
								tags: [
									{
										name: "type",
										value: "competition-broadcast",
									},
								],
							}),
						},
					)

					// Resend rate-limit hit: stop this invocation immediately,
					// persist anything we've already sent, and push the whole
					// message back onto the queue with a delay. The recipient
					// row stays PENDING so the next attempt re-reads it via
					// the `alreadySent` filter above.
					if (response.status === 429) {
						logError({
							message:
								"[BroadcastQueue] Resend rate limit hit (429), backing off",
							attributes: {
								recipientId: recipient.recipientId,
								broadcastId,
								backoffSeconds: RATE_LIMIT_BACKOFF_SECONDS,
							},
						})
						rateLimited = true
						break
					}

					if (!response.ok) {
						const errorBody = await response
							.text()
							.catch(() => "unknown")
						logError({
							message:
								"[BroadcastQueue] Resend API error",
							attributes: {
								recipientId: recipient.recipientId,
								status: response.status,
								error: errorBody,
							},
						})
					}

					results.push({
						recipientId: recipient.recipientId,
						success: response.ok,
					})
				} catch (err) {
					logError({
						message: "[BroadcastQueue] Email send failed",
						error: err,
						attributes: {
							recipientId: recipient.recipientId,
							broadcastId,
						},
					})
					results.push({
						recipientId: recipient.recipientId,
						success: false,
					})
				}

				// Throttle to stay under Resend's 5 emails/s rate limit.
				// Only effective because the queue consumer is pinned to
				// maxConcurrency: 1 in alchemy.run.ts.
				await delay(SEND_DELAY_MS)
			}

			// Step 3: Update delivery statuses in bulk
			const sentIds = results
				.filter((r) => r.success)
				.map((r) => r.recipientId)
			const failedIds = results
				.filter((r) => !r.success)
				.map((r) => r.recipientId)

			if (sentIds.length > 0) {
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus: BROADCAST_EMAIL_DELIVERY_STATUS.SENT,
					})
					.where(
						inArray(
							competitionBroadcastRecipientsTable.id,
							sentIds,
						),
					)
			}

			if (failedIds.length > 0) {
				await db
					.update(competitionBroadcastRecipientsTable)
					.set({
						emailDeliveryStatus:
							BROADCAST_EMAIL_DELIVERY_STATUS.FAILED,
					})
					.where(
						inArray(
							competitionBroadcastRecipientsTable.id,
							failedIds,
						),
					)
			}

			logInfo({
				message: "[BroadcastQueue] Batch processed",
				attributes: {
					broadcastId,
					total: recipients.length,
					sent: sentIds.length,
					failed: failedIds.length,
					skipped: alreadySent.size,
					rateLimited,
				},
			})

			if (rateLimited) {
				// Don't ack — re-deliver the whole message after a delay.
				// Already-sent recipients were persisted above and will be
				// filtered out of pendingRecipients on the next attempt.
				message.retry({ delaySeconds: RATE_LIMIT_BACKOFF_SECONDS })
			} else {
				message.ack()
			}
		} catch (err) {
			logError({
				message: "[BroadcastQueue] Failed to process message",
				error: err,
				attributes: { broadcastId },
			})
			// Don't ack — let the queue retry this message
			message.retry()
		}
	}
}
