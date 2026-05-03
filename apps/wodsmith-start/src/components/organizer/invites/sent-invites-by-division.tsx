"use client"

/**
 * Sent invites — audit view grouped by championship division.
 *
 * Renders one card per division (using the championshipDivisions
 * ordering supplied by the route loader) with a status counter row,
 * page-level filter row, and per-division tables. Filters reduce row
 * count inside each card; cards stay rendered with empty-state copy so
 * the organizer always sees the full division layout.
 *
 * Reads the `AuditInviteSummary` projection returned by
 * `listAllInvitesFn`. No mutations live here — revoke / reissue / resend
 * stay in the round builder (Phase 3 / sub-arc D). The single per-row
 * action is "copy live claim link" for rows where `claimUrl !== null`.
 */
// @lat: [[competition-invites#Sent invites tab]]

import { Copy } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMPETITION_INVITE_ORIGIN,
  COMPETITION_INVITE_STATUS,
  type CompetitionInviteSource,
} from "@/db/schemas/competition-invites"
import type { AuditInviteSummary } from "@/server-fns/competition-invite-fns"

type StatusKey = "pending" | "accepted" | "declined" | "expired" | "revoked"
type OriginKey = "source" | "bespoke"
type StatusFilter = StatusKey | "all"
type OriginFilter = OriginKey | "all"

const STATUS_KEYS: StatusKey[] = [
  "pending",
  "accepted",
  "declined",
  "expired",
  "revoked",
]

interface SentInvitesByDivisionProps {
  invites: AuditInviteSummary[]
  divisions: ReadonlyArray<{
    id: string
    label: string
    /** Resolved invite-allocation total across sources for this championship
     *  division (sum of `allocationsBySourceByDivision[sourceId][divisionId]`
     *  for every source feeding this championship). `null` when the resolved
     *  total is `0` so the component falls back to the "X accepted" rendering
     *  for divisions with no allocation. */
    maxSpots?: number | null
  }>
  /** Qualification sources feeding the championship. Used to break down
   *  "X/Y accepted" per source under each division card so the organizer
   *  can track who still owes invites to which source. Optional so older
   *  callers (and the unit tests) can omit it. */
  sources?: CompetitionInviteSource[]
  /** Competition-name lookup for source-name resolution (kind: "competition"). */
  competitionNamesById?: Record<string, string>
  /** Series-name lookup for source-name resolution (kind: "series"). */
  seriesNamesById?: Record<string, string>
  /** Resolved per-(source, championship-division) allocation map from the
   *  loader (`listInviteSourceAllocationsFn`). The chip's `allocated` value
   *  is read directly from this map — the component no longer parses
   *  `competitionInviteSourcesTable.divisionMappings` JSON. Optional so
   *  older callers / tests can omit; missing entries default to 0. */
  allocationsBySourceByDivision?: Record<string, Record<string, number>>
}

/** Sentinel key for invites with no source (bespoke origin). Module-scoped
 *  so it stays referentially stable across renders — important for the
 *  exhaustive-deps lint rule on the memo that uses it. */
const BESPOKE_BUCKET = "__bespoke__" as const

function sourceName(
  source: CompetitionInviteSource,
  competitionNamesById: Record<string, string>,
  seriesNamesById: Record<string, string>,
): string {
  if (source.kind === "series") {
    return source.sourceGroupId
      ? (seriesNamesById[source.sourceGroupId] ?? "Unknown series")
      : "Unknown series"
  }
  return source.sourceCompetitionId
    ? (competitionNamesById[source.sourceCompetitionId] ??
        "Unknown competition")
    : "Unknown competition"
}

/**
 * Map an invite's `status` (which carries `pending` / `accepted_paid` /
 * `declined` / `expired` / `revoked`) onto the audit-view status key.
 * `accepted_paid` collapses to `accepted` because the audit view's
 * counter row is "Accepted", not "Accepted (Paid)" — the paid state is
 * the only acceptance in this system today.
 */
