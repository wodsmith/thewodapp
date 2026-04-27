"use client"

/**
 * Championship Roster Table.
 *
 * Renders rank + athlete + source + status columns for the leaderboard of
 * the currently-filtered (sourceCompetitionId, sourceDivisionId). The
 * organizer ticks rows to stage them as recipients; the parent route
 * routes those into the Send Invites dialog where the championship
 * division is chosen at submit time.
 *
 * Rows without an email (no userId resolved from `userTable`) are marked
 * non-selectable — the organizer sees a tooltip-hint via `title="No
 * email on file"`.
 */

import { Copy } from "lucide-react"
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
  // Include sourceCompetitionId + sourceDivisionId in the key so series
  // sources — where the same `sourceId` produces rows across multiple
  // (comp, division) leaderboards — generate one unique key per row.
  // Without this, the same athlete placing in multiple stops collides
  // on the same key, triggering React key warnings and making the
  // selection set tick every duplicate at once.
  return `${row.sourceId}-${row.sourceCompetitionId}-${row.sourceDivisionId}-${row.userId ?? row.athleteName}`
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

function CompetitionCell({ row }: { row: RosterRow }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm">{row.sourceCompetitionName}</span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {row.sourceKind === "series" ? "Series" : "Single comp"}
      </span>
    </div>
  )
}

function DivisionCell({ row }: { row: RosterRow }) {
  return <Badge variant="outline">{row.sourceDivisionLabel}</Badge>
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
  const selectionEnabled =
    !!selectedKeys && !!onToggleSelection && !!onToggleAll
  const actionsEnabled = !!getInviteUrlForRow
  const isInvited = (r: RosterRow) => !!isRowAlreadyInvited?.(r)
  const selectableRows = rows.filter((r) => !!r.athleteEmail && !isInvited(r))
  const allSelected =
    selectionEnabled &&
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedKeys?.has(rosterRowKey(r)))

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
              <TableHead className="w-16 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Rank
              </TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Athlete
              </TableHead>
              <TableHead className="w-56 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Competition
              </TableHead>
              <TableHead className="w-40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Division
              </TableHead>
              <TableHead className="w-28 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
              const rowKey = rosterRowKey(row)
              const rowAlreadyInvited = isInvited(row)
              const rowSelectable =
                selectionEnabled && !!row.athleteEmail && !rowAlreadyInvited
              return (
                <TableRow key={rowKey}>
                  {selectionEnabled ? (
                    <TableCell>
                      <Checkbox
                        checked={selectedKeys?.has(rowKey) ?? false}
                        disabled={!rowSelectable}
                        onCheckedChange={() =>
                          rowSelectable && onToggleSelection?.(rowKey, row)
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
                    <CompetitionCell row={row} />
                  </TableCell>
                  <TableCell>
                    <DivisionCell row={row} />
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
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
