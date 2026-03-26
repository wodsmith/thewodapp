/**
 * Competition Cohost Waivers Route
 *
 * Cohost page for managing competition waivers.
 * Mirrors the organizer waivers page but uses cohost server functions.
 * Passes override callbacks to WaiverList so mutations use cohost auth.
 */

import { useMemo } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import {
  cohostCreateWaiverFn,
  cohostDeleteWaiverFn,
  cohostGetCompetitionWaiversFn,
  cohostReorderWaiversFn,
  cohostUpdateWaiverFn,
} from "@/server-fns/cohost/cohost-waiver-fns"
import type { WaiverListOverrides } from "../../organizer/$competitionId/-components/waiver-list"
import { WaiverList } from "../../organizer/$competitionId/-components/waiver-list"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/waivers",
)({
  staleTime: 10_000,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    // Fetch waivers for this competition
    const waiversResult = await cohostGetCompetitionWaiversFn({
      data: { competitionId: params.competitionId, competitionTeamId },
    }).catch(() => ({ waivers: [] }))

    return {
      waivers: waiversResult.waivers,
    }
  },
  component: CohostWaiversPage,
})

function CohostWaiversPage() {
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
    <WaiverList
      competitionId={competition.id}
      teamId={competitionTeamId}
      waivers={waivers}
      overrides={overrides}
    />
  )
}
