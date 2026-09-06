// @lat: [[crew#Crew Checkout Recovery]]
import { z } from "zod"
import type { CrewCheckoutCatalogPlan } from "./checkout-sessions"

const attemptSchema = z.object({
  id: z.string().min(1),
  createdAt: z.number().int().positive(),
  eventName: z.string(),
  appUrl: z.string().url(),
  plan: z.object({
    id: z.enum(["crew_basic", "crew_pro"]),
    name: z.string(),
    description: z.string().nullable(),
    price: z.number().int().positive(),
    currency: z.string(),
  }),
})

export interface CrewCheckoutAttempt {
  id: string
  createdAt: number
  eventName: string
  appUrl: string
  plan: CrewCheckoutCatalogPlan
}

export function parseCrewCheckoutSettings(
  text: string | null,
): Record<string, unknown> {
  if (!text) return {}
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Event settings need repair before checkout can start.")
  }
  return value as Record<string, unknown>
}

export function readCrewCheckoutAttempt(
  text: string | null,
): CrewCheckoutAttempt | null {
  const value = parseCrewCheckoutSettings(text).checkoutAttempt
  if (!value) return null
  return attemptSchema.parse(value)
}

export function canRetryCrewCheckoutCreation(
  attempt: CrewCheckoutAttempt,
  now = Date.now(),
) {
  // Stop before Stripe can prune the idempotency key. An uncertain old request
  // must be reconciled by an operator, never repeated as a new charge.
  return now - attempt.createdAt < 23 * 60 * 60 * 1000
}
