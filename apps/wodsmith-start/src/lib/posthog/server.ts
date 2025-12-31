/**
 * Server-side PostHog client for TanStack Start
 *
 * This module provides a singleton PostHog client for server-side analytics
 * and event tracking. Use this in server functions, API routes, and other
 * server-side contexts.
 *
 * IMPORTANT: This file should only be imported in server-side code (server functions).
 * Do not import from client components or route files directly.
 */

import { PostHog } from "posthog-node"

// Use VITE_ prefix for environment variables in TanStack Start
const POSTHOG_API_KEY =
	import.meta.env.VITE_POSTHOG_KEY ||
	"phc_UCtCVOUXvpuKzF50prCLKIWWCFc61j5CPTbt99OrKsK"

const POSTHOG_HOST =
	import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com"

let serverClient: PostHog | null = null

/**
 * Get the server-side PostHog client instance.
 * Returns a singleton that is lazily initialized on first call.
 *
 * @returns PostHog client configured for server-side usage
 */
export function getServerPostHog(): PostHog {
	if (!serverClient) {
		serverClient = new PostHog(POSTHOG_API_KEY, {
			host: POSTHOG_HOST,
			// Disable automatic flushing - we'll manually flush or use waitUntil
			flushAt: 1,
			flushInterval: 0,
		})
	}
	return serverClient
}

/**
 * Shutdown the PostHog client gracefully.
 * Call this before process shutdown to ensure all events are sent.
 */
export async function shutdownPostHog(): Promise<void> {
	if (serverClient) {
		await serverClient.shutdown()
		serverClient = null
	}
}
