import posthog from "posthog-js"

const POSTHOG_KEY =
	import.meta.env.VITE_POSTHOG_KEY ||
	"phc_UCtCVOUXvpuKzF50prCLKIWWCFc61j5CPTbt99OrKsK"

const POSTHOG_HOST =
	import.meta.env.VITE_POSTHOG_HOST || "https://analytics.wodsmith.com/ingest"

let isInitialized = false

/**
 * Check if PostHog has been initialized.
 * Use this to guard utility functions that depend on PostHog being ready.
 */
export function isPostHogInitialized(): boolean {
	return isInitialized
}

/**
 * Initialize PostHog client-side analytics.
 * Safe to call multiple times - will only initialize once.
 * Must be called in a client-side context (browser).
 */
export function initPostHog(): void {
	if (typeof window === "undefined") {
		return
	}

	if (isInitialized) {
		return
	}

	// Don't initialize in development to avoid polluting analytics
	if (import.meta.env.DEV) {
		return
	}

	posthog.init(POSTHOG_KEY, {
		api_host: POSTHOG_HOST,
		ui_host: "https://us.posthog.com",
		// Match Next.js app settings
		defaults: "2025-05-24",
		capture_exceptions: true,
		debug: false,
		// We'll handle pageviews manually with router integration
		capture_pageview: false,
		capture_pageleave: true,
		// Session replay enabled
		disable_session_recording: false,
	})

	isInitialized = true
}

/**
 * Get the PostHog instance.
 * Returns the singleton instance whether or not it's initialized.
 */
export function getPostHog(): typeof posthog {
	return posthog
}

/**
 * Capture a pageview event manually.
 * Use this with router navigation events.
 */
export function capturePageview(url?: string): void {
	if (typeof window === "undefined" || !isInitialized) {
		return
	}

	posthog.capture("$pageview", {
		$current_url: url || window.location.href,
	})
}

/**
 * Capture a page leave event manually.
 */
export function capturePageleave(): void {
	if (typeof window === "undefined" || !isInitialized) {
		return
	}

	posthog.capture("$pageleave")
}

/**
 * Direct access to the PostHog instance.
 *
 * @warning This export bypasses initialization guards. Prefer using the utility
 * functions from `./utils.ts` (e.g., `trackEvent`, `identifyUser`) which include
 * proper window and initialization checks. Only use this for advanced cases
 * where you need direct PostHog API access.
 */
export { posthog }
