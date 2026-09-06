// @lat: [[crew#Crew Stripe Webhooks]]

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import type Stripe from "stripe"
import {
  CrewCheckoutWebhookValidationError,
  isCrewCheckoutSessionMetadata,
  parseCrewCheckoutSessionWebhook,
} from "@/lib/crew/checkout-webhooks"
import { getStripeWebhookSecret } from "@/lib/env"
import {
  logError,
  logInfo,
  logWarning,
} from "@/lib/logging/posthog-otel-logger"
import { getStripe } from "@/lib/stripe"
import {
  completeCrewCheckoutSessionFromWebhook,
  expireCrewCheckoutSessionFromWebhook,
} from "@/server/crew-billing.server"

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        async function handleCrewCheckoutCompleted(
          stripeEventId: string,
          session: Stripe.Checkout.Session,
        ) {
          try {
            if (session.payment_status !== "paid") {
              throw new CrewCheckoutWebhookValidationError(
                "Crew access requires a paid Checkout Session.",
              )
            }
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

        // @lat: [[crew#Shared Stripe Account Isolation]]
        try {
          switch (event.type) {
            case "checkout.session.completed": {
              const session = event.data.object as Stripe.Checkout.Session
              if (isCrewCheckoutSessionMetadata(session.metadata)) {
                await handleCrewCheckoutCompleted(event.id, session)
              }
              break
            }
            case "checkout.session.expired": {
              const session = event.data.object as Stripe.Checkout.Session
              if (isCrewCheckoutSessionMetadata(session.metadata)) {
                await expireCrewCheckoutSessionFromWebhook(session)
              }
              break
            }
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
