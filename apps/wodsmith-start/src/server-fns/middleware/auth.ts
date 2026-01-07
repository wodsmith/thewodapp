/**
 * Authentication middleware server functions for TanStack Start
 *
 * This file uses top-level imports for server-only modules.
 */

import { redirect } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import type { SessionValidationResult } from "@/types"
import { getSessionFromCookie } from "@/utils/auth"

/**
 * Server function to validate user session
 * Returns session data or redirects to sign-in if not authenticated
 */
export const validateSession = createServerFn({
	method: "GET",
}).handler(async (): Promise<SessionValidationResult> => {
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
	const session = await getSessionFromCookie()
	return session
})
