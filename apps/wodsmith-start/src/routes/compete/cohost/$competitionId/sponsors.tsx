/**
 * Cohost Competition Sponsors Route
 *
 * Cohost page for managing competition sponsors.
 * Fetches sponsors and groups via cohost server fns, reuses SponsorManager component.
 * Passes override callbacks so mutations use cohost auth instead of organizer auth.
 */

import { useMemo } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import type { SponsorManagerOverrides } from "@/components/sponsors/sponsor-manager"
import { SponsorManager } from "@/components/sponsors/sponsor-manager"
import {
  cohostCreateSponsorFn,
  cohostCreateSponsorGroupFn,
  cohostDeleteSponsorFn,
  cohostDeleteSponsorGroupFn,
  cohostGetCompetitionSponsorsFn,
  cohostReorderSponsorGroupsFn,
  cohostReorderSponsorsFn,
  cohostUpdateSponsorFn,
  cohostUpdateSponsorGroupFn,
} from "@/server-fns/cohost/cohost-sponsor-fns"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/sponsors",
)({
  staleTime: 10_000,
  component: SponsorsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    const sponsorsResult = await cohostGetCompetitionSponsorsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
      },
    }).catch(() => ({ groups: [], ungroupedSponsors: [] }))

    return {
      groups: sponsorsResult.groups,
      ungroupedSponsors: sponsorsResult.ungroupedSponsors,
    }
  },
})

function SponsorsPage() {
  const { groups, ungroupedSponsors } = Route.useLoaderData()
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!

  // Build override callbacks that inject competitionTeamId for cohost server fns
  const overrides = useMemo(
    (): SponsorManagerOverrides => ({
      createSponsorGroup: async (opts) =>
        cohostCreateSponsorGroupFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            name: opts.data.name,
          },
        }),
      updateSponsorGroup: async (opts) =>
        cohostUpdateSponsorGroupFn({
          data: {
            competitionTeamId,
            groupId: opts.data.groupId,
            competitionId: opts.data.competitionId,
            name: opts.data.name,
          },
        }),
      deleteSponsorGroup: async (opts) =>
        cohostDeleteSponsorGroupFn({
          data: {
            competitionTeamId,
            groupId: opts.data.groupId,
            competitionId: opts.data.competitionId,
          },
        }),
      reorderSponsorGroups: async (opts) =>
        cohostReorderSponsorGroupsFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            groupIds: opts.data.groupIds,
          },
        }),
      createSponsor: async (opts) =>
        cohostCreateSponsorFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId ?? competition.id,
            groupId: opts.data.groupId,
            name: opts.data.name,
            logoUrl: opts.data.logoUrl,
            website: opts.data.website,
          },
        }),
      updateSponsor: async (opts) =>
        cohostUpdateSponsorFn({
          data: {
            competitionTeamId,
            sponsorId: opts.data.sponsorId,
            groupId: opts.data.groupId,
            name: opts.data.name,
            logoUrl: opts.data.logoUrl,
            website: opts.data.website,
          },
        }),
      deleteSponsor: async (opts) =>
        cohostDeleteSponsorFn({
          data: {
            competitionTeamId,
            sponsorId: opts.data.sponsorId,
          },
        }),
      reorderSponsors: async (opts) =>
        cohostReorderSponsorsFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            sponsorOrders: opts.data.sponsorOrders,
          },
        }),
    }),
    [competitionTeamId, competition.id],
  )

  return (
    <SponsorManager
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
      overrides={overrides}
    />
  )
}