function statusKeyFor(invite: AuditInviteSummary): StatusKey {
  switch (invite.status) {
    case COMPETITION_INVITE_STATUS.PENDING:
      return "pending"
    case COMPETITION_INVITE_STATUS.ACCEPTED_PAID:
      return "accepted"
    case COMPETITION_INVITE_STATUS.DECLINED:
      return "declined"
    case COMPETITION_INVITE_STATUS.EXPIRED:
      return "expired"
    case COMPETITION_INVITE_STATUS.REVOKED:
      return "revoked"
  }
}

function statusLabel(key: StatusKey): string {
  switch (key) {
    case "pending":
      return "Pending"
    case "accepted":
      return "Accepted"
    case "declined":
      return "Declined"
    case "expired":
      return "Expired"
    case "revoked":
      return "Revoked"
  }
}

// Status palette — each state gets its own hue so the row scans at a
// glance: emerald = accepted, amber = pending/in-flight, rose =
// declined, zinc = terminal (expired/revoked). Pair with
// `variant="outline"` on the Badge — the default variant ships
// `dark:bg-primary` which would override these tints in dark mode.
function statusBadgeClass(key: StatusKey): string {
  switch (key) {
    case "accepted":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/50"
    case "pending":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50"
    case "declined":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/50"
    case "expired":
    case "revoked":
      return "border-zinc-500/30 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20"
  }
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "—"
  const ts = date instanceof Date ? date.getTime() : new Date(date).getTime()
  if (Number.isNaN(ts)) return "—"
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 60) return "just now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  const diffMo = Math.round(diffDay / 30)
  if (diffMo < 12) return `${diffMo}mo ago`
  return `${Math.round(diffMo / 12)}y ago`
}

function nameForInvite(invite: AuditInviteSummary): string {
  return (
    [invite.inviteeFirstName, invite.inviteeLastName]
      .filter(Boolean)
      .join(" ") || invite.email
  )
}

/**
 * "Times sent" for the row. New rows have `sendAttempt = 0` (= "sent
 * once" once dispatched), and each reissue increments by one — so the
 * user-facing count is `sendAttempt + 1`. A draft (no token, no send
 * attempts) reads as 0 so the badge stays hidden until something
 * actually went out.
 */
function sendCountForInvite(invite: AuditInviteSummary): number {
  if (invite.claimUrl === null && invite.sendAttempt === 0) return 0
  return invite.sendAttempt + 1
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Invite link copied")
  } catch {
    toast.error("Couldn't copy invite link. Please copy it manually.")
  }
}

