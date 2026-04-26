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

import { Copy } from "lucide-react"
import { Fragment } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  /** When provided the table renders an Actions column with a "Copy
   *  invite link" affordance. Returns the claim URL for the row, or
   *  null when the row has no live token (draft / not-yet-sent /
   *  terminal). */
  getInviteUrlForRow?: (row: RosterRow) => string | null
}

async function copyInviteLink(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url)
    toast.success("Invite link copied")
  } catch {
    console.warn("Failed to copy invite link")
    toast.error("Couldn't copy invite link")
  }
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
    return (
      <Badge className="border-transparent bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20">
        Invited
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Not invited
    </Badge>
  )
}

export function ChampionshipRosterTable({
  rows,
  selectedKeys,
  onToggleSelection,
  onToggleAll,
  isRowAlreadyInvited,
  getInviteUrlForRow,
}: ChampionshipRosterTableProps) {
  let cutoffDrawn = false
  const selectionEnabled =
    !!selectedKeys && !!onToggleSelection && !!onToggleAll
  const actionsEnabled = !!getInviteUrlForRow
  const isInvited = (r: RosterRow) => !!isRowAlreadyInvited?.(r)
  const selectableRows = rows.filter(
    (r) => !!r.athleteEmail && !isInvited(r),
  )
  const allSelected =
    selectionEnabled &&
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedKeys?.has(rosterRowKey(r)))
  const colSpan =
    (selectionEnabled ? 1 : 0) + 4 + (actionsEnabled ? 1 : 0)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">
          No qualifying rows yet — add a source to build the roster.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
              {selectionEnabled ? (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => onToggleAll?.(v === true)}
                    aria-label="Select all rows"
                  />
                </TableHead>
              ) : null}
              <TableHead className="w-20 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Rank
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Athlete
              </TableHead>
              <TableHead className="w-48 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Qualified via
              </TableHead>
              <TableHead className="w-32 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </TableHead>
              {actionsEnabled ? (
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
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
                        <div className="flex flex-col leading-tight">
                          <span>{row.athleteName}</span>
                          {row.athleteEmail ? (
                            <span className="text-xs text-muted-foreground">
                              {row.athleteEmail}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <SourceTag row={row} />
                    </TableCell>
                    <TableCell>
                      <StatusPill alreadyInvited={rowAlreadyInvited} />
                    </TableCell>
                    {actionsEnabled ? (
                      <TableCell className="text-right">
                        {(() => {
                          const url = getInviteUrlForRow?.(row) ?? null
                          if (!url) return null
                          return (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Copy invite link"
                              className="text-muted-foreground hover:text-foreground"
                              onClick={() => copyInviteLink(url)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )
                        })()}
                      </TableCell>
                    ) : null}
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
