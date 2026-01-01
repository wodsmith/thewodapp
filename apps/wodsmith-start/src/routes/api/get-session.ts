/**
 * Get Session API Route for TanStack Start
 *
 * GET /api/get-session
 * Returns the current user session and app config.
 * Used for client-side session hydration.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"

export const Route = createFileRoute("/api/get-session")({
	server: {
		handlers: {
			GET: async () => {
				// Dynamic imports for server-only modules
				const { getSessionFromCookie } = await import("@/utils/auth")
				const { getConfig } = await import("@/flags")

				let session = null
				let error = null

				try {
					session = await getSessionFromCookie()
				} catch (e) {
					error = e
				}

				const config = await getConfig()

				return json(
					{
						session: error ? null : session,
						config,
					},
					{
						headers: {
							"Cache-Control":
								"no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
							Pragma: "no-cache",
							Expires: "0",
						},
					},
				)
			},
		},
	},
})
