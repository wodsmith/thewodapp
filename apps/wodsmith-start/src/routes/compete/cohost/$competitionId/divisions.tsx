/**
 * Competition Cohost Divisions Route
 *
 * Cohost page for managing competition divisions with counts.
 * Mirrors the organizer divisions page but uses cohost server functions.
 */

import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import type { DivisionManagerOverrides } from "@/components/divisions/organizer-division-manager"
import { OrganizerDivisionManager } from "@/components/divisions/organizer-division-manager"
import {
  cohostAddCompetitionDivisionFn,
  cohostDeleteCompetitionDivisionFn,
  cohostGetDivisionsWithCountsFn,
  cohostInitializeCompetitionDivisionsFn,
  cohostReorderCompetitionDivisionsFn,
  cohostUpdateCompetitionDivisionFn,
  cohostUpdateDivisionCapacityFn,
  cohostUpdateDivisionDescriptionFn,
} from "@/server-fns/cohost/cohost-division-fns"
import { cohostUpdateCapacitySettingsFn } from "@/server-fns/cohost/cohost-settings-fns"
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
    }).catch(() => ({ divisions: [], scalingGroupId: null as string | null, scalingGroupTitle: null as string | null, defaultMaxSpotsPerDivision: null as number | null }))

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
  const updateCapacity = useServerFn(cohostUpdateCapacitySettingsFn)

  // Only show capacity settings if divisions are already configured
  const hasDivisions = scalingGroupId && divisions.length > 0

  const overrides: DivisionManagerOverrides = {
    addDivision: async (params) => {
      return cohostAddCompetitionDivisionFn({
        data: { competitionTeamId, competitionId: params.competitionId, label: params.label, teamSize: params.teamSize },
      })
    },
    updateDivision: async (params) => {
      return cohostUpdateCompetitionDivisionFn({
        data: { competitionTeamId, competitionId: params.competitionId, divisionId: params.divisionId, label: params.label },
      })
    },
    deleteDivision: async (params) => {
      return cohostDeleteCompetitionDivisionFn({
        data: { competitionTeamId, competitionId: params.competitionId, divisionId: params.divisionId },
      })
    },
    reorderDivisions: async (params) => {
      return cohostReorderCompetitionDivisionsFn({
        data: { competitionTeamId, competitionId: params.competitionId, orderedDivisionIds: params.orderedDivisionIds },
      })
    },
    updateDescription: async (params) => {
      return cohostUpdateDivisionDescriptionFn({
        data: { competitionTeamId, competitionId: params.competitionId, divisionId: params.divisionId, description: params.description },
      })
    },
    updateCapacity: async (params) => {
      return cohostUpdateDivisionCapacityFn({
        data: { competitionTeamId, competitionId: params.competitionId, divisionId: params.divisionId, maxSpots: params.maxSpots },
      })
    },
    initializeDivisions: async (params) => {
      return cohostInitializeCompetitionDivisionsFn({
        data: { competitionTeamId, competitionId: params.competitionId, templateGroupId: params.templateGroupId },
      })
    },
  }

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
          onSaveCapacity={async (data) => {
            await updateCapacity({
              data: {
                competitionTeamId,
                competitionId: data.competitionId,
                defaultMaxSpotsPerDivision: data.defaultMaxSpotsPerDivision,
                maxTotalRegistrations: data.maxTotalRegistrations,
              },
            })
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
        overrides={overrides}
      />
    </div>
  )
}
