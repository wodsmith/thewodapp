/**
 * Competition by Slug API
 *
 * GET /api/compete/competitions/:slug
 * Returns public competition details by slug.
 */

import { createFileRoute } from "@tanstack/react-router"
import { json } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { addressesTable } from "@/db/schemas/addresses"
import { competitionsTable } from "@/db/schemas/competitions"
import { teamTable } from "@/db/schemas/teams"
import { corsHeaders } from "@/utils/bearer-auth"

export const Route = createFileRoute("/api/compete/competitions/$slug")({
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
        params: { slug: string }
      }) => {
        const origin = request.headers.get("Origin")
        const headers = corsHeaders(origin)

        try {
          const db = getDb()
          const result = await db
            .select({
              id: competitionsTable.id,
              organizingTeamId: competitionsTable.organizingTeamId,
              competitionTeamId: competitionsTable.competitionTeamId,
              groupId: competitionsTable.groupId,
              slug: competitionsTable.slug,
              name: competitionsTable.name,
              description: competitionsTable.description,
              startDate: competitionsTable.startDate,
              endDate: competitionsTable.endDate,
              registrationOpensAt: competitionsTable.registrationOpensAt,
              registrationClosesAt: competitionsTable.registrationClosesAt,
              timezone: competitionsTable.timezone,
              visibility: competitionsTable.visibility,
              status: competitionsTable.status,
              competitionType: competitionsTable.competitionType,
              profileImageUrl: competitionsTable.profileImageUrl,
              bannerImageUrl: competitionsTable.bannerImageUrl,
              primaryAddressId: competitionsTable.primaryAddressId,
              createdAt: competitionsTable.createdAt,
              updatedAt: competitionsTable.updatedAt,
              // Organizing team
              organizingTeamName: teamTable.name,
              organizingTeamSlug: teamTable.slug,
              organizingTeamAvatarUrl: teamTable.avatarUrl,
              // Address
              addressName: addressesTable.name,
              addressStreetLine1: addressesTable.streetLine1,
              addressStreetLine2: addressesTable.streetLine2,
              addressCity: addressesTable.city,
              addressStateProvince: addressesTable.stateProvince,
              addressPostalCode: addressesTable.postalCode,
              addressCountryCode: addressesTable.countryCode,
            })
            .from(competitionsTable)
            .leftJoin(
              teamTable,
              eq(competitionsTable.organizingTeamId, teamTable.id),
            )
            .leftJoin(
              addressesTable,
              eq(competitionsTable.primaryAddressId, addressesTable.id),
            )
            .where(
              and(
                eq(competitionsTable.slug, params.slug),
                eq(competitionsTable.status, "published"),
              ),
            )
            .limit(1)

          if (!result[0]) {
            return json(
              { error: "Competition not found" },
              { status: 404, headers },
            )
          }

          const row = result[0]
          const {
            organizingTeamName,
            organizingTeamSlug,
            organizingTeamAvatarUrl,
            addressName,
            addressStreetLine1,
            addressStreetLine2,
            addressCity,
            addressStateProvince,
            addressPostalCode,
            addressCountryCode,
            ...competition
          } = row

          return json(
            {
              competition: {
                ...competition,
                organizingTeam: row.organizingTeamId
                  ? {
                      name: organizingTeamName,
                      slug: organizingTeamSlug,
                      avatarUrl: organizingTeamAvatarUrl,
                    }
                  : null,
                address: row.primaryAddressId
                  ? {
                      name: addressName,
                      streetLine1: addressStreetLine1,
                      streetLine2: addressStreetLine2,
                      city: addressCity,
                      stateProvince: addressStateProvince,
                      postalCode: addressPostalCode,
                      countryCode: addressCountryCode,
                    }
                  : null,
              },
            },
            { headers },
          )
        } catch (err) {
          console.error("[API] /api/compete/competitions/:slug error:", err)
          return json(
            { error: "Internal server error" },
            { status: 500, headers },
          )
        }
      },
    },
  },
})
