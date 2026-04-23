// @lat: [[organizer-dashboard#Broadcasts]]
/**
 * Cloudflare Queue consumer for organizer-sent email delivery.
 *
 * Handles both broadcast messages (to registered athletes) and competition
 * invite emails (to not-yet-registered invitees). The shared queue binding
 * `BROADCAST_EMAIL_QUEUE` carries both shapes; the consumer dispatches on
 * the `kind` discriminator.
 *
 * @see docs/adr/0008-organizer-broadcast-messaging.md
 * @see docs/adr/0011-competition-invites.md
 */

import type { MessageBatch } from "@cloudflare/workers-types"
import { eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import {
	BROADCAST_EMAIL_DELIVERY_STATUS,
	competitionBroadcastRecipientsTable,
} from "@/db/schemas/broadcasts"
import {
	COMPETITION_INVITE_EMAIL_DELIVERY_STATUS,
	competitionInvitesTable,
} from "@/db/schemas/competition-invites"
import { getResendApiKey, getEmailFrom, getEmailFromName } from "@/lib/env"
import { logError, logInfo } from "@/lib/logging"

/** Delay between individual email sends to stay under Resend rate limits (5 emails/s). */
const SEND_DELAY_MS = 200

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Shape of each queue message — matches what sendBroadcastFn enqueues.
 * Kept with an implicit `kind` for backwards compatibility so in-flight
 * broadcast messages without the discriminator still route to the
 * broadcast handler.
 */
export interface BroadcastEmailMessage {
	kind?: "broadcast"
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
 * Competition invite message shape (ADR-0011 Phase 2). Each message
 * corresponds to one invite row; the rendered HTML is per-recipient
 * because claim URLs are unique per token. `sendAttempt` is part of the
 * Idempotency-Key so re-sends of the same invite row (after an extend /
 * re-issue) actually dispatch rather than being deduplicated by Resend.
 */
export interface InviteEmailMessage {
	kind: "competition-invite"
	inviteId: string
	sendAttempt: number
	competitionId: string
	email: string
	subject: string
	bodyHtml: string
	replyTo?: string
}

export type QueueEmailMessage = BroadcastEmailMessage | InviteEmailMessage

/**
 * Queue consumer handler — called by the Workers runtime when messages arrive.
 *
 * Dispatches on the `kind` discriminator: broadcast messages (the original
 * shape, `kind` undefined or `"broadcast"`) and competition invite messages
 * (`kind: "competition-invite"`).
 */
export async function handleBroadcastEmailQueue(
	batch: MessageBatch,
): Promise<void> {
	const db = getDb()
	const resendApiKey = getResendApiKey()
	const emailFrom = getEmailFrom()
	const emailFromName = getEmailFromName()

	for (const message of batch.messages) {
		const body = message.body as QueueEmailMessage

		if (body.kind === "competition-invite") {
			await handleInviteMessage({
				message,
				body,
				db,
				resendApiKey,
				emailFrom,
				emailFromName,
			})
			continue
		}

		await handleBroadcastMessage({
			message,
			body,
			db,
			resendApiKey,
			emailFrom,
			emailFromName,
		})
	}
}

async function handleBroadcastMessage(params: {
	message: MessageBatch["messages"][number]
	body: BroadcastEmailMessage
	db: ReturnType<typeof getDb>
	resendApiKey: string | undefined
	emailFrom: string
	emailFromName: string
}): Promise<void> {
	const { message, body, db, resendApiKey, emailFrom, emailFromName } = params

	if (!resendApiKey) {
		// Dev mode: log emails and mark as sent instead of failing
		logInfo({
			message: "[BroadcastQueue] No RESEND_API_KEY — logging emails (dev mode)",
			attributes: { messageCount: 1 },
		})
		const { broadcastId, batch: msgRecipients, subject } = body
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
		return
	}

	{
		const { broadcastId, batch: recipients, subject, bodyHtml, replyTo } = body

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
				return
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

					// Throttle to stay under Resend's 5 emails/s rate limit
					await delay(SEND_DELAY_MS)
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

/**
 * Competition invite email handler. One message per invite; the HTML is
 * pre-rendered per recipient by `issueInvitesFn` because each invite
 * carries a unique claim URL.
 *
 * Idempotency-Key uses `invite-<inviteId>-<sendAttempt>` so re-sends of
 * the same invite after an extend/re-issue actually dispatch (the
 * `sendAttempt` suffix rotates on each re-issue, per ADR-0011 Token model).
 *
 * On success the invite's `emailDeliveryStatus` is flipped to `sent`; on
 * failure it's `failed` with the error captured. The message is acked
 * either way — organizers will see the failure on the roster and can
 * choose to re-send. Retrying would risk duplicate sends if a transient
 * Resend 5xx happens after the email was actually dispatched.
 */
async function handleInviteMessage(params: {
	message: MessageBatch["messages"][number]
	body: InviteEmailMessage
	db: ReturnType<typeof getDb>
	resendApiKey: string | undefined
	emailFrom: string
	emailFromName: string
}): Promise<void> {
	const { message, body, db, resendApiKey, emailFrom, emailFromName } = params

	if (!resendApiKey) {
		logInfo({
			message: "[InviteQueue] No RESEND_API_KEY — logging (dev mode)",
			attributes: {
				inviteId: body.inviteId,
				email: body.email,
				subject: body.subject,
			},
		})
		console.log(
			`[Email Preview] To: ${body.email} | Subject: ${body.subject} | Invite: ${body.inviteId}`,
		)
		await db
			.update(competitionInvitesTable)
			.set({
				emailDeliveryStatus:
					COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SKIPPED,
			})
			.where(eq(competitionInvitesTable.id, body.inviteId))
		message.ack()
		return
	}

	logInfo({
		message: "[InviteQueue] Processing invite message",
		attributes: {
			inviteId: body.inviteId,
			sendAttempt: body.sendAttempt,
		},
	})

	try {
		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${resendApiKey}`,
				"Content-Type": "application/json",
				"Idempotency-Key": `invite-${body.inviteId}-${body.sendAttempt}`,
			},
			body: JSON.stringify({
				from: `${emailFromName} <${emailFrom}>`,
				to: [body.email],
				subject: body.subject,
				html: body.bodyHtml,
				reply_to: body.replyTo ?? "support@mail.wodsmith.com",
				tags: [{ name: "type", value: "competition-invite" }],
			}),
		})

		if (!response.ok) {
			const errorBody = await response.text().catch(() => "unknown")
			logError({
				message: "[InviteQueue] Resend API error",
				attributes: {
					inviteId: body.inviteId,
					status: response.status,
					error: errorBody,
				},
			})
			await db
				.update(competitionInvitesTable)
				.set({
					emailDeliveryStatus:
						COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.FAILED,
					emailLastError: `Resend ${response.status}: ${errorBody.slice(0, 500)}`,
				})
				.where(eq(competitionInvitesTable.id, body.inviteId))
		} else {
			await db
				.update(competitionInvitesTable)
				.set({
					emailDeliveryStatus:
						COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.SENT,
					emailLastError: null,
				})
				.where(eq(competitionInvitesTable.id, body.inviteId))
		}

		await delay(SEND_DELAY_MS)
		message.ack()
	} catch (err) {
		logError({
			message: "[InviteQueue] Email send failed",
			error: err,
			attributes: { inviteId: body.inviteId },
		})
		await db
			.update(competitionInvitesTable)
			.set({
				emailDeliveryStatus:
					COMPETITION_INVITE_EMAIL_DELIVERY_STATUS.FAILED,
				emailLastError: err instanceof Error ? err.message : String(err),
			})
			.where(eq(competitionInvitesTable.id, body.inviteId))
		message.ack()
	}
}
