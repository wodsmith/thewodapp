#!/usr/bin/env bun
/**
 * Backfill Financial Event Log from Stripe
 *
 * One-time script that populates the financial_events table with historical
 * data for all COMPLETED purchases from January 1, 2026 onward.
 *
 * For each purchase:
 *   - Creates a PAYMENT_COMPLETED event with fee breakdown
 *   - Checks Stripe PaymentIntent for refunds → REFUND_COMPLETED events
 *   - Checks Stripe PaymentIntent for disputes → DISPUTE_* events
 *
 * Usage:
 *   bun run scripts/backfill-financial-events.ts                  # dry run (default)
 *   bun run scripts/backfill-financial-events.ts --commit         # actually write to DB
 *
 * Environment:
 *   DATABASE_URL          — PlanetScale connection string
 *   STRIPE_SECRET_KEY     — Stripe API key
 */

import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import Stripe from "stripe"
import { and, eq, gte } from "drizzle-orm"
import * as schema from "../src/db/schema"
import {
	commercePurchaseTable,
	competitionsTable,
	financialEventTable,
	FINANCIAL_EVENT_TYPE,
} from "../src/db/schema"
import { createFinancialEventId } from "../src/db/schemas/financial-events"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DRY_RUN = !process.argv.includes("--commit")
const CUTOFF = new Date("2026-01-01T00:00:00Z")
const STRIPE_DELAY_MS = 50 // ~20 req/s to stay well under Stripe's 100/s limit
const LOG_EVERY = 50

if (DRY_RUN) {
	console.log("🔍 DRY RUN — no database writes will occur. Pass --commit to write.\n")
} else {
	console.log("✏️  COMMIT MODE — events will be written to the database.\n")
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
	console.error("ERROR: Set DATABASE_URL in environment")
	process.exit(1)
}

const connection = await mysql.createConnection({
	uri: DATABASE_URL,
})
const db = drizzle({ client: connection, schema, mode: "planetscale" })

// ---------------------------------------------------------------------------
// Stripe
// ---------------------------------------------------------------------------

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
	console.error("ERROR: Set STRIPE_SECRET_KEY in environment")
	process.exit(1)
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type EventInsert = typeof financialEventTable.$inferInsert

const stats = {
	purchasesTotal: 0,
	purchasesSkippedNoPI: 0,
	purchasesSkippedExisting: 0,
	purchasesProcessed: 0,
	eventsPayment: 0,
	eventsRefund: 0,
	eventsDispute: 0,
	eventsTotal: 0,
	warnings: 0,
}

// 1. Load all COMPLETED purchases from cutoff date onward
console.log(`Fetching COMPLETED purchases since ${CUTOFF.toISOString()}...`)

const purchases = await db
	.select()
	.from(commercePurchaseTable)
	.where(
		and(
			eq(commercePurchaseTable.status, "COMPLETED"),
			gte(commercePurchaseTable.completedAt, CUTOFF),
		),
	)

stats.purchasesTotal = purchases.length
console.log(`Found ${purchases.length} COMPLETED purchases.\n`)

// 2. Build a cache of competition → organizingTeamId
const competitionTeamCache = new Map<string, string>()

async function getTeamId(competitionId: string): Promise<string | null> {
	if (competitionTeamCache.has(competitionId)) {
		return competitionTeamCache.get(competitionId)!
	}
	const comp = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
		columns: { organizingTeamId: true },
	})
	if (comp) {
		competitionTeamCache.set(competitionId, comp.organizingTeamId)
		return comp.organizingTeamId
	}
	return null
}

