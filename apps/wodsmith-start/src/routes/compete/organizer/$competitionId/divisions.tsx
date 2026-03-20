/**
 * Competition Divisions Route
 *
 * Organizer page for managing competition divisions.
 * Fetches divisions with counts and scaling groups in parallel.
 * Uses parent route loader data for competition data.
 */
// @lat: [[organizer-dashboard#Division Management]]

import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { ArrowRight, Check, Info, X } from "lucide-react"
import { OrganizerDivisionManager } from "@/components/divisions/organizer-division-manager"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  getCompetitionDivisionsWithCountsFn,
  listScalingGroupsFn,
} from "@/server-fns/competition-divisions-fns"
import { getCompetitionSeriesMappingStatusFn } from "@/server-fns/series-division-mapping-fns"
import { CapacitySettingsForm } from "./-components/capacity-settings-form"

// Get parent route API to access its loader data
const parentRoute = getRouteApi("/compete/organizer/$competitionId")

export const Route = createFileRoute(
  "/compete/organizer/$competitionId/divisions",
)({
  staleTime: 10_000,
  component: DivisionsPage,
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

function DivisionsPage() {
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

  // Only show capacity settings if divisions are already configured
  const hasDivisions = scalingGroupId && divisions.length > 0

  return (
    <div className="space-y-6">
      {/* Series mapping status banner */}
      {seriesMappingStatus && (
        <SeriesMappingBanner status={seriesMappingStatus} />
      )}

      {hasDivisions && (
        <CapacitySettingsForm
          competition={{
            id: competition.id,
            organizingTeamId: competition.organizingTeamId,
            defaultMaxSpotsPerDivision,
            maxTotalRegistrations: competition.maxTotalRegistrations,
          }}
        />
      )}

      <OrganizerDivisionManager
        key={scalingGroupId ?? "no-divisions"}
        teamId={competition.organizingTeamId}
        competitionId={competition.id}
        divisions={divisions}
        scalingGroupId={scalingGroupId}
        scalingGroupTitle={scalingGroupTitle}
        scalingGroups={scalingGroups}
        defaultMaxSpotsPerDivision={defaultMaxSpotsPerDivision}
      />
    </div>
  )
}

function SeriesMappingBanner({
  status,
}: {
  status: NonNullable<
    Awaited<ReturnType<typeof getCompetitionSeriesMappingStatusFn>>
  >
}) {
  if (!status.hasTemplate) {
    // Series exists but no template configured yet
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-400">
          Part of {status.seriesName}
        </AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <p>
            This competition is part of a series but no global leaderboard
            template has been configured yet.
          </p>
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <Link
              to="/compete/organizer/series/$groupId/divisions"
              params={{ groupId: status.groupId }}
            >
              Configure Series Divisions
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const mapped = status.divisions.filter((d) => d.mappedToSeriesLabel)
  const unmapped = status.divisions.filter((d) => !d.mappedToSeriesLabel)
  const allMapped = status.divisions.length > 0 && unmapped.length === 0

  return (
    <Alert
      className={
        allMapped
          ? "border-green-200 bg-green-50 dark:bg-green-950/20"
          : "border-orange-200 bg-orange-50 dark:bg-orange-950/20"
      }
    >
      <Info
        className={`h-4 w-4 ${allMapped ? "text-green-600" : "text-orange-600"}`}
      />
      <AlertTitle
        className={
          allMapped
            ? "text-green-800 dark:text-green-400"
            : "text-orange-800 dark:text-orange-400"
        }
      >
        Part of {status.seriesName}
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-2 mt-1">
          {mapped.length > 0 && (
            <div className="space-y-1">
              {mapped.map((d) => (
                <div
                  key={d.divisionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <Check className="h-3 w-3 text-green-600 shrink-0" />
                  <span className="text-muted-foreground">
                    {d.divisionLabel}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Badge
                    variant="outline"
                    className="text-green-700 border-green-300"
                  >
                    {d.mappedToSeriesLabel}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          {unmapped.length > 0 && (
            <div className="space-y-1">
              {unmapped.map((d) => (
                <div
                  key={d.divisionId}
                  className="flex items-center gap-2 text-sm"
                >
                  <X className="h-3 w-3 text-orange-600 shrink-0" />
                  <span className="text-muted-foreground">
                    {d.divisionLabel}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <Badge
                    variant="outline"
                    className="text-orange-600 border-orange-300"
                  >
                    not mapped
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" className="mt-3" asChild>
          <Link
            to="/compete/organizer/series/$groupId/divisions"
            params={{ groupId: status.groupId }}
          >
            {allMapped ? "View Series Divisions" : "Configure Series Divisions"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
