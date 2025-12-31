// Client-side PostHog initialization and utilities
export {
	capturePageleave,
	capturePageview,
	getPostHog,
	identifyUser,
	initPostHog,
	posthog,
	resetUser,
} from "./client"

// React provider for TanStack Start
export { PostHogProvider, usePostHog } from "./provider"
