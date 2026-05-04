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

import { ArrowRight, ChevronDown, Copy, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMPETITION_INVITE_STATUS,
  type CompetitionInviteStatus,
} from "@/db/schemas/competition-invites"
import type { RosterRow } from "@/server/competition-invites/roster"
import { cn } from "@/utils/cn"

type RowInviteStatus = Extract<
  CompetitionInviteStatus,
  "pending" | "accepted_paid" | "declined"
>

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
  /** Returns the row's invite status so the table can render the status
   *  pill ("Registered" for `accepted_paid`, "Invited" for `pending`,
   *  "Declined" when the athlete declined, "Not invited" when null).
   *  Pending and accepted invites disable the row's checkbox; "declined"
   *  is informational only — the organizer can re-issue. Without this,
   *  the row would render as "Not invited" and let the organizer tick a
   *  box that the parent silently drops. */
  getInviteStatusForRow?: (row: RosterRow) => RowInviteStatus | null
  /** When provided the table renders an Actions column with a "Copy
   *  invite link" affordance. Returns the claim URL for the row, or
   *  null when the row has no live token (draft / not-yet-sent /
   *  terminal). */
  getInviteUrlForRow?: (row: RosterRow) => string | null
  /** ADR-0012 Phase 4: resolved per-(source, championship-division)
   *  allocation map. When supplied alongside `championshipDivisions`,
   *  the table renders a small "Allocates N to {Division}" banner per
   *  unique `(sourceId, sourceDivisionLabel)` group present in the rows.
   *  Optional so unit tests and other consumers can omit. */
  allocationsBySourceByDivision?: Record<string, Record<string, number>>
  /** Championship divisions used to map a source-division label to the
   *  championship division that receives its allocation. Required for
   *  the allocation banner; without it the banner is suppressed. */
  championshipDivisions?: ReadonlyArray<{ id: string; label: string }>
}

interface AllocationSummaryEntry {
  sourceId: string
  sourceCompetitionName: string
  sourceDivisionLabel: string
  championshipDivisionLabel: string | null
  allocation: number
}

function buildAllocationSummary(
  rows: RosterRow[],
  allocationsBySourceByDivision: Record<string, Record<string, number>>,
  championshipDivisions: ReadonlyArray<{ id: string; label: string }>,
): AllocationSummaryEntry[] {
  // Group rows by `(sourceId, sourceDivisionLabel)` since label is what
  // we use to reach the championship-division id (source-division and
  // championship-division ids live in different scaling groups). Same
  // matching strategy the parent route uses for `defaultDivisionId`.
  const seen = new Map<string, AllocationSummaryEntry>()
  for (const row of rows) {
    const key = `${row.sourceId}::${row.sourceDivisionLabel}`
    if (seen.has(key)) continue
    const normalized = row.sourceDivisionLabel.trim().toLowerCase()
    const champDiv = championshipDivisions.find(
      (d) => d.label.trim().toLowerCase() === normalized,
    )
    const allocation = champDiv
      ? (allocationsBySourceByDivision[row.sourceId]?.[champDiv.id] ?? 0)
      : 0
    seen.set(key, {
      sourceId: row.sourceId,
      sourceCompetitionName: row.sourceCompetitionName,
      sourceDivisionLabel: row.sourceDivisionLabel,
      championshipDivisionLabel: champDiv?.label ?? null,
      allocation,
    })
  }
  return Array.from(seen.values())
}

function AllocationChip({ entry }: { entry: AllocationSummaryEntry }) {
  const sourceLabel = entry.sourceDivisionLabel
  const targetLabel = entry.championshipDivisionLabel
  const remap = targetLabel !== null && targetLabel !== sourceLabel
  return (
    <span
      className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 py-0.5 pl-2 pr-1 text-xs text-foreground transition-colors hover:border-border"
      title={`${entry.sourceCompetitionName} · ${sourceLabel}${
        remap ? ` → ${targetLabel}` : ""
      }`}
    >
      <span className="font-medium">{sourceLabel}</span>
      {remap ? (
        <>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">{targetLabel}</span>
        </>
      ) : null}
      <span className="ml-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
        Top {entry.allocation}
      </span>
    </span>
  )
}

