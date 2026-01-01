import { createRouter } from "@tanstack/react-router"

// Import the generated route tree
import { routeTree } from "./routeTree.gen"

// Create a new router instance
// Note: PostHogProvider is added in __root.tsx RootDocument instead of InnerWrap
// because InnerWrap runs during SSR, but PostHog requires client-only execution
export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreloadStaleTime: 0,
	})

	return router
}
