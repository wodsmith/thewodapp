import { createRouter } from "@tanstack/react-router"

// Import the generated route tree
import { routeTree } from "./routeTree.gen"

// Global pending component - shows a subtle loading bar at the top of the page
function DefaultPendingComponent() {
	return (
		<div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary/20 overflow-hidden">
			<div className="h-full w-1/3 bg-primary animate-[loading_1s_ease-in-out_infinite]" />
			<style>{`
				@keyframes loading {
					0% { transform: translateX(-100%); }
					100% { transform: translateX(400%); }
				}
			`}</style>
		</div>
	)
}

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
		defaultPendingComponent: DefaultPendingComponent,
	})

	return router
}
