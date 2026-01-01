/**
 * Authentication middleware server functions for TanStack Start
 *
 * IMPORTANT: All server-only imports must use dynamic imports inside handlers
 * to avoid bundling cloudflare:workers into client bundle.
 */

import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import type { SessionValidationResult } from "@/types"

/**
 * Server function to validate user session
 * Returns session data or redirects to sign-in if not authenticated
 */
export const validateSession = createServerFn({
	method: "GET",
}).handler(async (): Promise<SessionValidationResult> => {
	const { getSessionFromCookie } = await import("@/utils/auth")
	const session = await getSessionFromCookie()

	if (!session) {
		throw redirect({
			to: "/sign-in",
			search: { redirect: "" },
		})
	}

	return session
})

/**
 * Server function to get session without requiring authentication
 * Returns session data or null if not authenticated (no redirect)
 */
export const getOptionalSession = createServerFn({
	method: "GET",
}).handler(async (): Promise<SessionValidationResult | null> => {
	const { getSessionFromCookie } = await import("@/utils/auth")
	const session = await getSessionFromCookie()
	return session
})
