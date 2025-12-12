import Stripe from "stripe"

let stripeInstance: Stripe | null = null

/**
 * Get or create Stripe instance
 * Uses environment variable STRIPE_SECRET_KEY
 */
export function getStripe() {
	if (stripeInstance) {
		return stripeInstance
	}

	const stripeSecretKey = process.env.STRIPE_SECRET_KEY

	if (!stripeSecretKey) {
		throw new Error("Missing STRIPE_SECRET_KEY environment variable")
	}

	stripeInstance = new Stripe(stripeSecretKey, {
		apiVersion: "2025-02-24.acacia",
		typescript: true,
		httpClient: Stripe.createFetchHttpClient(),
	})

	return stripeInstance
}
