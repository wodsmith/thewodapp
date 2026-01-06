/**
 * Server-only environment utilities for TanStack Start
 * Uses createServerOnlyFn to enforce server-only execution
 */
import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"

/**
 * Get the application URL.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The APP_URL environment variable or the default "https://wodsmith.com"
 */
export const getAppUrl = createServerOnlyFn((): string => {
	return env.APP_URL || "https://wodsmith.com"
})

/**
 * Get the Stripe Client ID.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The STRIPE_CLIENT_ID environment variable or undefined if not set
 */
export const getStripeClientId = createServerOnlyFn((): string | undefined => {
	return env.STRIPE_CLIENT_ID
})
