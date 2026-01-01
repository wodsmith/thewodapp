/**
 * Feature flags for the application
 * Ported from apps/wodsmith/src/flags.ts
 */

/**
 * Check if Google SSO is enabled
 * Both client ID and secret must be configured
 */
export async function isGoogleSSOEnabled(): Promise<boolean> {
	return Boolean(
		process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
	)
}

/**
 * Check if Turnstile CAPTCHA is enabled
 * Both the server secret key AND the client site key must be present
 * for Turnstile to work properly. If only the secret is set but the
 * site key is missing, the client-side widget won't function.
 */
export async function isTurnstileEnabled(): Promise<boolean> {
	return Boolean(
		process.env.TURNSTILE_SECRET_KEY && process.env.VITE_TURNSTILE_SITE_KEY,
	)
}

/**
 * Get all feature flag configuration
 * Returns a cached config object with all feature flag states
 */
export async function getConfig(): Promise<{
	isGoogleSSOEnabled: boolean
	isTurnstileEnabled: boolean
}> {
	return {
		isGoogleSSOEnabled: await isGoogleSSOEnabled(),
		isTurnstileEnabled: await isTurnstileEnabled(),
	}
}
