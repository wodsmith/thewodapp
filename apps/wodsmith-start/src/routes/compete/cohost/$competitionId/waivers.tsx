/**
 * Competition Cohost Waivers Route
 *
 * Renders the shared organizer WaiversPage with cohost-permissioned waiver
 * mutation overrides so the page stays in sync with the organizer route.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMemo } from "react"
import {
  cohostCreateWaiverFn,
  cohostDeleteWaiverFn,
  cohostGetCompetitionWaiversFn,
  cohostReorderWaiversFn,
  cohostUpdateWaiverFn,
} from "@/server-fns/cohost/cohost-waiver-fns"
import type { WaiverListOverrides } from "../../organizer/$competitionId/-components/waiver-list"
import { WaiversPage } from "../../organizer/$competitionId/-pages/waivers-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute("/compete/cohost/$competitionId/waivers")({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Fetch waivers for this competition
    const waiversResult = await cohostGetCompetitionWaiversFn({
      data: { competitionId: params.competitionId, competitionTeamId },
    })

    return {
      waivers: waiversResult.waivers,
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { waivers } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()
  const competitionTeamId = competition.competitionTeamId!

  // Build override callbacks that map teamId -> competitionTeamId for cohost server fns
  const overrides = useMemo(
    (): WaiverListOverrides => ({
      createWaiver: async (opts) =>
        cohostCreateWaiverFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            title: opts.data.title,
            content: opts.data.content,
            required: opts.data.required,
            requiredForVolunteers: opts.data.requiredForVolunteers,
          },
        }),
      updateWaiver: async (opts) =>
        cohostUpdateWaiverFn({
          data: {
            competitionTeamId,
            waiverId: opts.data.waiverId,
            competitionId: opts.data.competitionId,
            title: opts.data.title,
            content: opts.data.content,
            required: opts.data.required,
            requiredForVolunteers: opts.data.requiredForVolunteers,
          },
        }),
      deleteWaiver: async (opts) =>
        cohostDeleteWaiverFn({
          data: {
            competitionTeamId,
            waiverId: opts.data.waiverId,
            competitionId: opts.data.competitionId,
          },
        }),
      reorderWaivers: async (opts) =>
        cohostReorderWaiversFn({
          data: {
            competitionTeamId,
            competitionId: opts.data.competitionId,
            waivers: opts.data.waivers,
          },
        }),
    }),
    [competitionTeamId],
  )

  return (
    <WaiversPage
      competitionId={competition.id}
      teamId={competitionTeamId}
      waivers={waivers}
      overrides={overrides}
    />
  )
}
