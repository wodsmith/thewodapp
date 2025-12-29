/**
 * Feature flags for the application
 * TODO: Port from apps/wodsmith/src/flags.ts or implement with proper feature flag system
 */

/**
 * Check if Turnstile CAPTCHA is enabled
 * Returns false by default in development, true in production if secret key is set
 */
export async function isTurnstileEnabled(): Promise<boolean> {
	// Disable in development by default
	if (process.env.NODE_ENV === "development") {
		return false
	}

	// Enable in production only if secret key is configured
	return !!process.env.TURNSTILE_SECRET_KEY
}
