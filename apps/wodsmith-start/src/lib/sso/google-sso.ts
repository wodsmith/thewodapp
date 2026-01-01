import { env } from "cloudflare:workers"
import { Google } from "arctic"
import { SITE_URL } from "@/constants"

// Type assertion for env vars that may be secrets (not in worker-configuration.d.ts)
interface GoogleSSOEnv {
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
}

/**
 * Create a Google OAuth client for SSO
 * Uses Cloudflare environment variables for credentials
 */
export function getGoogleSSOClient(): Google {
	const ssoEnv = env as unknown as GoogleSSOEnv
	const clientId = ssoEnv.GOOGLE_CLIENT_ID ?? ""
	const clientSecret = ssoEnv.GOOGLE_CLIENT_SECRET ?? ""

	if (!clientId || !clientSecret) {
		throw new Error("Google OAuth credentials are not configured")
	}

	return new Google(clientId, clientSecret, `${SITE_URL}/sso/google/callback`)
}

/**
 * Check if Google SSO is enabled based on environment configuration
 */
export function isGoogleSSOEnabled(): boolean {
	const ssoEnv = env as unknown as GoogleSSOEnv
	return Boolean(ssoEnv.GOOGLE_CLIENT_ID && ssoEnv.GOOGLE_CLIENT_SECRET)
}
