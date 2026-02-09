/**
 * Server-only environment utilities for TanStack Start
 * Uses createServerOnlyFn to enforce server-only execution
 */

import { env } from "cloudflare:workers"
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start"

/**
 * Type helper for accessing env vars that may not be in the typed Env interface.
 * Some env vars are set as secrets or in wrangler.jsonc but not in worker-configuration.d.ts.
 */
type ExtendedEnv = typeof env & {
	RESEND_API_KEY?: string
	EMAIL_TEST_MODE?: string
	TURNSTILE_SECRET_KEY?: string
	NODE_ENV?: string
	SITE_URL?: string
	CRON_SECRET?: string
	INTERNAL_API_SECRET?: string
	// Slack integration
	SLACK_WEBHOOK_URL?: string
	SLACK_PURCHASE_NOTIFICATIONS_ENABLED?: string
	SLACK_PURCHASE_NOTIFICATION_TYPES?: string
}

const extendedEnv = env as ExtendedEnv

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
 * Get the application URL via RPC (safe to call from route loaders during SPA navigation).
 * Use this instead of getAppUrl() in route loaders, which run on the client during
 * client-side navigation and would throw with createServerOnlyFn.
 */
export const getAppUrlFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return env.APP_URL || "https://wodsmith.com"
	},
)

/**
 * Get the Stripe Client ID.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The STRIPE_CLIENT_ID environment variable or undefined if not set
 */
export const getStripeClientId = createServerOnlyFn((): string | undefined => {
	return env.STRIPE_CLIENT_ID
})

/**
 * Get the Stripe Webhook Secret.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The STRIPE_WEBHOOK_SECRET environment variable or undefined if not set
 */
export const getStripeWebhookSecret = createServerOnlyFn(
	(): string | undefined => {
		return env.STRIPE_WEBHOOK_SECRET
	},
)

// Email configuration accessors

/**
 * Get the Resend API key.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The RESEND_API_KEY environment variable or undefined if not set
 */
export const getResendApiKey = createServerOnlyFn((): string | undefined => {
	return extendedEnv.RESEND_API_KEY
})

/**
 * Get the email "from" address.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The EMAIL_FROM environment variable or default "team@mail.wodsmith.com"
 */
export const getEmailFrom = createServerOnlyFn((): string => {
	return env.EMAIL_FROM || "team@mail.wodsmith.com"
})

/**
 * Get the email "from" display name.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The EMAIL_FROM_NAME environment variable or default "WODsmith"
 */
export const getEmailFromName = createServerOnlyFn((): string => {
	return env.EMAIL_FROM_NAME || "WODsmith"
})

/**
 * Get the email "reply-to" address.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The EMAIL_REPLY_TO environment variable or default "support@mail.wodsmith.com"
 */
export const getEmailReplyTo = createServerOnlyFn((): string => {
	return env.EMAIL_REPLY_TO || "support@mail.wodsmith.com"
})

/**
 * Check if email is in test mode.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns True if EMAIL_TEST_MODE is "true", false otherwise
 */
export const isEmailTestMode = createServerOnlyFn((): boolean => {
	return extendedEnv.EMAIL_TEST_MODE === "true"
})

// Turnstile (CAPTCHA) configuration accessors

/**
 * Get the Turnstile site key (public).
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The TURNSTILE_SITE_KEY environment variable or undefined if not set
 */
export const getTurnstileSiteKey = createServerOnlyFn(
	(): string | undefined => {
		return env.TURNSTILE_SITE_KEY
	},
)

/**
 * Get the Turnstile secret key.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The TURNSTILE_SECRET_KEY environment variable or undefined if not set
 */
export const getTurnstileSecretKey = createServerOnlyFn(
	(): string | undefined => {
		return extendedEnv.TURNSTILE_SECRET_KEY
	},
)

// Environment detection accessors

/**
 * Get the NODE_ENV value.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The NODE_ENV environment variable or "development" if not set
 */
export const getNodeEnv = createServerOnlyFn((): string => {
	return extendedEnv.NODE_ENV || "development"
})

/**
 * Check if running in production.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns True if NODE_ENV is "production", false otherwise
 */
export const isProduction = createServerOnlyFn((): boolean => {
	return extendedEnv.NODE_ENV === "production"
})

/**
 * Get the site URL based on environment.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The SITE_URL environment variable, or localhost in development, or default "https://wodsmith.com"
 */
export const getSiteUrl = createServerOnlyFn((): string => {
	if (extendedEnv.NODE_ENV === "development") {
		return "http://localhost:3000"
	}
	return extendedEnv.SITE_URL || "https://wodsmith.com"
})

// Cron configuration accessors

/**
 * Get the cron secret for authenticating scheduled job requests.
 * This is a server-only function that will throw if called from the client.
 *
 * In development, set CRON_SECRET in .dev.vars file.
 * In production, CRON_SECRET must be set as an environment variable.
 *
 * @returns The CRON_SECRET environment variable or undefined if not set
 */
export const getCronSecret = createServerOnlyFn((): string | undefined => {
	return extendedEnv.CRON_SECRET
})

// Internal API configuration accessors

/**
 * Get the internal API secret for worker-to-worker authentication.
 * This is a server-only function that will throw if called from the client.
 *
 * @returns The INTERNAL_API_SECRET environment variable or undefined if not set
 */
export const getInternalApiSecret = createServerOnlyFn(
	(): string | undefined => {
		return extendedEnv.INTERNAL_API_SECRET
	},
)

// Slack configuration accessors

export const getSlackWebhookUrl = createServerOnlyFn((): string | undefined => {
	return extendedEnv.SLACK_WEBHOOK_URL
})

export const isSlackPurchaseNotificationsEnabled = createServerOnlyFn(
	(): boolean => {
		return extendedEnv.SLACK_PURCHASE_NOTIFICATIONS_ENABLED === "true"
	},
)

export const getSlackPurchaseNotificationTypes = createServerOnlyFn(
	(): string | undefined => {
		return extendedEnv.SLACK_PURCHASE_NOTIFICATION_TYPES
	},
)
