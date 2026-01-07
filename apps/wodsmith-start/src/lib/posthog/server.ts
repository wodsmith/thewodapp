/**
 * Server-side PostHog OTEL Logger for TanStack Start
 *
 * This module provides structured logging to PostHog using OpenTelemetry format.
 * Use this in server functions, API routes, and other server-side contexts.
 *
 * IMPORTANT: This file should only be imported in server-side code (server functions).
 * Do not import from client components or route files directly.
 *
 * Usage:
 * 1. Call initPostHogLogger() once at app startup (e.g., in middleware)
 * 2. Call setRequestWaitUntil(ctx.waitUntil.bind(ctx)) at start of each request
 * 3. Use logInfo/logWarning/logError for logging
 * 4. Call clearRequestWaitUntil() at end of request (optional)
 */

import { createServerOnlyFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"

import {
	clearWaitUntil,
	configurePostHog,
	flushLogs,
	logDebug,
	logError,
	logInfo,
	logWarning,
	setWaitUntil,
	type LogParams,
	type PostHogConfig,
} from "@repo/posthog"

// Re-export types for consumers
export type { LogParams, PostHogConfig }

// Re-export logging functions for direct use
export { logDebug, logError, logInfo, logWarning }

let isInitialized = false

/**
 * Initialize the PostHog OTEL logger.
 * Call this once at application startup (e.g., in middleware or app initialization).
 * Safe to call multiple times - will only initialize once.
 */
export const initPostHogLogger = createServerOnlyFn((): void => {
	if (isInitialized) return

	const apiKey =
		env.POSTHOG_KEY || "phc_UCtCVOUXvpuKzF50prCLKIWWCFc61j5CPTbt99OrKsK"
	const endpoint = "https://us.i.posthog.com/i/v1/logs"
	const environment = "production"

	configurePostHog({
		apiKey,
		endpoint,
		serviceName: "wodsmith-start",
		serviceNamespace: "web",
		environment,
		consoleLogging: true,
	})

	isInitialized = true
})

/**
 * Set the waitUntil function for the current request context.
 * Call this at the start of each request with ctx.waitUntil from your Cloudflare context.
 * This ensures logs complete even after the response is sent.
 *
 * @example
 * // In TanStack Start middleware or server function
 * import { setRequestWaitUntil } from '@/lib/posthog/server'
 *
 * setRequestWaitUntil(ctx.waitUntil.bind(ctx))
 */
export const setRequestWaitUntil = createServerOnlyFn(
	(waitUntil: (promise: Promise<unknown>) => void): void => {
		setWaitUntil(waitUntil)
	},
)

/**
 * Clear the waitUntil function (call at end of request if needed)
 */
export const clearRequestWaitUntil = createServerOnlyFn((): void => {
	clearWaitUntil()
})

/**
 * Flush all pending logs.
 * Call this before process shutdown to ensure all logs are sent.
 * Note: With the current implementation, logs are sent immediately,
 * so this is effectively a no-op.
 */
export const flushPostHogLogs = createServerOnlyFn(async (): Promise<void> => {
	await flushLogs()
})
