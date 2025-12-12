import { createServerFn } from "@tanstack/react-start"
import { getSessionFromCookie, getActiveOrPersonalTeamId, deleteSessionTokenCookie, deleteActiveTeamCookie } from "@/utils/auth.server"

/**
 * Get current user session
 * Can be called from client components via RPC
 */
export const getCurrentUserFn = createServerFn("GET", async () => {
	try {
		const session = await getSessionFromCookie()
		return {
			session,
			activeTeamId: session ? await getActiveOrPersonalTeamId(session.userId) : null,
		}
	} catch (error) {
		console.error("Error getting current user:", error)
		return { session: null, activeTeamId: null }
	}
})

/**
 * Logout user and clear session
 * Can be called from client components via RPC
 */
export const logoutFn = createServerFn("POST", async () => {
	try {
		await deleteSessionTokenCookie()
		await deleteActiveTeamCookie()
		return { success: true }
	} catch (error) {
		console.error("Error logging out:", error)
		return { success: false, error: "Failed to logout" }
	}
})

/**
 * Verify user is authenticated
 * Throws if not authenticated
 */
export const requireAuthFn = createServerFn("GET", async () => {
	const session = await getSessionFromCookie()
	if (!session) {
		throw new Error("Not authenticated")
	}
	return session
})
