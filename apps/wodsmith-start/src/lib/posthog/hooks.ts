import { useCallback } from "react"

import { usePostHog } from "./provider"

// Re-export the core hook for convenience
export { usePostHog } from "./provider"

/**
 * Hook for tracking custom events in PostHog.
 *
 * @example
 * ```tsx
 * function SignupButton() {
 *   const trackEvent = useTrackEvent()
 *
 *   const handleClick = () => {
 *     trackEvent('signup_started', { source: 'hero' })
 *   }
 *
 *   return <button onClick={handleClick}>Sign Up</button>
 * }
 * ```
 */
export function useTrackEvent() {
	const { posthog } = usePostHog()

	return useCallback(
		(event: string, properties?: Record<string, unknown>) => {
			posthog.capture(event, properties)
		},
		[posthog],
	)
}

/**
 * Hook for identifying users in PostHog.
 * Call after successful authentication.
 *
 * @example
 * ```tsx
 * function LoginForm() {
 *   const identifyUser = useIdentifyUser()
 *
 *   const onLoginSuccess = (user: User) => {
 *     identifyUser(user.id, {
 *       email: user.email,
 *       name: user.name,
 *       plan: user.plan,
 *     })
 *   }
 * }
 * ```
 */
export function useIdentifyUser() {
	const { posthog } = usePostHog()

	return useCallback(
		(userId: string, properties?: Record<string, unknown>) => {
			posthog.identify(userId, properties)
		},
		[posthog],
	)
}

/**
 * Hook for resetting user identity in PostHog.
 * Call on logout to clear the current user.
 *
 * @example
 * ```tsx
 * function LogoutButton() {
 *   const resetUser = useResetUser()
 *
 *   const handleLogout = () => {
 *     resetUser()
 *     // ... other logout logic
 *   }
 * }
 * ```
 */
export function useResetUser() {
	const { posthog } = usePostHog()

	return useCallback(() => {
		posthog.reset()
	}, [posthog])
}