function UnallocatedPopover({
  entries,
}: {
  entries: AllocationSummaryEntry[]
}) {
  const grouped = new Map<string, AllocationSummaryEntry[]>()
  for (const entry of entries) {
    const key = `${entry.sourceId}::${entry.sourceCompetitionName}`
    const list = grouped.get(key)
    if (list) list.push(entry)
    else grouped.set(key, [entry])
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-xs text-amber-300 transition-colors hover:bg-amber-500/10"
        >
          <TriangleAlert className="h-3 w-3" />
          <span className="tabular-nums font-medium">{entries.length}</span>
          <span>unallocated</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Unallocated source divisions
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            No matching championship division — won't qualify anyone.
          </div>
        </div>
        <div className="max-h-72 space-y-3 overflow-y-auto p-3">
          {Array.from(grouped.values()).map((group) => {
            const first = group[0]
            return (
              <div key={`${first.sourceId}::${first.sourceCompetitionName}`}>
                <div className="text-[11px] font-medium text-foreground">
                  {first.sourceCompetitionName}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {group.map((entry) => (
                    <li
                      key={`${entry.sourceId}::${entry.sourceDivisionLabel}`}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <span>{entry.sourceDivisionLabel}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                        no match
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AllocationStrip({
  allocated,
  unallocated,
  totalSources,
  totalQualifying,
}: {
  allocated: AllocationSummaryEntry[]
  unallocated: AllocationSummaryEntry[]
  totalSources: number
  totalQualifying: number
}) {
  const hasAllocations = allocated.length > 0
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border bg-muted/20 px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Qualifies
        </span>
        <span className="text-xs text-foreground">
          <span className="font-semibold tabular-nums">{totalQualifying}</span>
          <span className="text-muted-foreground"> · </span>
          <span className="tabular-nums">
            {allocated.length}/{totalSources}
          </span>
          <span className="text-muted-foreground"> sources</span>
        </span>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          !hasAllocations && "text-muted-foreground",
        )}
      >
        {hasAllocations ? (
          allocated.map((entry) => (
            <AllocationChip
              key={`${entry.sourceId}::${entry.sourceDivisionLabel}`}
              entry={entry}
            />
          ))
        ) : (
          <span className="text-xs italic">No allocations configured yet.</span>
        )}
        {unallocated.length > 0 ? (
          <UnallocatedPopover entries={unallocated} />
        ) : null}
      </div>
    </div>
  )
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

function StatusPill({ status }: { status: RowInviteStatus | null }) {
  // `variant="outline"` for all — the default variant's `dark:bg-primary`
  // would otherwise paint over the colored tints in dark mode.
  if (status === COMPETITION_INVITE_STATUS.ACCEPTED_PAID) {
    return (
      <Badge
        variant="outline"
        className="border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:border-sky-500/50"
      >
        Registered
      </Badge>
    )
  }
  if (status === COMPETITION_INVITE_STATUS.PENDING) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
      >
        Invited
      </Badge>
    )
  }
  if (status === COMPETITION_INVITE_STATUS.DECLINED) {
    return (
      <Badge
        variant="outline"
        className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50"
      >
        Declined
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
  getInviteStatusForRow,
  getInviteUrlForRow,
  allocationsBySourceByDivision,
  championshipDivisions,
}: ChampionshipRosterTableProps) {
  const selectionEnabled =
    !!selectedKeys && !!onToggleSelection && !!onToggleAll
  const actionsEnabled = !!getInviteUrlForRow
  const inviteStatusFor = (r: RosterRow) => getInviteStatusForRow?.(r) ?? null
  // "Already invited" gates the row's checkbox. Declined doesn't gate —
  // the organizer can stage them again and re-issue. Pending and
  // accepted_paid rows stay locked because the parent silently drops
  // them on send.
  const isInvited = (r: RosterRow) => {
    const status = inviteStatusFor(r)
    return (
      status === COMPETITION_INVITE_STATUS.PENDING ||
      status === COMPETITION_INVITE_STATUS.ACCEPTED_PAID
    )
  }
  const selectableRows = rows.filter((r) => !!r.athleteEmail && !isInvited(r))
  const allSelected =
    selectionEnabled &&
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedKeys?.has(rosterRowKey(r)))

  const allocationSummary =
    allocationsBySourceByDivision && championshipDivisions
      ? buildAllocationSummary(
          rows,
          allocationsBySourceByDivision,
          championshipDivisions,
        )
      : []

  const allocatedEntries = allocationSummary.filter(
    (e) => e.championshipDivisionLabel !== null && e.allocation > 0,
  )
  const unallocatedEntries = allocationSummary.filter(
    (e) => e.championshipDivisionLabel === null || e.allocation <= 0,
  )
  const totalQualifying = allocatedEntries.reduce(
    (sum, e) => sum + e.allocation,
    0,
  )

  return (
    <div className="space-y-2">
      {allocationSummary.length > 0 ? (
        <AllocationStrip
          allocated={allocatedEntries}
          unallocated={unallocatedEntries}
          totalSources={allocationSummary.length}
          totalQualifying={totalQualifying}
        />
      ) : null}
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
                <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Athlete
                </TableHead>
                <TableHead className="w-56 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Competition
                </TableHead>
                <TableHead className="w-40 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Division
                </TableHead>
                <TableHead className="w-16 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Rank
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
                const rowInviteStatus = inviteStatusFor(row)
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
                      <RankCell placement={row.sourcePlacement} />
                    </TableCell>
                    <TableCell>
                      <StatusPill status={rowInviteStatus} />
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
    </div>
  )
}
