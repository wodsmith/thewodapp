"use client"

/**
 * Championship Roster Table — Phase 1 read-only view.
 *
 * Renders rank + athlete + source + status columns for each row, with
 * filter chips above and a dashed cutoff separator between qualified and
 * waitlist rows. Invite state is always `not_invited` in Phase 1;
 * Phase 2 attaches real invite status and the StatusPill becomes live.
 */

import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RosterRow } from "@/server/competition-invites/roster"

interface ChampionshipRosterTableProps {
  rows: RosterRow[]
}

function RankCell({ placement }: { placement: number | null }) {
  return (
    <span className="tabular-nums font-medium">
      {placement != null ? `#${placement}` : "—"}
    </span>
  )
}

function AthleteAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {initial}
    </div>
  )
}

function SourceTag({ row }: { row: RosterRow }) {
  const label = row.sourcePlacementLabel ?? row.sourceKind
  return <Badge variant="outline">{label}</Badge>
}

function StatusPill() {
  // Phase 1: everyone is `not_invited`.
  return <Badge variant="secondary">Not invited</Badge>
}

function FilterChips() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">All</Badge>
      <Badge variant="outline">Not invited</Badge>
      <Badge variant="outline">Pending</Badge>
      <Badge variant="outline">Accepted</Badge>
      <Badge variant="outline">Declined</Badge>
    </div>
  )
}

export function ChampionshipRosterTable({
  rows,
}: ChampionshipRosterTableProps) {
  let cutoffDrawn = false

  return (
    <div className="space-y-4">
      <FilterChips />
      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No qualifying rows yet — add a source to build the roster.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Athlete</TableHead>
              <TableHead>Qualified via</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const showCutoff = row.belowCutoff && !cutoffDrawn
              if (showCutoff) cutoffDrawn = true
              const rowKey = `${row.sourceId}-${row.userId ?? row.athleteName}`
              return (
                <Fragment key={rowKey}>
                  {showCutoff ? (
                    <TableRow className="border-t-2 border-dashed">
                      <TableCell
                        colSpan={4}
                        className="py-2 text-center text-xs uppercase text-muted-foreground"
                      >
                        Cutoff · waitlist begins
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow>
                    <TableCell>
                      <RankCell placement={row.sourcePlacement} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AthleteAvatar name={row.athleteName} />
                        <span>{row.athleteName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SourceTag row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusPill />
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
