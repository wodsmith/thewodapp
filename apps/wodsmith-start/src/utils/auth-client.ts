/**
 * Client-side auth utilities for TanStack Start
 * Provides hooks to access session data from route context
 */

import { useRouteContext } from "@tanstack/react-router"

/**
 * Hook to access the current session from route context.
 * Must be used within a route that has session in its context.
 *
 * @returns The current session or null if not authenticated
 */
export function useSession() {
	const context = useRouteContext({ from: "__root__" })
	return context.session
}
