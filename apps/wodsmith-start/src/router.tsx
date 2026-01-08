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

		// Preloading - fetch data on hover/touch before click
		defaultPreload: "intent",
		defaultPreloadDelay: 50, // Small delay to avoid accidental preloads

		// Caching - stale-while-revalidate behavior
		defaultPreloadStaleTime: 30_000, // Preloaded data fresh for 30s
		defaultGcTime: 5 * 60_000, // Keep cache for 5 minutes after route unloads

		// Loading UX - show pending state after delay to avoid flash
		defaultPendingMs: 500, // Show loader after 500ms
		defaultPendingMinMs: 200, // Minimum loader display time
	})

	return router
}
