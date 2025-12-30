import { getPostHog } from "./client"

/**
 * Track a custom event in PostHog.
 * Safe to call on server (no-ops) - only executes on client.
 *
 * Use this for imperative event tracking outside of React components.
 * For component-based tracking, prefer useTrackEvent hook.
 *
 * @example
 * ```typescript
 * // In a server function callback or utility
 * trackEvent('form_submitted', { form: 'contact', success: true })
 * ```
 */
export function trackEvent(
	event: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return
	getPostHog().capture(event, properties)
}

/**
 * Identify a user in PostHog.
 * Safe to call on server (no-ops) - only executes on client.
 *
 * Use this for imperative user identification outside of React components.
 * For component-based identification, prefer useIdentifyUser hook.
 *
 * @example
 * ```typescript
 * // After authentication
 * identifyUser(user.id, {
 *   email: user.email,
 *   plan: user.plan,
 *   createdAt: user.createdAt,
 * })
 * ```
 */
export function identifyUser(
	userId: string,
	properties?: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return
	getPostHog().identify(userId, properties)
}

/**
 * Reset user identity in PostHog.
 * Safe to call on server (no-ops) - only executes on client.
 *
 * Use this for imperative user reset outside of React components.
 * For component-based reset, prefer useResetUser hook.
 *
 * @example
 * ```typescript
 * // On logout
 * resetUser()
 * ```
 */
export function resetUser(): void {
	if (typeof window === "undefined") return
	getPostHog().reset()
}

/**
 * Set properties on the current user.
 * Safe to call on server (no-ops) - only executes on client.
 *
 * @example
 * ```typescript
 * // Update user properties after plan change
 * setUserProperties({ plan: 'pro', upgradeDate: new Date().toISOString() })
 * ```
 */
export function setUserProperties(
	properties: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return
	getPostHog().setPersonProperties(properties)
}

/**
 * Register properties that will be sent with every future event.
 * Safe to call on server (no-ops) - only executes on client.
 *
 * @example
 * ```typescript
 * // Set properties for all future events
 * registerSuperProperties({ appVersion: '2.0.0', environment: 'production' })
 * ```
 */
export function registerSuperProperties(
	properties: Record<string, unknown>,
): void {
	if (typeof window === "undefined") return
	getPostHog().register(properties)
}
