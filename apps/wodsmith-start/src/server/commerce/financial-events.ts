/**
 * Financial Event Log — server-side helpers
 *
 * All functions in this module INSERT into the append-only financial_events table.
 * They are designed to be called from checkout workflows and webhook handlers.
 */

import { createServerOnlyFn } from "@tanstack/react-start"
import { getDb } from "@/db"
import {
	FINANCIAL_EVENT_TYPE,
	financialEventTable,
	type FinancialEventType,
} from "@/db/schema"
import { logInfo } from "@/lib/logging/posthog-otel-logger"

interface RecordFinancialEventParams {
	purchaseId: string
	teamId: string
	eventType: FinancialEventType
	amountCents: number
	currency?: string
	stripePaymentIntentId?: string
	stripeRefundId?: string
	stripeDisputeId?: string
	reason?: string
	metadata?: Record<string, unknown>
	actorId?: string
	stripeEventTimestamp?: Date
}

/**
 * Record a single financial event (append-only INSERT).
 */
export const recordFinancialEvent = createServerOnlyFn(
	async (params: RecordFinancialEventParams): Promise<string> => {
		const db = getDb()

		const [result] = await db.insert(financialEventTable).values({
			purchaseId: params.purchaseId,
			teamId: params.teamId,
			eventType: params.eventType,
			amountCents: params.amountCents,
			currency: params.currency ?? "usd",
			stripePaymentIntentId: params.stripePaymentIntentId,
			stripeRefundId: params.stripeRefundId,
			stripeDisputeId: params.stripeDisputeId,
			reason: params.reason,
			metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
			actorId: params.actorId,
			stripeEventTimestamp: params.stripeEventTimestamp,
		})

		logInfo({
			message: `[FinancialEvent] Recorded ${params.eventType}`,
			attributes: {
				purchaseId: params.purchaseId,
				teamId: params.teamId,
				eventType: params.eventType,
				amountCents: params.amountCents,
			},
		})

		return result.insertId.toString()
	},
)

/**
 * Record a PAYMENT_COMPLETED event with fee breakdown in metadata.
 */
export const recordPaymentCompleted = createServerOnlyFn(
	async (params: {
		purchaseId: string
		teamId: string
		totalCents: number
		platformFeeCents: number
		stripeFeeCents: number
		organizerNetCents: number
		stripePaymentIntentId?: string
	}): Promise<void> => {
		await recordFinancialEvent({
			purchaseId: params.purchaseId,
			teamId: params.teamId,
			eventType: FINANCIAL_EVENT_TYPE.PAYMENT_COMPLETED,
			amountCents: params.totalCents,
			stripePaymentIntentId: params.stripePaymentIntentId,
			reason: "Checkout completed",
			metadata: {
				platformFeeCents: params.platformFeeCents,
				stripeFeeCents: params.stripeFeeCents,
				organizerNetCents: params.organizerNetCents,
			},
		})
	},
)

/**
 * Record a REFUND_COMPLETED event (negative amount).
 */
export const recordRefundCompleted = createServerOnlyFn(
	async (params: {
		purchaseId: string
		teamId: string
		amountCents: number
		stripePaymentIntentId?: string
		stripeRefundId?: string
		reason: string
	}): Promise<void> => {
		await recordFinancialEvent({
			purchaseId: params.purchaseId,
			teamId: params.teamId,
			eventType: FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
			amountCents: -Math.abs(params.amountCents), // always negative
			stripePaymentIntentId: params.stripePaymentIntentId,
			stripeRefundId: params.stripeRefundId,
			reason: params.reason,
		})
	},
)

/**
 * Record a dispute event (OPENED, WON, or LOST).
 */
export const recordDisputeEvent = createServerOnlyFn(
	async (params: {
		purchaseId: string
		teamId: string
		eventType:
			| typeof FINANCIAL_EVENT_TYPE.DISPUTE_OPENED
			| typeof FINANCIAL_EVENT_TYPE.DISPUTE_WON
			| typeof FINANCIAL_EVENT_TYPE.DISPUTE_LOST
		amountCents: number
		stripePaymentIntentId?: string
		stripeDisputeId: string
		reason: string
	}): Promise<void> => {
		await recordFinancialEvent({
			purchaseId: params.purchaseId,
			teamId: params.teamId,
			eventType: params.eventType,
			amountCents: params.amountCents,
			stripePaymentIntentId: params.stripePaymentIntentId,
			stripeDisputeId: params.stripeDisputeId,
			reason: params.reason,
		})
	},
)
