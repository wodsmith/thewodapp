import { createRouter } from "@tanstack/react-router"

import { PostHogProvider } from "./lib/posthog/provider"
// Import the generated route tree
import { routeTree } from "./routeTree.gen"

// Create a new router instance
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
		/**
		 * InnerWrap provides router context to PostHogProvider,
		 * enabling automatic pageview tracking on route changes.
		 */
		InnerWrap: ({ children }) => (
			<PostHogProvider>{children}</PostHogProvider>
		),
	})

	return router
}
