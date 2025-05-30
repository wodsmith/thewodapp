import { isTurnstileEnabled } from "@/flags"

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
}

export async function validateTurnstileToken(token: string) {
  if (!(await isTurnstileEnabled())) {
    return true
  }

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    }
  )

  const data = await response.json() as TurnstileResponse

  return data.success
}
