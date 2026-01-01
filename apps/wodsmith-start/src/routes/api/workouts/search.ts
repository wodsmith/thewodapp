/**
 * Workout Search API Route for TanStack Start
 *
 * GET /api/workouts/search?q=<query>
 * Returns workouts matching the search query for the user's active team.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"

export const Route = createFileRoute("/api/workouts/search")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					// Dynamic imports for server-only modules
					const { getSessionFromCookie, getActiveOrPersonalTeamId } =
						await import("@/utils/auth")

					const session = await getSessionFromCookie()
					if (!session?.user?.id) {
						return json({ error: "Unauthorized" }, { status: 401 })
					}

					const { searchParams } = new URL(request.url)
					const query = searchParams.get("q") || ""

					// Get team from authenticated session
					const teamId = await getActiveOrPersonalTeamId(session.user.id)
					if (!teamId) {
						return json({ error: "No active team" }, { status: 400 })
					}

					// Get workouts for the team
					const { getUserWorkouts } = await import("@/server/workouts")
					const workouts = await getUserWorkouts({
						teamId,
						search: query,
						limit: 50,
					})

					return json({ workouts })
				} catch (error) {
					console.error("Error searching workouts:", error)
					return json({ error: "Failed to search workouts" }, { status: 500 })
				}
			},
		},
	},
})
