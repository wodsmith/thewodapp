/**
 * My Registrations API
 *
 * GET /api/compete/registrations/me?competitionId=<id>
 * Returns the authenticated user's registrations for a competition.
 * Requires bearer or cookie authentication.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
  competitionRegistrationsTable,
  REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { teamMembershipTable } from "@/db/schemas/teams"
import { corsHeaders, getSessionFromBearerOrCookie } from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/compete/registrations/me")({
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

        const session = await getSessionFromBearerOrCookie(request)
        if (!session?.userId) {
          return json({ error: "Unauthorized" }, { status: 401, headers })
        }

        const { searchParams } = new URL(request.url)
        const competitionId = searchParams.get("competitionId")
        if (!competitionId) {
          return json(
            { error: "competitionId query param is required" },
            { status: 400, headers },
          )
        }

        try {
          const db = getDb()
          const userId = session.userId

          const registrationColumns = {
            id: competitionRegistrationsTable.id,
            eventId: competitionRegistrationsTable.eventId,
            userId: competitionRegistrationsTable.userId,
            divisionId: competitionRegistrationsTable.divisionId,
            registeredAt: competitionRegistrationsTable.registeredAt,
            status: competitionRegistrationsTable.status,
            teamName: competitionRegistrationsTable.teamName,
            captainUserId: competitionRegistrationsTable.captainUserId,
            athleteTeamId: competitionRegistrationsTable.athleteTeamId,
            teamMemberId: competitionRegistrationsTable.teamMemberId,
          }

          const directRegistrations = await db
            .select(registrationColumns)
            .from(competitionRegistrationsTable)
            .where(
              and(
                eq(competitionRegistrationsTable.eventId, competitionId),
                eq(competitionRegistrationsTable.userId, userId),
                ne(
                  competitionRegistrationsTable.status,
                  REGISTRATION_STATUS.REMOVED,
                ),
              ),
            )

          const userTeamMemberships = await db
            .select({ teamId: teamMembershipTable.teamId })
            .from(teamMembershipTable)
            .where(
              and(
                eq(teamMembershipTable.userId, userId),
                eq(teamMembershipTable.isActive, true),
              ),
            )

          let teamRegistrations: typeof directRegistrations = []
          if (userTeamMemberships.length > 0) {
            const userTeamIds = userTeamMemberships.map((m) => m.teamId)
            teamRegistrations = await db
              .select(registrationColumns)
              .from(competitionRegistrationsTable)
              .where(
                and(
                  eq(competitionRegistrationsTable.eventId, competitionId),
                  ne(
                    competitionRegistrationsTable.status,
                    REGISTRATION_STATUS.REMOVED,
                  ),
                  sql`${competitionRegistrationsTable.athleteTeamId} IN (${sql.join(
                    userTeamIds.map((id) => sql`${id}`),
                    sql`, `,
                  )})`,
                ),
              )
          }

          const seenIds = new Set<string>()
          const allRegistrations: typeof directRegistrations = []
          for (const reg of [...directRegistrations, ...teamRegistrations]) {
            if (!seenIds.has(reg.id)) {
              seenIds.add(reg.id)
              allRegistrations.push(reg)
            }
          }

          return json({ registrations: allRegistrations }, { headers })
        } catch (err) {
          console.error("[API] /api/compete/registrations/me error:", err)
          return json({ error: "Internal server error" }, { status: 500, headers })
        }
      },
    },
  },
})
