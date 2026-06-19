/**
 * Event (Per-Workout) Leaderboard API
 *
 * GET /api/compete/competitions/:id/events/:eventId/leaderboard
 * Query params: ?divisionId=<id> (optional)
 * Returns leaderboard for a single workout event.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { getEventLeaderboard } from "@/server/competition-leaderboard"
import { corsHeaders } from "@/utils/bearer-auth"

export const Route = createFileRoute(
  "/api/compete/competitions/$id/events/$eventId/leaderboard",
)({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("Origin")
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        })
      },

      GET: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string; eventId: string }
      }) => {
        const origin = request.headers.get("Origin")
        const headers = corsHeaders(origin)

        try {
          const { searchParams } = new URL(request.url)
          const divisionId = searchParams.get("divisionId") ?? undefined

          const result = await getEventLeaderboard({
            competitionId: params.id,
            trackWorkoutId: params.eventId,
            divisionId,
          })

          return json(result, { headers })
        } catch (err) {
          console.error(
            "[API] /api/compete/competitions/:id/events/:eventId/leaderboard error:",
            err,
          )
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
