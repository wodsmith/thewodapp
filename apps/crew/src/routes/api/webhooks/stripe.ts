// @lat: [[crew#Crew Stripe Webhooks]]
import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { env } from "cloudflare:workers"
import { and, eq } from "drizzle-orm"
import type Stripe from "stripe"
import { getDb } from "@/db"
import {
  COMMERCE_PURCHASE_STATUS,
  FINANCIAL_EVENT_TYPE,
  commercePurchaseTable,
  competitionsTable,
  financialEventTable,
  teamTable,
} from "@/db/schema"
import { getStripeWebhookSecret } from "@/lib/env"
import {
  logError,
  logInfo,
  logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { getStripe } from "@/lib/stripe"
import {
  CrewCheckoutWebhookValidationError,
  isCrewCheckoutSessionMetadata,
  parseCrewCheckoutSessionWebhook,
} from "@/lib/crew/checkout-webhooks"
import { recordRefundCompleted } from "@/server/commerce/financial-events"
import { completeCrewCheckoutSessionFromWebhook } from "@/server/crew-billing.server"
import { notifyPaymentExpired } from "@/server/notifications"
import type { CheckoutCompletedParams } from "@/workflows/stripe-checkout-workflow"

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
          const db = getDb()
          const purchaseIdsRaw =
            session.metadata?.purchaseIds ?? session.metadata?.purchaseId

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

          const userId = session.metadata?.userId
          const competitionId = session.metadata?.competitionId

          if (userId && competitionId) {
            for (const purchaseId of purchaseIds) {
              const purchase = await db.query.commercePurchaseTable.findFirst({
                where: eq(commercePurchaseTable.id, purchaseId),
                columns: { divisionId: true },
              })
              const divisionId =
                purchase?.divisionId ?? session.metadata?.divisionId

              if (!divisionId) continue

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
                    purchaseId,
                  },
                })
              }
            }
          }
        }

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

        async function handleAccountDeauthorized(data: {
          id: string
          account?: string
        }) {
          const db = getDb()
          const accountId = data.account || data.id

          const team = await db.query.teamTable.findFirst({
            where: eq(teamTable.stripeConnectedAccountId, accountId),
          })

          if (!team) return

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

        async function findPurchaseByPaymentIntent(paymentIntentId: string) {
          const db = getDb()
          const purchase = await db.query.commercePurchaseTable.findFirst({
            where: eq(
              commercePurchaseTable.stripePaymentIntentId,
              paymentIntentId,
            ),
          })
          if (!purchase || !purchase.competitionId) return null

          const competition = await db.query.competitionsTable.findFirst({
            where: eq(competitionsTable.id, purchase.competitionId),
            columns: { organizingTeamId: true },
          })
          if (!competition) return null

          return { purchase, teamId: competition.organizingTeamId }
        }

        async function handleChargeRefunded(charge: Stripe.Charge) {
          const paymentIntentId = getPaymentIntentId(charge.payment_intent)
          if (!paymentIntentId) return

          const result = await findPurchaseByPaymentIntent(paymentIntentId)
          if (!result) return

          const db = getDb()

          for (const refund of charge.refunds?.data ?? []) {
            if (refund.status !== "succeeded") continue

            const existing = await db.query.financialEventTable.findFirst({
              where: and(
                eq(financialEventTable.stripeRefundId, refund.id),
                eq(
                  financialEventTable.eventType,
                  FINANCIAL_EVENT_TYPE.REFUND_COMPLETED,
                ),
              ),
              columns: { id: true },
            })
            if (existing) continue

            await recordRefundCompleted({
              purchaseId: result.purchase.id,
              teamId: result.teamId,
              amountCents: refund.amount,
              stripePaymentIntentId: paymentIntentId,
              stripeRefundId: refund.id,
              reason: `Refund via Stripe: ${refund.reason ?? "no reason provided"}`,
            })

            logInfo({
              message:
                "[Stripe Webhook] Recorded REFUND_COMPLETED from charge.refunded",
              attributes: {
                purchaseId: result.purchase.id,
                refundId: refund.id,
                amount: refund.amount,
              },
            })
          }
        }

        async function handleCrewCheckoutCompleted(
          stripeEventId: string,
          session: Stripe.Checkout.Session,
        ) {
          try {
            const completion = parseCrewCheckoutSessionWebhook({
              stripeEventId,
              sessionId: session.id,
              metadata: session.metadata,
              amountTotal: session.amount_total,
              currency: session.currency,
              paymentIntentId: getPaymentIntentId(session.payment_intent),
            })
            const result =
              await completeCrewCheckoutSessionFromWebhook(completion)

            logInfo({
              message: "[Stripe Webhook] Processed Crew Checkout completion",
              attributes: {
                stripeEventId,
                sessionId: session.id,
                eventId: completion.eventId,
                teamId: completion.teamId,
                status: result.status,
              },
            })
          } catch (error) {
            if (error instanceof CrewCheckoutWebhookValidationError) {
              logWarning({
                message:
                  "[Stripe Webhook] Ignored invalid Crew Checkout completion",
                error,
                attributes: {
                  stripeEventId,
                  sessionId: session.id,
                },
              })
              return
            }

            throw error
          }
        }

        async function handleRegistrationCheckoutCompleted(
          stripeEventId: string,
          session: Stripe.Checkout.Session,
        ) {
          const competitionId = session.metadata?.competitionId
          const userId = session.metadata?.userId
          const purchaseIdsRaw =
            session.metadata?.purchaseIds ?? session.metadata?.purchaseId

          if (!purchaseIdsRaw || !competitionId || !userId) {
            logError({
              message:
                "[Stripe Webhook] Missing required metadata in Checkout Session",
              attributes: {
                purchaseIds: purchaseIdsRaw,
                competitionId,
                userId,
              },
            })
            return
          }

          const purchaseIds = purchaseIdsRaw.split(",").filter(Boolean)
          const paymentIntent = getPaymentIntentId(session.payment_intent)
          const workflowErrors: Array<{
            purchaseId: string
            error: unknown
          }> = []

          for (const purchaseId of purchaseIds) {
            const purchase =
              await getDb().query.commercePurchaseTable.findFirst({
                where: eq(commercePurchaseTable.id, purchaseId),
              })

            if (!purchase) {
              logWarning({
                message:
                  "[Stripe Webhook] Purchase not found, falling back to session metadata",
                attributes: { purchaseId, eventId: stripeEventId },
              })
            }

            const divisionId =
              purchase?.divisionId ?? session.metadata?.divisionId ?? ""

            const workflowParams: CheckoutCompletedParams = {
              stripeEventId,
              session: {
                id: session.id,
                payment_intent: paymentIntent,
                amount_total: purchase?.totalCents ?? session.amount_total,
                customer_email: session.customer_email,
                metadata: {
                  purchaseId,
                  competitionId,
                  divisionId,
                  userId,
                  couponId: session.metadata?.couponId,
                  stripeCouponId: session.metadata?.stripeCouponId,
                  couponCode: session.metadata?.couponCode,
                  couponDiscountCents: session.metadata?.couponDiscountCents,
                },
              },
            }

            const workflowId =
              purchaseIds.length > 1
                ? `${stripeEventId}-${purchaseId}`
                : stripeEventId
            const workflow =
              "STRIPE_CHECKOUT_WORKFLOW" in env
                ? (env.STRIPE_CHECKOUT_WORKFLOW as
                    | Workflow<CheckoutCompletedParams>
                    | undefined)
                : undefined

            if (workflow && typeof workflow.create === "function") {
              try {
                await workflow.create({
                  id: workflowId,
                  params: workflowParams,
                })
                logInfo({
                  message: "[Stripe Webhook] Dispatched checkout to workflow",
                  attributes: {
                    eventId: stripeEventId,
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
                    attributes: { eventId: stripeEventId, workflowId },
                  })
                } else {
                  logError({
                    message: "[Stripe Webhook] Failed to dispatch workflow",
                    error: workflowErr,
                    attributes: {
                      eventId: stripeEventId,
                      workflowId,
                      purchaseId,
                    },
                  })
                  workflowErrors.push({ purchaseId, error: workflowErr })
                }
              }
            } else {
              logInfo({
                message:
                  "[Stripe Webhook] Workflow binding unavailable, processing inline",
                attributes: { eventId: stripeEventId, purchaseId },
              })
              const { processCheckoutInline } = await import(
                "@/workflows/stripe-checkout-workflow"
              )
              await processCheckoutInline(workflowParams)
            }
          }

          if (workflowErrors.length > 0) {
            throw new Error(
              `Failed to dispatch ${workflowErrors.length} of ${purchaseIds.length} workflows`,
            )
          }
        }

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

        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session
              if (isCrewCheckoutSessionMetadata(session.metadata)) {
                await handleCrewCheckoutCompleted(event.id, session)
              } else {
                await handleRegistrationCheckoutCompleted(event.id, session)
              }
              break
            }

            case "checkout.session.expired":
              await handleCheckoutExpired(
                event.data.object as Stripe.Checkout.Session,
              )
              break

            case "account.updated":
              await handleAccountUpdated(event.data.object as Stripe.Account)
              break

            case "charge.refunded":
              await handleChargeRefunded(event.data.object as Stripe.Charge)
              break

            case "account.application.authorized":
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
          return json({ error: "Processing failed" }, { status: 500 })
        }
      },
    },
  },
})

function getPaymentIntentId(
  paymentIntent: string | Stripe.PaymentIntent | null,
) {
  return typeof paymentIntent === "string"
    ? paymentIntent
    : (paymentIntent?.id ?? null)
}
