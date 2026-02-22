/**
 * Stripe Webhook Handler for TanStack Start
 *
 * Verifies Stripe signature and dispatches events:
 * - checkout.session.completed → Cloudflare Workflow (async, durable)
 *   Supports multi-division checkout (dispatches separate workflow per purchase)
 * - checkout.session.expired: Marks abandoned purchases as cancelled (inline)
 * - account.updated: Updates team's Stripe Connect status (inline)
 * - account.application.authorized: Logs OAuth connection confirmation (inline)
 * - account.application.deauthorized: Clears team Stripe connection (inline)
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { and, eq } from "drizzle-orm"
import type Stripe from "stripe"
import { getDb } from "@/db"
import {
	COMMERCE_PURCHASE_STATUS,
	commercePurchaseTable,
	teamTable,
} from "@/db/schema"
import { getStripeWebhookSecret } from "@/lib/env"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { getStripe } from "@/lib/stripe"
import { notifyPaymentExpired } from "@/server/notifications"
import type { CheckoutCompletedParams } from "@/workflows/stripe-checkout-workflow"

export const Route = createFileRoute("/api/webhooks/stripe")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// =========================================================================
				// Inline Handlers (fast operations that don't need workflows)
				// =========================================================================

				/**
				 * Handle checkout session expiration
				 * Marks abandoned purchases as cancelled
				 * Supports multi-division: cancels all purchases for the session
				 */
				async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
					const db = getDb()

					// Handle multi-division: purchaseIds is comma-separated
					const isMultiDivision = session.metadata?.multiDivision === "true"
					const purchaseIdsRaw = isMultiDivision
						? session.metadata?.purchaseIds
						: session.metadata?.purchaseId

					if (!purchaseIdsRaw) return

					const purchaseIds = purchaseIdsRaw.split(",").filter(Boolean)

					for (const purchaseId of purchaseIds) {
						await db
							.update(commercePurchaseTable)
							.set({ status: COMMERCE_PURCHASE_STATUS.CANCELLED })
							.where(
								and(
									eq(commercePurchaseTable.id, purchaseId),
									eq(
										commercePurchaseTable.status,
										COMMERCE_PURCHASE_STATUS.PENDING,
									),
								),
							)

						logInfo({
							message: "[Stripe Webhook] Checkout expired for purchase",
							attributes: { purchaseId },
						})
					}

					// Send payment expired notification for the first purchase
					const userId = session.metadata?.userId
					const competitionId = session.metadata?.competitionId
					const divisionId = session.metadata?.divisionId

					if (userId && competitionId && divisionId) {
						try {
							await notifyPaymentExpired({
								userId,
								competitionId,
								divisionId,
							})
						} catch (notifyErr) {
							logWarning({
								message:
									"[Stripe Webhook] Failed to send payment expired notification",
								error: notifyErr,
								attributes: {
									userId,
									competitionId,
									divisionId,
								},
							})
						}
					}
				}

				/**
				 * Handle account.updated webhook - update team's Stripe status
				 */
				async function handleAccountUpdated(account: Stripe.Account) {
					const db = getDb()

					const team = await db.query.teamTable.findFirst({
						where: eq(teamTable.stripeConnectedAccountId, account.id),
					})

					if (!team) {
						logInfo({
							message: "[Stripe Webhook] No team found for account",
							attributes: { accountId: account.id },
						})
						return
					}

					const status =
						account.charges_enabled && account.payouts_enabled
							? "VERIFIED"
							: "PENDING"

					const updateData: Record<string, unknown> = {
						stripeAccountStatus: status,
						updatedAt: new Date(),
					}

					// Set onboarding completed timestamp when first verified
					if (status === "VERIFIED" && !team.stripeOnboardingCompletedAt) {
						updateData.stripeOnboardingCompletedAt = new Date()
					}

					await db
						.update(teamTable)
						.set(updateData)
						.where(eq(teamTable.id, team.id))

					logInfo({
						message: "[Stripe Webhook] Updated team Stripe status",
						attributes: { teamId: team.id, status, accountId: account.id },
					})
				}

				/**
				 * Handle account.application.deauthorized webhook
				 */
				async function handleAccountDeauthorized(data: {
					id: string
					account?: string
				}) {
					const db = getDb()
					const accountId = data.account || data.id

					const team = await db.query.teamTable.findFirst({
						where: eq(teamTable.stripeConnectedAccountId, accountId),
					})

					if (!team) {
						return
					}

					// Clear Stripe connection
					await db
						.update(teamTable)
						.set({
							stripeConnectedAccountId: null,
							stripeAccountStatus: null,
							stripeAccountType: null,
							stripeOnboardingCompletedAt: null,
							updatedAt: new Date(),
						})
						.where(eq(teamTable.id, team.id))

					logWarning({
						message: "[Stripe Webhook] Team Stripe account deauthorized",
						attributes: { teamId: team.id, accountId },
					})
				}

				// =========================================================================
				// Main Webhook Processing
				// =========================================================================

				const body = await request.text()
				const signature = request.headers.get("stripe-signature")

				if (!signature) {
					logError({
						message: "[Stripe Webhook] Missing stripe-signature header",
					})
					return json({ error: "Missing signature" }, { status: 400 })
				}

				const webhookSecret = getStripeWebhookSecret()
				if (!webhookSecret) {
					logError({
						message: "[Stripe Webhook] Missing STRIPE_WEBHOOK_SECRET",
					})
					return json({ error: "Webhook not configured" }, { status: 500 })
				}

				// Step 1: Verify webhook signature
				// Use constructEventAsync for Cloudflare Workers (SubtleCrypto is async-only)
				let event: Stripe.Event
				try {
					event = await getStripe().webhooks.constructEventAsync(
						body,
						signature,
						webhookSecret,
					)
				} catch (err) {
					logError({
						message: "[Stripe Webhook] Signature verification failed",
						error: err,
					})
					return json({ error: "Invalid signature" }, { status: 401 })
				}

				// Step 2: Process verified event
				try {
					switch (event.type) {
						case "checkout.session.completed": {
							const session = event.data.object as Stripe.Checkout.Session
							const competitionId = session.metadata?.competitionId
							const userId = session.metadata?.userId
							const isMultiDivision =
								session.metadata?.multiDivision === "true"

							// Support both single and multi-division checkout
							// Multi-division: purchaseIds is comma-separated
							// Single: purchaseId is a single ID (backward compatible)
							const purchaseIdsRaw = isMultiDivision
								? session.metadata?.purchaseIds
								: session.metadata?.purchaseId

							if (!purchaseIdsRaw || !competitionId || !userId) {
								logError({
									message:
										"[Stripe Webhook] Missing required metadata in Checkout Session",
									attributes: {
										purchaseIds: purchaseIdsRaw,
										competitionId,
										userId,
										isMultiDivision,
									},
								})
								return json({ received: true })
							}

							const purchaseIds = purchaseIdsRaw
								.split(",")
								.filter(Boolean)

							// Extract payment_intent as string
							const paymentIntent =
								typeof session.payment_intent === "string"
									? session.payment_intent
									: (session.payment_intent?.id ?? null)

							// Dispatch a workflow for EACH purchase (each division independent)
							for (const purchaseId of purchaseIds) {
								// Look up division from the purchase record
								const purchase =
									await getDb().query.commercePurchaseTable.findFirst({
										where: eq(commercePurchaseTable.id, purchaseId),
									})
								const divisionId = purchase?.divisionId ?? ""

								const workflowParams: CheckoutCompletedParams = {
									stripeEventId: event.id,
									session: {
										id: session.id,
										payment_intent: paymentIntent,
										amount_total:
											purchase?.totalCents ?? session.amount_total,
										customer_email: session.customer_email,
										metadata: {
											purchaseId,
											competitionId,
											divisionId,
											userId,
										},
									},
								}

								// Use event.id + purchaseId as key for multi-division idempotency
								const workflowId =
									purchaseIds.length > 1
										? `${event.id}-${purchaseId}`
										: event.id

								if (env.STRIPE_CHECKOUT_WORKFLOW) {
									try {
										await env.STRIPE_CHECKOUT_WORKFLOW.create({
											id: workflowId,
											params: workflowParams,
										})
										logInfo({
											message:
												"[Stripe Webhook] Dispatched checkout to workflow",
											attributes: {
												eventId: event.id,
												workflowId,
												purchaseId,
												competitionId,
												divisionId,
											},
										})
									} catch (workflowErr) {
										const isConflict =
											workflowErr instanceof Error &&
											workflowErr.message.includes("already exists")
										if (isConflict) {
											logInfo({
												message:
													"[Stripe Webhook] Workflow already exists for event (idempotent)",
												attributes: { eventId: event.id, workflowId },
											})
										} else {
											logError({
												message:
													"[Stripe Webhook] Failed to dispatch workflow",
												error: workflowErr,
												attributes: {
													eventId: event.id,
													workflowId,
													purchaseId,
												},
											})
											throw workflowErr
										}
									}
								} else {
									// Local dev: process inline
									logInfo({
										message:
											"[Stripe Webhook] Workflow binding unavailable, processing inline",
										attributes: { eventId: event.id, purchaseId },
									})
									const { processCheckoutInline } = await import(
										"@/workflows/stripe-checkout-workflow"
									)
									await processCheckoutInline(workflowParams)
								}
							}
							break
						}

						case "checkout.session.expired":
							await handleCheckoutExpired(
								event.data.object as Stripe.Checkout.Session,
							)
							break

						// Stripe Connect events
						case "account.updated":
							await handleAccountUpdated(event.data.object as Stripe.Account)
							break

						case "account.application.authorized":
							// Standard OAuth connection confirmed - logged for debugging
							logInfo({
								message: "[Stripe Webhook] Account application authorized",
								attributes: {
									accountId: (event.data.object as { id: string }).id,
								},
							})
							break

						case "account.application.deauthorized":
							await handleAccountDeauthorized(
								event.data.object as {
									id: string
									account?: string
								},
							)
							break

						default:
							logInfo({
								message: "[Stripe Webhook] Unhandled event type",
								attributes: { eventType: event.type },
							})
					}

					return json({ received: true })
				} catch (err) {
					logError({
						message: "[Stripe Webhook] Processing failed",
						error: err,
						attributes: { eventType: event.type },
					})
					// Return 500 so Stripe will retry
					return json({ error: "Processing failed" }, { status: 500 })
				}
			},
		},
	},
})
