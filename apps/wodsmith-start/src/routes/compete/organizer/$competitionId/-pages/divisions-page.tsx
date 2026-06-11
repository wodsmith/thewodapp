/**
 * Competition Divisions Page
 *
 * Shared page body for the organizer and cohost divisions routes. The
 * organizer route passes scaling groups and series mapping status; the cohost
 * route injects cohost-permissioned mutation overrides and omits
 * organizer-only sections.
 */

import { Link } from "@tanstack/react-router"
import { ArrowRight, Check, Info, X } from "lucide-react"
import type { ComponentProps } from "react"
import type { DivisionManagerOverrides } from "@/components/divisions/organizer-division-manager"
import { OrganizerDivisionManager } from "@/components/divisions/organizer-division-manager"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { getCompetitionSeriesMappingStatusFn } from "@/server-fns/series-division-mapping-fns"
import { CapacitySettingsForm } from "../-components/capacity-settings-form"

type SeriesMappingStatus = NonNullable<
  Awaited<ReturnType<typeof getCompetitionSeriesMappingStatusFn>>
>

type DivisionManagerProps = ComponentProps<typeof OrganizerDivisionManager>

interface DivisionsPageProps {
  /** Organizing team for organizers, competition team for cohosts. */
  teamId: string
  competition: {
    id: string
    maxTotalRegistrations: number | null
  }
  divisions: DivisionManagerProps["divisions"]
  scalingGroupId: string | null
  scalingGroupTitle: string | null
  /** Organizer-only; cohosts cannot list the organizing team's scaling groups. */
  scalingGroups?: DivisionManagerProps["scalingGroups"]
  defaultMaxSpotsPerDivision: number | null
  /** Organizer-only; links into organizer series routes. */
  seriesMappingStatus?: SeriesMappingStatus | null
  /** Cohost routes inject cohost-permissioned mutations. */
  overrides?: DivisionManagerOverrides
  onSaveCapacity?: ComponentProps<typeof CapacitySettingsForm>["onSaveCapacity"]
}

export function DivisionsPage({
  teamId,
  competition,
  divisions,
  scalingGroupId,
  scalingGroupTitle,
  scalingGroups = [],
  defaultMaxSpotsPerDivision,
  seriesMappingStatus,
  overrides,
  onSaveCapacity,
}: DivisionsPageProps) {
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
            organizingTeamId: teamId,
            defaultMaxSpotsPerDivision,
            maxTotalRegistrations: competition.maxTotalRegistrations,
          }}
          onSaveCapacity={onSaveCapacity}
        />
      )}

      <OrganizerDivisionManager
        key={scalingGroupId ?? "no-divisions"}
        teamId={teamId}
        competitionId={competition.id}
        divisions={divisions}
        scalingGroupId={scalingGroupId}
        scalingGroupTitle={scalingGroupTitle}
        scalingGroups={scalingGroups}
        defaultMaxSpotsPerDivision={defaultMaxSpotsPerDivision}
        overrides={overrides}
      />
    </div>
  )
}

function SeriesMappingBanner({ status }: { status: SeriesMappingStatus }) {
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
              Configure series divisions
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
            {allMapped ? "View series divisions" : "Configure series divisions"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
