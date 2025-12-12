import { env } from "cloudflare:workers"
import { Google } from "arctic"
import { SITE_URL } from "@/constants"

/**
 * Get the Google OAuth client instance.
 * Uses environment variables from Cloudflare Workers.
 *
 * @returns Google OAuth client configured with client ID, secret, and callback URL
 */
export function getGoogleSSOClient(): Google {
	const clientId = env.GOOGLE_CLIENT_ID
	const clientSecret = env.GOOGLE_CLIENT_SECRET

	if (!clientId || !clientSecret) {
		throw new Error("Google OAuth credentials are not configured")
	}

	return new Google(clientId, clientSecret, `${SITE_URL}/sso/google/callback`)
}

/**
 * Check if Google SSO is enabled by verifying credentials are configured.
 *
 * @returns true if Google OAuth is enabled, false otherwise
 */
export function isGoogleSSOEnabled(): boolean {
	const clientId = env.GOOGLE_CLIENT_ID
	const clientSecret = env.GOOGLE_CLIENT_SECRET

	return !!(clientId && clientSecret)
}
