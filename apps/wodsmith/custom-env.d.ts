/// <reference types="vitest/globals" />

interface CloudflareEnv {
	// TODO Remove them from here because we are not longer loading them from the Cloudflare Context
	RESEND_API_KEY?: string
	NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string
	TURNSTILE_SECRET_KEY?: string
	BREVO_API_KEY?: string
	GOOGLE_CLIENT_ID?: string
	GOOGLE_CLIENT_SECRET?: string
	// R2 Storage
	R2_BUCKET: R2Bucket
	R2_PUBLIC_URL: string
}

declare global {
	var __mockReplace: ReturnType<typeof vi.fn>
	var __searchParams: URLSearchParams
}
