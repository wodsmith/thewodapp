/**
 * Competition Divisions Route
 *
 * Organizer page for managing competition divisions.
 * Fetches divisions with counts and scaling groups in parallel.
 * Uses parent route loader data for competition data.
 */
// @lat: [[organizer-dashboard#Division Management]]

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import {
  getCompetitionDivisionsWithCountsFn,
  listScalingGroupsFn,
} from "@/server-fns/competition-divisions-fns"
import { getCompetitionSeriesMappingStatusFn } from "@/server-fns/series-division-mapping-fns"
import { DivisionsPage } from "./-pages/divisions-page"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/divisions",
)({
  staleTime: 10_000,
  component: RouteComponent,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    // biome-ignore lint/style/noNonNullAssertion: established pattern for parent route data
    const { competition } = parentMatch.loaderData!

    // Parallel fetch divisions, scaling groups, and series mapping status
    const [divisionsResult, scalingGroupsResult, seriesMappingStatus] =
      await Promise.all([
        getCompetitionDivisionsWithCountsFn({
          data: {
            competitionId: params.competitionId,
            teamId: competition.organizingTeamId,
          },
        }),
        listScalingGroupsFn({
          data: {
            teamId: competition.organizingTeamId,
          },
        }),
        competition.groupId
          ? getCompetitionSeriesMappingStatusFn({
              data: {
                competitionId: params.competitionId,
                groupId: competition.groupId,
              },
            })
          : null,
      ])

    return {
      divisions: divisionsResult.divisions,
      scalingGroupId: divisionsResult.scalingGroupId,
      scalingGroupTitle: divisionsResult.scalingGroupTitle ?? null,
      scalingGroups: scalingGroupsResult.groups,
      defaultMaxSpotsPerDivision:
        divisionsResult.defaultMaxSpotsPerDivision ?? null,
      seriesMappingStatus,
    }
  },
})

function RouteComponent() {
  const {
    divisions,
    scalingGroupId,
    scalingGroupTitle,
    scalingGroups,
    defaultMaxSpotsPerDivision,
    seriesMappingStatus,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  return (
    <DivisionsPage
      teamId={competition.organizingTeamId}
      competition={competition}
      divisions={divisions}
      scalingGroupId={scalingGroupId}
      scalingGroupTitle={scalingGroupTitle}
      scalingGroups={scalingGroups}
      defaultMaxSpotsPerDivision={defaultMaxSpotsPerDivision}
      seriesMappingStatus={seriesMappingStatus}
    />
  )
}