export function SentInvitesByDivision({
  invites,
  divisions,
  sources = [],
  competitionNamesById = {},
  seriesNamesById = {},
  allocationsBySourceByDivision = {},
}: SentInvitesByDivisionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("all")
  const [searchText, setSearchText] = useState("")

  const trimmedSearch = searchText.trim().toLowerCase()

  const filteredInvites = useMemo(() => {
    return invites.filter((inv) => {
      if (statusFilter !== "all" && statusKeyFor(inv) !== statusFilter) {
        return false
      }
      if (originFilter !== "all" && inv.origin !== originFilter) {
        return false
      }
      if (trimmedSearch) {
        const haystack = `${nameForInvite(inv)} ${inv.email}`.toLowerCase()
        if (!haystack.includes(trimmedSearch)) return false
      }
      return true
    })
  }, [invites, statusFilter, originFilter, trimmedSearch])

  // Build per-division group + per-division status counters from the
  // *unfiltered* set so the counters reflect totals (not "totals after
  // your current filter narrows them"). This matches typical audit-UI
  // expectations — the counter row tells you what's in the bucket; the
  // filter narrows what you see in the table.
  const invitesByDivisionFiltered = useMemo(() => {
    const map = new Map<string, AuditInviteSummary[]>()
    for (const inv of filteredInvites) {
      const list = map.get(inv.championshipDivisionId) ?? []
      list.push(inv)
      map.set(inv.championshipDivisionId, list)
    }
    return map
  }, [filteredInvites])

  // Accepted-invite counts grouped by `(divisionId, sourceId)` — built
  // from the unfiltered set so the per-source breakdown reflects truth,
  // not "what's currently visible". Bespoke invites land under the
  // sentinel `BESPOKE_BUCKET` so the renderer can show them as a
  // separate row without mistaking a `null` source-id for a missing
  // source row.
  const acceptedBySourceByDivision = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const inv of invites) {
      if (inv.status !== COMPETITION_INVITE_STATUS.ACCEPTED_PAID) continue
      const divisionMap = map.get(inv.championshipDivisionId) ?? new Map()
      const bucket =
        inv.origin === COMPETITION_INVITE_ORIGIN.BESPOKE
          ? BESPOKE_BUCKET
          : (inv.sourceId ?? BESPOKE_BUCKET)
      divisionMap.set(bucket, (divisionMap.get(bucket) ?? 0) + 1)
      map.set(inv.championshipDivisionId, divisionMap)
    }
    return map
  }, [invites])

  const countersByDivision = useMemo(() => {
    const map = new Map<string, Record<StatusKey, number>>()
    for (const inv of invites) {
      const current =
        map.get(inv.championshipDivisionId) ??
        ({
          pending: 0,
          accepted: 0,
          declined: 0,
          expired: 0,
          revoked: 0,
        } as Record<StatusKey, number>)
      current[statusKeyFor(inv)] += 1
      map.set(inv.championshipDivisionId, current)
    }
    return map
  }, [invites])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            label="All statuses"
          />
          {STATUS_KEYS.map((key) => (
            <FilterChip
              key={key}
              active={statusFilter === key}
              onClick={() => setStatusFilter(key)}
              label={statusLabel(key)}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip
            active={originFilter === "all"}
            onClick={() => setOriginFilter("all")}
            label="All origins"
          />
          <FilterChip
            active={originFilter === "source"}
            onClick={() => setOriginFilter("source")}
            label="Source"
          />
          <FilterChip
            active={originFilter === "bespoke"}
            onClick={() => setOriginFilter("bespoke")}
            label="Bespoke"
          />
        </div>
        <div className="ml-auto w-full max-w-xs">
          <Input
            type="search"
            placeholder="Search name or email"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search invites by name or email"
          />
        </div>
      </div>

      {divisions.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No championship divisions configured.
        </div>
      ) : (
        divisions.map((division) => {
          const rows = invitesByDivisionFiltered.get(division.id) ?? []
          const counters =
            countersByDivision.get(division.id) ??
            ({
              pending: 0,
              accepted: 0,
              declined: 0,
              expired: 0,
              revoked: 0,
            } as Record<StatusKey, number>)
          const acceptedCount = counters.accepted
          const maxSpots = division.maxSpots ?? null
          const spotsFilledLabel =
            maxSpots !== null
              ? `${acceptedCount}/${maxSpots} spots filled`
              : `${acceptedCount} accepted`

          // Per-source breakdown: every source that allocates spots to
          // this division gets a chip "<source>: accepted/allocated".
          // Bespoke invites are tracked separately (no allocation, so
          // shown as "Bespoke: N" with em-dash for the denominator).
          const acceptedBySource =
            acceptedBySourceByDivision.get(division.id) ?? new Map()
          const sourceBreakdown = sources
            .map((src) => {
              const allocated =
                allocationsBySourceByDivision[src.id]?.[division.id] ?? 0
              const accepted = acceptedBySource.get(src.id) ?? 0
              if (allocated === 0 && accepted === 0) return null
              return {
                key: src.id,
                label: sourceName(src, competitionNamesById, seriesNamesById),
                accepted,
                allocated,
              }
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
          const bespokeAccepted = acceptedBySource.get(BESPOKE_BUCKET) ?? 0
          if (bespokeAccepted > 0) {
            sourceBreakdown.push({
              key: BESPOKE_BUCKET,
              label: "Bespoke",
              accepted: bespokeAccepted,
              allocated: 0,
            })
          }

          return (
            <Card key={division.id}>
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <CardTitle className="text-base font-semibold tracking-tight">
                      {division.label}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {spotsFilledLabel}
                    </span>
                    {sourceBreakdown.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {sourceBreakdown.map((b) => (
                          <span
                            key={b.key}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
                            title={`${b.label}: ${b.accepted} accepted${
                              b.allocated > 0
                                ? ` of ${b.allocated} allocated spots`
                                : ""
                            }`}
                          >
                            <span className="font-medium text-foreground">
                              {b.label}
                            </span>
                            <span className="tabular-nums">
                              {b.accepted}/{b.allocated > 0 ? b.allocated : "—"}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {rows.length} of{" "}
                    {STATUS_KEYS.reduce((sum, k) => sum + counters[k], 0)}{" "}
                    invite
                    {STATUS_KEYS.reduce((sum, k) => sum + counters[k], 0) === 1
                      ? ""
                      : "s"}{" "}
                    shown
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {STATUS_KEYS.map((key) => (
                    <CounterChip
                      key={key}
                      active={statusFilter === key}
                      onClick={() =>
                        setStatusFilter(statusFilter === key ? "all" : key)
                      }
                      label={statusLabel(key)}
                      count={counters[key]}
                    />
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {rows.length === 0 ? (
                  <div className="border-t p-6 text-center text-sm text-muted-foreground">
                    No invites in this division match the current filters.
                  </div>
                ) : (
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b bg-muted/30 hover:bg-muted/30">
                          <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Athlete
                          </TableHead>
                          <TableHead className="w-24 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Origin
                          </TableHead>
                          <TableHead className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Source attribution
                          </TableHead>
                          <TableHead className="w-32 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Status
                          </TableHead>
                          <TableHead className="w-20 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Sends
                          </TableHead>
                          <TableHead className="w-24 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            Updated
                          </TableHead>
                          <TableHead className="w-16 text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((inv) => {
                          const name = nameForInvite(inv)
                          const initial = name.charAt(0).toUpperCase()
                          const sKey = statusKeyFor(inv)
                          const sendCount = sendCountForInvite(inv)
                          const attribution =
                            inv.origin === COMPETITION_INVITE_ORIGIN.SOURCE
                              ? (inv.sourcePlacementLabel ?? "Source")
                              : (inv.bespokeReason ?? "Direct invite")
                          const lastUpdatedAt = inv.lastUpdatedAt
                            ? new Date(inv.lastUpdatedAt)
                            : null
                          return (
                            <TableRow key={inv.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                                    {initial}
                                  </div>
                                  <div className="flex flex-col leading-tight">
                                    <span>{name}</span>
                                    {name !== inv.email ? (
                                      <span className="text-xs text-muted-foreground">
                                        {inv.email}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {inv.origin}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {attribution}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={statusBadgeClass(sKey)}
                                >
                                  {statusLabel(sKey)}
                                </Badge>
                              </TableCell>
                              <TableCell
                                className="text-xs tabular-nums"
                                title={
                                  sendCount === 0
                                    ? "Not sent yet (draft)"
                                    : `Invited ${sendCount} time${sendCount === 1 ? "" : "s"}`
                                }
                              >
                                {sendCount === 0 ? (
                                  <span className="text-muted-foreground italic">
                                    draft
                                  </span>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className={
                                      sendCount > 1
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-300 tabular-nums"
                                        : "text-muted-foreground tabular-nums"
                                    }
                                  >
                                    {sendCount}×
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell
                                className="text-xs text-muted-foreground"
                                title={lastUpdatedAt?.toISOString() ?? ""}
                              >
                                {formatRelativeTime(lastUpdatedAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                {inv.claimUrl !== null ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Copy invite link"
                                    className="text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      inv.claimUrl &&
                                      copyToClipboard(inv.claimUrl)
                                    }
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function CounterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
      aria-pressed={active}
    >
      {label} <span className="tabular-nums">{count}</span>
    </button>
  )
}
