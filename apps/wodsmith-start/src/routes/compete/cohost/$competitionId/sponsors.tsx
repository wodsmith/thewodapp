/**
 * Cohost Competition Sponsors Route
 *
 * Renders the shared organizer SponsorsPage with cohost-permissioned sponsor
 * mutation overrides so the page stays in sync with the organizer route.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMemo } from "react"
import type { SponsorManagerOverrides } from "@/components/sponsors/sponsor-manager"
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
import { SponsorsPage } from "../../organizer/$competitionId/-pages/sponsors-page"

const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/sponsors")(
  {
    staleTime: 10_000,
    component: RouteComponent,
    loader: async ({ params, parentMatchPromise }) => {
      const parentMatch = await parentMatchPromise
      const { competition } = parentMatch.loaderData!

      const competitionTeamId = competition.competitionTeamId!

      const sponsorsResult = await cohostGetCompetitionSponsorsFn({
        data: {
          competitionId: params.competitionId,
          competitionTeamId,
        },
      })

      return {
        groups: sponsorsResult.groups,
        ungroupedSponsors: sponsorsResult.ungroupedSponsors,
      }
    },
  },
)

function RouteComponent() {
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
            competitionId: competition.id,
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
            competitionId: competition.id,
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
    <SponsorsPage
      competitionId={competition.id}
      organizingTeamId={competition.organizingTeamId}
      groups={groups}
      ungroupedSponsors={ungroupedSponsors}
      overrides={overrides}
    />
  )
}
