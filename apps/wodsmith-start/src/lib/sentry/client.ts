import * as Sentry from "@sentry/react"
import { tanstackRouterBrowserTracingIntegration } from "@sentry/react"
import type { Router } from "@tanstack/react-router"

let isInitialized = false

/**
 * Initialize Sentry client-side error tracking and APM.
 * Only inits in production (skips import.meta.env.DEV).
 * Call once after router creation, on the client only.
 */
export function initSentry(router: Router<any, any, any>): void {
	if (typeof window === "undefined") return
	if (isInitialized) return
	if (import.meta.env.DEV) return

	const dsn = import.meta.env.VITE_SENTRY_DSN
	if (!dsn) return

	Sentry.init({
		dsn,
		integrations: [tanstackRouterBrowserTracingIntegration(router)],
		tracesSampleRate: 0.1,
		environment: "production",
		release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
		sendDefaultPii: false,
	})

	isInitialized = true
}

/**
 * Capture an exception in Sentry (client-side).
 * Safe to call even when Sentry is not initialized (no-ops gracefully).
 */
export function sentryCaptureException(
	error: unknown,
	context?: Record<string, unknown>,
): void {
	if (!isInitialized) return
	try {
		const errorObj = error instanceof Error ? error : new Error(String(error))
		Sentry.captureException(errorObj, {
			extra: context,
		})
	} catch {
		// graceful degradation
	}
}
