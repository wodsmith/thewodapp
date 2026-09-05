import { getTurnstileConfig, getTurnstileSecretKey } from "@/lib/env"

interface TurnstileResponse {
  success: boolean
  "error-codes"?: string[]
}

/**
 * Validate a Turnstile CAPTCHA token.
 * Only a development server without a secret may disable CAPTCHA.
 * Call for every protected request, including requests without a token.
 */
export async function validateTurnstileToken(token?: string) {
  const config = getTurnstileConfig()
  if (!config.enabled) return true

  const secret = getTurnstileSecretKey()
  if (!secret || !config.siteKey) {
    throw new Error("CAPTCHA is temporarily unavailable. Please try again.")
  }
  if (!token?.trim()) return false

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    },
  )

  if (!response.ok) return false
  const data = (await response.json()) as TurnstileResponse

  return data.success === true
}