// 3. Process each purchase
for (let i = 0; i < purchases.length; i++) {
	const purchase = purchases[i]

	if ((i + 1) % LOG_EVERY === 0 || i === 0) {
		console.log(`Processing ${i + 1}/${purchases.length}...`)
	}

	// Skip purchases without a Stripe PaymentIntent
	if (!purchase.stripePaymentIntentId) {
		stats.purchasesSkippedNoPI++
		continue
	}

	// Skip if events already exist for this purchase (idempotency)
	const existing = await db
		.select({ id: financialEventTable.id })
		.from(financialEventTable)
		.where(eq(financialEventTable.purchaseId, purchase.id))
		.limit(1)

	if (existing.length > 0) {
		stats.purchasesSkippedExisting++
		continue
	}

	// Resolve teamId from competition
	const teamId = purchase.competitionId
		? await getTeamId(purchase.competitionId)
		: null

	if (!teamId) {
		console.warn(
			`  ⚠️  No teamId for purchase ${purchase.id} (competition: ${purchase.competitionId}) — skipping`,
		)
		stats.warnings++
		continue
	}

	// Fetch PaymentIntent from Stripe with expanded refunds and disputes
	let pi: Stripe.PaymentIntent
	try {
		pi = await stripe.paymentIntents.retrieve(
			purchase.stripePaymentIntentId,
			{ expand: ["charges.data.refunds"] },
		)
	} catch (err) {
		console.warn(
			`  ⚠️  Failed to fetch PI ${purchase.stripePaymentIntentId}: ${err}`,
		)
		stats.warnings++
		continue
	}

	// Throttle Stripe requests
	await new Promise((r) => setTimeout(r, STRIPE_DELAY_MS))

	const events: EventInsert[] = []

	// --- PAYMENT_COMPLETED ---
	events.push({
		id: createFinancialEventId(),
		purchaseId: purchase.id,
		teamId,
		eventType: FINANCIAL_EVENT_TYPE.PAYMENT_COMPLETED,
		amountCents: purchase.totalCents,
		currency: "usd",
		stripePaymentIntentId: purchase.stripePaymentIntentId,
		reason: "Backfill: checkout completed",
		metadata: JSON.stringify({
			platformFeeCents: purchase.platformFeeCents,
			stripeFeeCents: purchase.stripeFeeCents,
			organizerNetCents: purchase.organizerNetCents,
			backfilled: true,
		}),
		createdAt: purchase.completedAt ?? new Date(),
		stripeEventTimestamp: purchase.completedAt,
	})
	stats.eventsPayment++

	// --- REFUNDS ---
	const charges = (pi as any).charges?.data as Stripe.Charge[] | undefined
	if (charges) {
		for (const charge of charges) {
			if (charge.refunds?.data) {
				for (const refund of charge.refunds.data) {
					if (refund.status !== "succeeded") continue
					events.push({
						id: createFinancialEventId(),
						purchaseId: purchase.id,
						teamId,
						eventType: FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
						amountCents: -refund.amount,
						currency: "usd",
						stripePaymentIntentId: purchase.stripePaymentIntentId,
						stripeRefundId: refund.id,
						reason: `Backfill: ${refund.reason || "refund via Stripe"}`,
						metadata: JSON.stringify({ backfilled: true }),
						createdAt: new Date(refund.created * 1000),
						stripeEventTimestamp: new Date(refund.created * 1000),
					})
					stats.eventsRefund++

					// Flag local status mismatch
					if (purchase.status === "COMPLETED") {
						console.warn(
							`  ⚠️  Purchase ${purchase.id} is COMPLETED locally but has refund ${refund.id} in Stripe — needs manual review`,
						)
						stats.warnings++
					}
				}
			}

			// --- DISPUTES ---
			if (charge.disputed && charge.id) {
				// charge.disputed is a boolean — need to fetch dispute objects via API
				try {
					const disputes = await stripe.disputes.list({
						charge: charge.id,
						limit: 10,
					})
					await new Promise((r) => setTimeout(r, STRIPE_DELAY_MS))

					for (const dispute of disputes.data) {
						events.push({
							id: createFinancialEventId(),
							purchaseId: purchase.id,
							teamId,
							eventType: FINANCIAL_EVENT_TYPE.DISPUTE_OPENED,
							amountCents: -dispute.amount,
							currency: "usd",
							stripePaymentIntentId: purchase.stripePaymentIntentId,
							stripeDisputeId: dispute.id,
							reason: `Backfill: dispute ${dispute.reason ?? "unknown"}`,
							metadata: JSON.stringify({ backfilled: true }),
							createdAt: new Date(dispute.created * 1000),
							stripeEventTimestamp: new Date(dispute.created * 1000),
						})
						stats.eventsDispute++

						if (dispute.status === "won") {
							events.push({
								id: createFinancialEventId(),
								purchaseId: purchase.id,
								teamId,
								eventType: FINANCIAL_EVENT_TYPE.DISPUTE_WON,
								amountCents: dispute.amount,
								currency: "usd",
								stripePaymentIntentId: purchase.stripePaymentIntentId,
								stripeDisputeId: dispute.id,
								reason: "Backfill: dispute resolved in our favor",
								metadata: JSON.stringify({ backfilled: true }),
								createdAt: new Date(dispute.created * 1000),
								stripeEventTimestamp: new Date(dispute.created * 1000),
							})
							stats.eventsDispute++
						} else if (dispute.status === "lost") {
							events.push({
								id: createFinancialEventId(),
								purchaseId: purchase.id,
								teamId,
								eventType: FINANCIAL_EVENT_TYPE.DISPUTE_LOST,
								amountCents: 0,
								currency: "usd",
								stripePaymentIntentId: purchase.stripePaymentIntentId,
								stripeDisputeId: dispute.id,
								reason: "Backfill: dispute resolved in customer's favor",
								metadata: JSON.stringify({ backfilled: true }),
								createdAt: new Date(dispute.created * 1000),
								stripeEventTimestamp: new Date(dispute.created * 1000),
							})
							stats.eventsDispute++
						}
					}
				} catch (disputeErr) {
					console.warn(
						`  ⚠️  Failed to fetch disputes for charge ${charge.id}: ${disputeErr}`,
					)
					stats.warnings++
				}
			}
		}
	}

	// Insert events
	if (!DRY_RUN && events.length > 0) {
		await db.insert(financialEventTable).values(events)
	}

	stats.eventsTotal += events.length
	stats.purchasesProcessed++
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log("\n" + "=".repeat(60))
console.log(DRY_RUN ? "DRY RUN SUMMARY" : "BACKFILL COMPLETE")
console.log("=".repeat(60))
console.log(`Purchases found:          ${stats.purchasesTotal}`)
console.log(`  Skipped (no PI):         ${stats.purchasesSkippedNoPI}`)
console.log(`  Skipped (existing):      ${stats.purchasesSkippedExisting}`)
console.log(`  Processed:               ${stats.purchasesProcessed}`)
console.log(`Events ${DRY_RUN ? "would create" : "created"}:`)
console.log(`  PAYMENT_COMPLETED:       ${stats.eventsPayment}`)
console.log(`  REFUND_COMPLETED:        ${stats.eventsRefund}`)
console.log(`  DISPUTE_*:               ${stats.eventsDispute}`)
console.log(`  Total:                   ${stats.eventsTotal}`)
console.log(`Warnings:                  ${stats.warnings}`)
console.log("=".repeat(60))

await connection.end()
process.exit(0)
