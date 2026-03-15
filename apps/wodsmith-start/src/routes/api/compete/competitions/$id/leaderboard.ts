/**
 * Competition Leaderboard API
 *
 * GET /api/compete/competitions/:id/leaderboard
 * Query params: ?divisionId=<id> (optional)
 * Returns the overall competition leaderboard.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import {
  getCompetitionLeaderboard,
} from "@/server/competition-leaderboard"
import { corsHeaders } from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/compete/competitions/$id/leaderboard")({
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
        params: { id: string }
      }) => {
        const origin = request.headers.get("Origin")
        const headers = corsHeaders(origin)

        try {
          const { searchParams } = new URL(request.url)
          const divisionId = searchParams.get("divisionId") ?? undefined

          const result = await getCompetitionLeaderboard({
            competitionId: params.id,
            divisionId,
          })

          return json(result, { headers })
        } catch (err) {
          console.error("[API] /api/compete/competitions/:id/leaderboard error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
