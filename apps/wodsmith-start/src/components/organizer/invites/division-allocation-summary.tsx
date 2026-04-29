"use client"

/**
 * Division Allocation Summary — top-of-page card on the organizer invites
 * route. Renders one collapsible row per championship division with the
 * total spots allocated across every qualification source. Expanding a
 * row shows the per-source breakdown so the organizer can see exactly
 * which sources contribute spots to that division.
 *
 * Reads the same `allocationsBySourceByDivision` map the loader feeds to
 * the Sources / Sent tabs — single source of truth for resolved spots
 * per (source, championship-division). Each source's quota is enforced
 * independently at claim time + Stripe re-check (see
 * [[apps/wodsmith-start/src/server/competition-invites/claim.ts#getAcceptedPaidCountForBucket]]),
 * so this view's per-source breakdown matches the runtime enforcement
 * scoping the organizer cares about.
 */
// @lat: [[competition-invites#Division allocation summary]]

import { ChevronRight, Layers, Trophy } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMPETITION_INVITE_SOURCE_KIND,
  type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"
import { cn } from "@/utils/cn"

interface DivisionAllocationSummaryProps {
  divisions: ReadonlyArray<{ id: string; label: string }>
  sources: ReadonlyArray<CompetitionInviteSource>
  /** Resolved per-(source, championship-division) allocation map from
   *  `listInviteSourceAllocationsFn`. Drives both the per-division total
   *  and the per-source breakdown. */
  allocationsBySourceByDivision: Record<string, Record<string, number>>
  competitionNamesById?: Record<string, string>
  seriesNamesById?: Record<string, string>
}

function sourceLabel(
  source: CompetitionInviteSource,
  competitionNamesById: Record<string, string> | undefined,
  seriesNamesById: Record<string, string> | undefined,
): string {
  if (source.kind === COMPETITION_INVITE_SOURCE_KIND.SERIES) {
    return source.sourceGroupId
      ? (seriesNamesById?.[source.sourceGroupId] ?? "Unknown series")
      : "Unknown series"
  }
  return source.sourceCompetitionId
    ? (competitionNamesById?.[source.sourceCompetitionId] ??
        "Unknown competition")
    : "Unknown competition"
}

export function DivisionAllocationSummary({
  divisions,
  sources,
  allocationsBySourceByDivision,
  competitionNamesById,
  seriesNamesById,
}: DivisionAllocationSummaryProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())

  const setOpen = (divisionId: string, next: boolean) => {
    setOpenIds((prev) => {
      const out = new Set(prev)
      if (next) out.add(divisionId)
      else out.delete(divisionId)
      return out
    })
  }

  if (divisions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation by division</CardTitle>
          <CardDescription>
            This championship has no divisions yet — add divisions to see spot
            allocations.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Per-division breakdown: list of {source, spots} pairs where spots > 0.
  // Computed inline rather than memoized — divisions count is bounded
  // and the parent re-renders on filter / nav events anyway.
  const divisionBreakdowns = divisions.map((division) => {
    const breakdown = sources
      .map((source) => ({
        source,
        spots: allocationsBySourceByDivision[source.id]?.[division.id] ?? 0,
      }))
      .filter((entry) => entry.spots > 0)
    const total = breakdown.reduce((acc, entry) => acc + entry.spots, 0)
    return { division, breakdown, total }
  })

  const championshipTotal = divisionBreakdowns.reduce(
    (acc, d) => acc + d.total,
    0,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation by division</CardTitle>
        <CardDescription>
          How qualifying spots are distributed across championship divisions.
          Each source's quota is enforced independently — accepted invites from
          one source never consume another source's spots. Click a division to
          see the per-source breakdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline justify-between rounded-md bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Total qualifying spots across {divisions.length} division
            {divisions.length === 1 ? "" : "s"}
          </span>
          <span className="font-semibold tabular-nums">
            {championshipTotal}
          </span>
        </div>
        <div className="space-y-1">
          {divisionBreakdowns.map(({ division, breakdown, total }) => {
            const isOpen = openIds.has(division.id)
            const hasBreakdown = breakdown.length > 0
            return (
              <Collapsible
                key={division.id}
                open={isOpen}
                onOpenChange={(next) => setOpen(division.id, next)}
              >
                <CollapsibleTrigger
                  disabled={!hasBreakdown}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-md border bg-card px-4 py-3 text-left transition-colors",
                    hasBreakdown
                      ? "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      : "cursor-default opacity-80",
                  )}
                  aria-label={`${division.label}: ${total} spots${
                    hasBreakdown ? ", expand to see sources" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                        !hasBreakdown && "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate font-medium">
                      {division.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-2 text-sm">
                    <span className="text-2xl font-semibold tabular-nums leading-none">
                      {total}
                    </span>
                    <span className="text-muted-foreground">
                      {total === 1 ? "spot" : "spots"}
                      {hasBreakdown ? (
                        <>
                          {" · "}
                          {breakdown.length}{" "}
                          {breakdown.length === 1 ? "source" : "sources"}
                        </>
                      ) : null}
                    </span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="rounded-b-md border border-t-0 bg-muted/20 px-4 pb-3 pt-1">
                    {hasBreakdown ? (
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Source
                            </TableHead>
                            <TableHead className="w-32 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Spots
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {breakdown.map(({ source, spots }) => {
                            const isSeries =
                              source.kind ===
                              COMPETITION_INVITE_SOURCE_KIND.SERIES
                            const Icon = isSeries ? Layers : Trophy
                            const label = sourceLabel(
                              source,
                              competitionNamesById,
                              seriesNamesById,
                            )
                            return (
                              <TableRow key={source.id}>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                                      <Icon
                                        className="h-3.5 w-3.5"
                                        aria-hidden="true"
                                      />
                                    </div>
                                    <span className="min-w-0 truncate font-medium">
                                      {label}
                                    </span>
                                    <Badge
                                      variant={
                                        isSeries ? "default" : "secondary"
                                      }
                                      className="font-normal"
                                    >
                                      {isSeries ? "Series" : "Competition"}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold">
                                  {spots}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
