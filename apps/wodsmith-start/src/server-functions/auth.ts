import { createServerFn } from "@tanstack/react-start"
import {
	getSessionFromCookie,
	getActiveOrPersonalTeamId,
	deleteSessionTokenCookie,
	deleteActiveTeamCookie,
} from "~/utils/auth.server"

/**
 * Get current user session
 * Can be called from client components via RPC
 */
export const getCurrentUserFn = createServerFn("GET", async () => {
	try {
		const session = await getSessionFromCookie()
		return {
			session,
			activeTeamId: session
				? await getActiveOrPersonalTeamId(session.userId)
				: null,
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

/**
 * Sign in with email and password
 * Creates session and returns user data
 */
export const signInAction = createServerFn("POST", async (input: { email: string; password: string }) => {
	// TODO: Implement sign in logic
	// This should verify email/password and create session
	return { success: false, error: "Sign in not yet implemented" }
})

/**
 * Sign up with email and password
 * Creates new user account, personal team, and session
 */
export const signUpAction = createServerFn("POST", async (input: { email: string; password: string; firstName: string; lastName: string; captchaToken?: string }) => {
	// TODO: Implement sign up logic
	// Should validate email, hash password, create user, create personal team, and create session
	return { success: false, error: "Sign up not yet implemented", userId: null }
})

/**
 * Request password reset
 * Generates reset token and sends email
 */
export const forgotPasswordAction = createServerFn("POST", async (input: { email: string; captchaToken?: string }) => {
	// TODO: Implement forgot password logic
	// Should generate reset token and send email
	return { success: true }
})

/**
 * Reset password with token
 * Updates user password and invalidates token
 */
export const resetPasswordAction = createServerFn("POST", async (input: { token: string; password: string }) => {
	// TODO: Implement reset password logic
	// Should verify token, update password, and delete token
	return { success: false, error: "Reset password not yet implemented" }
})

/**
 * Verify email with token
 * Marks email as verified
 */
export const verifyEmailAction = createServerFn("POST", async (input: { token: string }) => {
	// TODO: Implement email verification logic
	// Should verify token and mark email as verified
	return { success: false, error: "Email verification not yet implemented" }
})

/**
 * Accept team invite with token
 * Adds user to team
 */
export const acceptTeamInviteAction = createServerFn("POST", async (input: { token: string }) => {
	// TODO: Implement accept team invite logic
	// Should verify token and add user to team
	return { success: false, error: "Accept team invite not yet implemented" }
})
