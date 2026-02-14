/**
 * Stripe Webhook Handler for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 *
 * Handles:
 * - checkout.session.completed: Completes purchase and creates registration
 * - checkout.session.expired: Marks abandoned purchases as cancelled
 * - account.updated: Updates team's Stripe Connect status
 * - account.application.authorized: Logs OAuth connection confirmation
 * - account.application.deauthorized: Clears team Stripe connection
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import type Stripe from "stripe"
import { getDb } from "@/db"
import {
	COMMERCE_PAYMENT_STATUS,
	COMMERCE_PURCHASE_STATUS,
	commercePurchaseTable,
	competitionDivisionsTable,
	competitionRegistrationAnswersTable,
	competitionRegistrationsTable,
	competitionsTable,
	teamTable,
	userTable,
} from "@/db/schema"
import { getStripeWebhookSecret } from "@/lib/env"
import {
	logError,
	logInfo,
	logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { notifyCompetitionRegistration } from "@/lib/slack"
import { getStripe } from "@/lib/stripe"
import { notifyPaymentExpired } from "@/server/notifications"
import {
	notifyRegistrationConfirmed,
	registerForCompetition,
} from "@/server/registration"
import { getDivisionSpotsAvailableFn } from "@/server-fns/competition-divisions-fns"

export const Route = createFileRoute("/api/webhooks/stripe")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				// =========================================================================
				// Handler Functions (defined before use)
				// =========================================================================

				/**
				 * Handle successful checkout completion
				 * Creates the competition registration after payment succeeds
				 */
				async function handleCheckoutCompleted(
					session: Stripe.Checkout.Session,
				) {
					const db = getDb()
					const purchaseId = session.metadata?.purchaseId
					const competitionId = session.metadata?.competitionId
					const divisionId = session.metadata?.divisionId
					const userId = session.metadata?.userId

					if (!purchaseId || !competitionId || !divisionId || !userId) {
						logError({
							message:
								"[Stripe Webhook] Missing required metadata in Checkout Session",
							attributes: { purchaseId, competitionId, divisionId, userId },
						})
						return
					}

					// IDEMPOTENCY CHECK 1: Get purchase and check status
					const existingPurchase =
						await db.query.commercePurchaseTable.findFirst({
							where: eq(commercePurchaseTable.id, purchaseId),
						})

					if (!existingPurchase) {
						logError({
							message: "[Stripe Webhook] Purchase not found",
							attributes: { purchaseId },
						})
						return
					}

					if (existingPurchase.status === COMMERCE_PURCHASE_STATUS.COMPLETED) {
						logInfo({
							message:
								"[Stripe Webhook] Purchase already completed, skipping registration",
							attributes: { purchaseId },
						})
						return
					}

					// IDEMPOTENCY CHECK 2: Check if registration already exists
					const existingRegistration =
						await db.query.competitionRegistrationsTable.findFirst({
							where: eq(
								competitionRegistrationsTable.commercePurchaseId,
								purchaseId,
							),
						})

					if (existingRegistration) {
						logInfo({
							message:
								"[Stripe Webhook] Registration already exists for purchase, skipping",
							attributes: {
								purchaseId,
								registrationId: existingRegistration.id,
							},
						})
						// Ensure purchase is marked as completed
						await db
							.update(commercePurchaseTable)
							.set({
								status: COMMERCE_PURCHASE_STATUS.COMPLETED,
								completedAt: new Date(),
							})
							.where(eq(commercePurchaseTable.id, purchaseId))
						return
					}

					// Parse stored registration data from purchase metadata
					let registrationData: {
						teamName?: string
						affiliateName?: string
						teammates?: Array<{
							email: string
							firstName?: string
							lastName?: string
							affiliateName?: string
						}>
						answers?: Array<{
							questionId: string
							answer: string
						}>
					} = {}

					if (existingPurchase.metadata) {
						try {
							registrationData = JSON.parse(existingPurchase.metadata)
						} catch {
							logWarning({
								message: "[Stripe Webhook] Failed to parse purchase metadata",
								attributes: { purchaseId },
							})
						}
					}

					// Re-check capacity before registration (race condition protection)
					// Exclude our own pending purchase to avoid self-blocking
					const capacityCheck = await getDivisionSpotsAvailableFn({
						data: { competitionId, divisionId, excludePurchaseId: purchaseId },
					})
					if (capacityCheck.isFull) {
						// Division filled during payment - need to handle refund
						logError({
							message:
								"[Stripe Webhook] Division filled during payment - refund needed",
							attributes: {
								purchaseId,
								competitionId,
								divisionId,
								userId,
								maxSpots: capacityCheck.maxSpots,
								registered: capacityCheck.registered,
							},
						})
						// Mark purchase as failed
						await db
							.update(commercePurchaseTable)
							.set({
								status: COMMERCE_PURCHASE_STATUS.FAILED,
								completedAt: new Date(),
							})
							.where(eq(commercePurchaseTable.id, purchaseId))

						// Trigger automatic refund via Stripe API
						const paymentIntentId =
							typeof session.payment_intent === "string"
								? session.payment_intent
								: session.payment_intent?.id

						if (paymentIntentId) {
							try {
								const stripe = getStripe()
								await stripe.refunds.create({
									payment_intent: paymentIntentId,
									reason: "requested_by_customer",
								})
								logInfo({
									message:
										"[Stripe Webhook] Refund issued for division-full scenario",
									attributes: { purchaseId, paymentIntentId },
								})
							} catch (refundError) {
								logError({
									message: "[Stripe Webhook] Failed to issue automatic refund",
									error:
										refundError instanceof Error
											? refundError
											: new Error(String(refundError)),
									attributes: { purchaseId, paymentIntentId },
								})
							}
						}

						// TODO: Send "division full" notification email to user
						return
					}

					try {
						const result = await registerForCompetition({
							competitionId,
							userId,
							divisionId,
							teamName: registrationData.teamName,
							affiliateName: registrationData.affiliateName,
							teammates: registrationData.teammates,
						})

						// Update registration with payment info
						await db
							.update(competitionRegistrationsTable)
							.set({
								commercePurchaseId: purchaseId,
								paymentStatus: COMMERCE_PAYMENT_STATUS.PAID,
								paidAt: new Date(),
							})
							.where(
								eq(competitionRegistrationsTable.id, result.registrationId),
							)

						// Store registration answers if present
						if (
							registrationData.answers &&
							registrationData.answers.length > 0
						) {
							for (const answer of registrationData.answers) {
								await db.insert(competitionRegistrationAnswersTable).values({
									questionId: answer.questionId,
									registrationId: result.registrationId,
									userId,
									answer: answer.answer,
								})
							}
						}

						// Mark purchase as completed
						await db
							.update(commercePurchaseTable)
							.set({
								status: COMMERCE_PURCHASE_STATUS.COMPLETED,
								stripePaymentIntentId:
									typeof session.payment_intent === "string"
										? session.payment_intent
										: session.payment_intent?.id,
								completedAt: new Date(),
							})
							.where(eq(commercePurchaseTable.id, purchaseId))

						logInfo({
							message: "[Stripe Webhook] Registration created",
							attributes: {
								registrationId: result.registrationId,
								purchaseId,
								competitionId,
								userId,
							},
						})

						// Send registration confirmation email (paid path)
						try {
							await notifyRegistrationConfirmed({
								userId,
								registrationId: result.registrationId,
								competitionId,
								isPaid: true,
								amountPaidCents: session.amount_total ?? undefined,
							})
						} catch (emailErr) {
							logError({
								message: "[Stripe Webhook] Failed to send confirmation email",
								error: emailErr,
								attributes: {
									purchaseId,
									competitionId,
									userId,
									registrationId: result.registrationId,
								},
							})
							// Don't rethrow - registration and payment succeeded
						}

						// Send Slack notification for the purchase (non-blocking)
						try {
							// Fetch competition and division details for the notification
							const [competition, divisionConfig, user] = await Promise.all([
								db.query.competitionsTable.findFirst({
									where: eq(competitionsTable.id, competitionId),
								}),
								db.query.competitionDivisionsTable.findFirst({
									where: and(
										eq(competitionDivisionsTable.competitionId, competitionId),
										eq(competitionDivisionsTable.divisionId, divisionId),
									),
									with: {
										division: true,
									},
								}),
								db.query.userTable.findFirst({
									where: eq(userTable.id, userId),
								}),
							])

							await notifyCompetitionRegistration({
								amountCents: session.amount_total ?? 0,
								customerEmail:
									session.customer_email ?? user?.email ?? undefined,
								customerName: user
									? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
										undefined
									: undefined,
								competitionName: competition?.name ?? "Unknown Competition",
								divisionName: divisionConfig?.division?.label,
								teamName: registrationData.teamName,
								purchaseId,
							})
						} catch (slackErr) {
							logWarning({
								message: "[Stripe Webhook] Failed to send Slack notification",
								error: slackErr,
								attributes: {
									purchaseId,
									competitionId,
									userId,
								},
							})
							// Don't rethrow - registration and payment succeeded
						}
					} catch (err) {
						logError({
							message: "[Stripe Webhook] Failed to create registration",
							error: err,
							attributes: { purchaseId, competitionId, userId },
						})
						await db
							.update(commercePurchaseTable)
							.set({ status: COMMERCE_PURCHASE_STATUS.FAILED })
							.where(eq(commercePurchaseTable.id, purchaseId))
						// Re-throw to trigger Stripe retry
						throw err
					}
				}

				/**
				 * Handle checkout session expiration
				 * Marks abandoned purchases as cancelled
				 */
				async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
					const db = getDb()
					const purchaseId = session.metadata?.purchaseId

					if (!purchaseId) return

					// Mark purchase as expired/cancelled (only if still pending)
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

					// Send payment expired notification if we have required metadata
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
								attributes: { purchaseId, userId, competitionId, divisionId },
							})
							// Don't rethrow - purchase was already marked as cancelled
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
						case "checkout.session.completed":
							await handleCheckoutCompleted(
								event.data.object as Stripe.Checkout.Session,
							)
							break

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
								event.data.object as { id: string; account?: string },
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
