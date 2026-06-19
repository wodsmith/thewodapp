/**
 * Submission Window Status API
 *
 * GET /api/compete/scores/window-status?competitionId=<id>&trackWorkoutId=<id>
 * Returns whether the score submission window is currently open.
 * Public — no auth required.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import {
  competitionEventsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { corsHeaders } from "@/utils/bearer-auth"

async function getSubmissionWindowStatus(
  competitionId: string,
  trackWorkoutId: string,
) {
  const db = getDb()

  const [competition] = await db
    .select({ competitionType: competitionsTable.competitionType })
    .from(competitionsTable)
    .where(eq(competitionsTable.id, competitionId))
    .limit(1)

  if (!competition) {
    return { isOpen: false, opensAt: null, closesAt: null, reason: "Competition not found" }
  }

  if (competition.competitionType !== "online") {
    return {
      isOpen: false,
      opensAt: null,
      closesAt: null,
      reason: "This is not an online competition",
    }
  }

  const [event] = await db
    .select({
      submissionOpensAt: competitionEventsTable.submissionOpensAt,
      submissionClosesAt: competitionEventsTable.submissionClosesAt,
    })
    .from(competitionEventsTable)
    .where(
      and(
        eq(competitionEventsTable.competitionId, competitionId),
        eq(competitionEventsTable.trackWorkoutId, trackWorkoutId),
      ),
    )
    .limit(1)

  if (!event || !event.submissionOpensAt || !event.submissionClosesAt) {
    return { isOpen: false, opensAt: null, closesAt: null, reason: "Submission window not configured" }
  }

  const now = new Date()
  const opensAt = new Date(event.submissionOpensAt)
  const closesAt = new Date(event.submissionClosesAt)

  if (now < opensAt) {
    return {
      isOpen: false,
      opensAt: event.submissionOpensAt,
      closesAt: event.submissionClosesAt,
      reason: "Submission window has not opened yet",
    }
  }

  if (now > closesAt) {
    return {
      isOpen: false,
      opensAt: event.submissionOpensAt,
      closesAt: event.submissionClosesAt,
      reason: "Submission window has closed",
    }
  }

  return { isOpen: true, opensAt: event.submissionOpensAt, closesAt: event.submissionClosesAt }
}

export const Route = createFileRoute("/api/compete/scores/window-status")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => {
        const origin = request.headers.get("Origin")
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        })
      },

      GET: async ({ request }: { request: Request }) => {
        const origin = request.headers.get("Origin")
        const headers = corsHeaders(origin)

        const { searchParams } = new URL(request.url)
        const competitionId = searchParams.get("competitionId")
        const trackWorkoutId = searchParams.get("trackWorkoutId")

        if (!competitionId || !trackWorkoutId) {
          return json(
            { error: "competitionId and trackWorkoutId are required" },
            { status: 400, headers },
          )
        }

        try {
          const status = await getSubmissionWindowStatus(competitionId, trackWorkoutId)
          return json(status, { headers })
        } catch (err) {
          console.error("[API] /api/compete/scores/window-status error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
