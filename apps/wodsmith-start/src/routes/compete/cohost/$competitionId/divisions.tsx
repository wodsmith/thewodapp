/**
 * Competition Cohost Divisions Route
 *
 * Cohost page for viewing competition divisions with counts.
 * Mirrors the organizer divisions page but uses cohost server functions.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { OrganizerDivisionManager } from "@/components/divisions/organizer-division-manager"
import { cohostGetDivisionsWithCountsFn } from "@/server-fns/cohost/cohost-division-fns"
import { CapacitySettingsForm } from "../../organizer/$competitionId/-components/capacity-settings-form"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/cohost/$competitionId")

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/divisions",
)({
  staleTime: 10_000,
  component: CohostDivisionsPage,
  loader: async ({ params, parentMatchPromise }) => {
    const parentMatch = await parentMatchPromise
    // biome-ignore lint/style/noNonNullAssertion: established pattern for parent route data
    const { competition } = parentMatch.loaderData!

    const competitionTeamId = competition.competitionTeamId!

    const divisionsResult = await cohostGetDivisionsWithCountsFn({
      data: {
        competitionId: params.competitionId,
        competitionTeamId,
      },
    })

    return {
      divisions: divisionsResult.divisions,
      scalingGroupId: divisionsResult.scalingGroupId,
      scalingGroupTitle: divisionsResult.scalingGroupTitle ?? null,
      defaultMaxSpotsPerDivision:
        divisionsResult.defaultMaxSpotsPerDivision ?? null,
    }
  },
})

function CohostDivisionsPage() {
  const {
    divisions,
    scalingGroupId,
    scalingGroupTitle,
    defaultMaxSpotsPerDivision,
  } = Route.useLoaderData()
  // Get competition from parent layout loader data
  const { competition } = parentRoute.useLoaderData()

  const competitionTeamId = competition.competitionTeamId!

  // Only show capacity settings if divisions are already configured
  const hasDivisions = scalingGroupId && divisions.length > 0

  return (
    <div className="space-y-6">
      {hasDivisions && (
        <CapacitySettingsForm
          competition={{
            id: competition.id,
            organizingTeamId: competitionTeamId,
            defaultMaxSpotsPerDivision,
            maxTotalRegistrations: competition.maxTotalRegistrations,
          }}
        />
      )}

      <OrganizerDivisionManager
        key={scalingGroupId ?? "no-divisions"}
        teamId={competitionTeamId}
        competitionId={competition.id}
        divisions={divisions}
        scalingGroupId={scalingGroupId}
        scalingGroupTitle={scalingGroupTitle}
        scalingGroups={[]}
        defaultMaxSpotsPerDivision={defaultMaxSpotsPerDivision}
      />
    </div>
  )
}
