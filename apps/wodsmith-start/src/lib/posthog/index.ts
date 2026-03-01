// Client-side PostHog initialization and utilities
export {
	capturePageleave,
	capturePageview,
	getPostHog,
	initPostHog,
	isPostHogInitialized,
	posthog,
} from "./client"
// React provider for TanStack Start
export { PostHogProvider, usePostHog } from "./provider"
// Utility functions with proper guards
export {
	identifyUser,
	registerSuperProperties,
	resetUser,
	setUserProperties,
	trackEvent,
} from "./utils"
