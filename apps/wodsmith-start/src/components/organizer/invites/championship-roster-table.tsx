"use client"

/**
 * Championship Roster Table.
 *
 * Renders rank + athlete + source + status columns for each row, with
 * filter chips above and a dashed cutoff separator between qualified and
 * waitlist rows.
 *
 * Phase 2 adds optional per-row selection checkboxes for the Send Invites
 * flow. Rows without an email (no userId resolved from `userTable`) are
 * marked non-selectable — the organizer sees a tooltip-hint via
 * `title="No email on file"`.
 */

import { Fragment } from "react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RosterRow } from "@/server/competition-invites/roster"

export function rosterRowKey(row: RosterRow): string {
  return `${row.sourceId}-${row.userId ?? row.athleteName}`
}

interface ChampionshipRosterTableProps {
  rows: RosterRow[]
  /** Optional selection state. When provided the table renders a
   *  checkbox column; when omitted the table is read-only. */
  selectedKeys?: Set<string>
  onToggleSelection?: (key: string, row: RosterRow) => void
  onToggleAll?: (selectAll: boolean) => void
  /** Returns true when the row has an active invite (pending/accepted)
   *  so the table can render the "Invited" status pill and disable the
   *  row's checkbox. Without this, the row would render as "Not invited"
   *  and let the organizer tick a box that the parent silently drops. */
  isRowAlreadyInvited?: (row: RosterRow) => boolean
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

function StatusPill({ alreadyInvited }: { alreadyInvited: boolean }) {
  if (alreadyInvited) {
    return <Badge>Invited</Badge>
  }
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
  selectedKeys,
  onToggleSelection,
  onToggleAll,
  isRowAlreadyInvited,
}: ChampionshipRosterTableProps) {
  let cutoffDrawn = false
  const selectionEnabled =
    !!selectedKeys && !!onToggleSelection && !!onToggleAll
  const isInvited = (r: RosterRow) => !!isRowAlreadyInvited?.(r)
  const selectableRows = rows.filter(
    (r) => !!r.athleteEmail && !isInvited(r),
  )
  const allSelected =
    selectionEnabled &&
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedKeys?.has(rosterRowKey(r)))
  const colSpan = selectionEnabled ? 5 : 4

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
              {selectionEnabled ? (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => onToggleAll?.(v === true)}
                    aria-label="Select all rows"
                  />
                </TableHead>
              ) : null}
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
              const rowKey = rosterRowKey(row)
              const rowAlreadyInvited = isInvited(row)
              const rowSelectable =
                selectionEnabled && !!row.athleteEmail && !rowAlreadyInvited
              return (
                <Fragment key={rowKey}>
                  {showCutoff ? (
                    <TableRow className="border-t-2 border-dashed">
                      <TableCell
                        colSpan={colSpan}
                        className="py-2 text-center text-xs uppercase text-muted-foreground"
                      >
                        Cutoff · waitlist begins
                      </TableCell>
                    </TableRow>
                  ) : null}
                  <TableRow>
                    {selectionEnabled ? (
                      <TableCell>
                        <Checkbox
                          checked={selectedKeys?.has(rowKey) ?? false}
                          disabled={!rowSelectable}
                          onCheckedChange={() =>
                            rowSelectable &&
                            onToggleSelection?.(rowKey, row)
                          }
                          aria-label={`Select ${row.athleteName}`}
                          title={
                            rowSelectable
                              ? undefined
                              : rowAlreadyInvited
                                ? "Already invited"
                                : "No email on file for this athlete"
                          }
                        />
                      </TableCell>
                    ) : null}
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
                      <StatusPill alreadyInvited={rowAlreadyInvited} />
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
