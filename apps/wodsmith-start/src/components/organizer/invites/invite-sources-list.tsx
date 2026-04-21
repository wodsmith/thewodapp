"use client"

/**
 * Invite Sources List — organizer-visible roster of all qualification
 * sources feeding the championship, plus an allocated-spots summary card
 * (matches `project/invites/sources.jsx` modulo visual polish).
 */

import type React from "react"
import { Layers, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CompetitionInviteSource } from "@/db/schemas/competition-invites"

interface InviteSourcesListProps {
  sources: CompetitionInviteSource[]
  competitionNamesById: Record<string, string>
  seriesNamesById: Record<string, string>
  onEdit?: (source: CompetitionInviteSource) => void
  onDelete?: (source: CompetitionInviteSource) => void
  onAdd?: () => void
  /** Optional render-prop for extra content inside a source card (used to
   *  drop in the series per-comp + global sub-tabs). */
  renderSourceExtras?: (source: CompetitionInviteSource) => React.ReactNode
}

function allocatedSpotsFor(source: CompetitionInviteSource): number {
  if (source.kind === "series") {
    return (source.directSpotsPerComp ?? 0) + (source.globalSpots ?? 0)
  }
  return source.globalSpots ?? 0
}

export function InviteSourcesList({
  sources,
  competitionNamesById,
  seriesNamesById,
  onEdit,
  onDelete,
  onAdd,
  renderSourceExtras,
}: InviteSourcesListProps) {
  const totalAllocated = sources.reduce(
    (acc, s) => acc + allocatedSpotsFor(s),
    0,
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Qualification sources</CardTitle>
            <CardDescription>
              {sources.length === 0
                ? "No sources configured yet."
                : `${sources.length} source${
                    sources.length === 1 ? "" : "s"
                  } · ${totalAllocated} qualifying spots allocated.`}
            </CardDescription>
          </div>
          {onAdd ? <Button onClick={onAdd}>Add source</Button> : null}
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {sources.map((source) => {
          const isSeries = source.kind === "series"
          const Icon = isSeries ? Layers : Trophy
          const name = isSeries
            ? (source.sourceGroupId
                ? seriesNamesById[source.sourceGroupId]
                : undefined) ?? "Unknown series"
            : (source.sourceCompetitionId
                ? competitionNamesById[source.sourceCompetitionId]
                : undefined) ?? "Unknown competition"
          const allocated = allocatedSpotsFor(source)
          return (
            <Card key={source.id}>
              <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isSeries ? "default" : "secondary"}>
                      {isSeries ? "Series" : "Single competition"}
                    </Badge>
                  </div>
                  <CardTitle className="mt-1 text-base">{name}</CardTitle>
                  <CardDescription>
                    Contributes <span className="font-semibold">{allocated}</span>{" "}
                    qualifying spots to the championship.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {onEdit ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(source)}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(source)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              {isSeries ? (
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Direct qualifiers
                      </div>
                      <div className="mt-1 text-sm">
                        Top{" "}
                        <span className="font-semibold">
                          {source.directSpotsPerComp ?? 0}
                        </span>{" "}
                        of each throwdown directly invited.
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-muted-foreground">
                        Global spots
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-semibold">
                          {source.globalSpots ?? 0}
                        </span>{" "}
                        from the series global leaderboard.
                      </div>
                    </div>
                  </div>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="text-xs uppercase text-muted-foreground">
                    Top {source.globalSpots ?? 0}
                  </div>
                  <div className="mt-1 text-sm">
                    Top {source.globalSpots ?? 0} finishers qualify.
                  </div>
                </CardContent>
              )}
              {renderSourceExtras ? (
                <CardContent>{renderSourceExtras(source)}</CardContent>
              ) : null}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
