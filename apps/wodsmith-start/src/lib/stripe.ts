/**
 * Stripe client for TanStack Start
 * This is a server-only module - uses createServerOnlyFn to enforce server-only execution
 */

import { env } from "cloudflare:workers"
import { createServerOnlyFn } from "@tanstack/react-start"
import Stripe from "stripe"

let stripeInstance: Stripe | null = null

/**
 * Get the Stripe client instance.
 * This is a server-only function that will throw if called from the client.
 */
export const getStripe = createServerOnlyFn(() => {
	if (stripeInstance) {
		return stripeInstance
	}

	const stripeSecretKey = env.STRIPE_SECRET_KEY

	if (!stripeSecretKey) {
		throw new Error("Missing STRIPE_SECRET_KEY environment variable")
	}

	stripeInstance = new Stripe(stripeSecretKey, {
		apiVersion: "2025-02-24.acacia",
		typescript: true,
		httpClient: Stripe.createFetchHttpClient(),
	})

	return stripeInstance
})
