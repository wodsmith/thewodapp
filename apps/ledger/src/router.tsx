import { createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

export const getRouter = () => {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadDelay: 50,
		defaultPreloadStaleTime: 30_000,
		defaultGcTime: 5 * 60_000,
	})

	return router
}
