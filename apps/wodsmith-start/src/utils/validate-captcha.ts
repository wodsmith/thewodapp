import { getTurnstileSecretKey } from "@/lib/env"

interface TurnstileResponse {
	success: boolean
	"error-codes"?: string[]
}

/**
 * Validate a Turnstile CAPTCHA token.
 * Always validates when a token is provided - the caller is responsible
 * for only calling this when CAPTCHA is enabled on the client side.
 */
export async function validateTurnstileToken(token: string) {
	const response = await fetch(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				secret: getTurnstileSecretKey(),
				response: token,
			}),
		},
	)

	const data = (await response.json()) as TurnstileResponse

	return data.success
}
