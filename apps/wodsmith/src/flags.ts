import "server-only"

import { cache } from "react"

export async function isGoogleSSOEnabled() {
	return Boolean(
		process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
	)
}

export async function isTurnstileEnabled() {
	// Both the server secret key AND the client site key must be present
	// for Turnstile to work properly. If only the secret is set but the
	// site key is missing, the client-side widget won't function.
	return Boolean(
		process.env.TURNSTILE_SECRET_KEY &&
			process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
	)
}

export const getConfig = cache(async () => {
	return {
		isGoogleSSOEnabled: await isGoogleSSOEnabled(),
		isTurnstileEnabled: await isTurnstileEnabled(),
	}
})
