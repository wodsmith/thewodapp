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
import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	BROADCAST_EMAIL_DELIVERY_STATUS,
	competitionBroadcastRecipientsTable,
} from "@/db/schemas/broadcasts"
import { getResendApiKey, getEmailFrom, getEmailFromName } from "@/lib/env"
import { logError, logInfo } from "@/lib/logging"

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
	batch: MessageBatch<BroadcastEmailMessage>,
): Promise<void> {
	const db = getDb()
	const resendApiKey = getResendApiKey()

	if (!resendApiKey) {
		logError({
			message: "[BroadcastQueue] RESEND_API_KEY not configured, failing batch",
			attributes: { messageCount: batch.messages.length },
		})
		// Throw to trigger retry — the key might be configured on next attempt
		throw new Error("RESEND_API_KEY not configured")
	}

	const emailFrom = getEmailFrom()
	const emailFromName = getEmailFromName()

	for (const message of batch.messages) {
		const { broadcastId, batch: recipients, subject, bodyHtml, replyTo } =
			message.body

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
				},
			})

			message.ack()
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
