// Client-side PostHog initialization and utilities
export {
	capturePageleave,
	capturePageview,
	getPostHog,
	initPostHog,
	isPostHogInitialized,
	posthog,
} from "./client"

// Utility functions with proper guards
export {
	identifyUser,
	registerSuperProperties,
	resetUser,
	setUserProperties,
	trackEvent,
} from "./utils"

// React provider for TanStack Start
export { PostHogProvider, usePostHog } from "./provider"

// Server-side PostHog OTEL logger
// Note: Import these in server-side code only
export {
	clearRequestWaitUntil,
	flushPostHogLogs,
	initPostHogLogger,
	logDebug,
	logError,
	logInfo,
	logWarning,
	setRequestWaitUntil,
	type LogParams,
	type PostHogConfig,
} from "./server"
