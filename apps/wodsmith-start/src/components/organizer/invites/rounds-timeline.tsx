"use client"

/**
 * Rounds Timeline.
 *
 * Read-only history view for a championship's invite rounds, mirroring the
 * vertical timeline mockup at `docs/mockups/competition-invites/project/invites/rounds-timeline.jsx`.
 *
 * Each round renders a numbered dot, the round metadata (label, subject,
 * deadline, sender), a stacked progress bar split by status, and a 5-up
 * StatTick row (paid / accepted / pending / declined / expired). A
 * placeholder card at the bottom encourages composing the next round —
 * the actual draft creation lives in the round-builder right rail (3.5).
 */

import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  COMPETITION_INVITE_ROUND_STATUS,
  COMPETITION_INVITE_STATUS,
  type CompetitionInviteRound,
} from "@/db/schemas/competition-invites"

export interface RoundTimelineEntry {
  round: CompetitionInviteRound
  /** Counts keyed by `competition_invites.status`. Missing keys mean 0. */
  counts: Record<string, number>
}

export interface RoundsTimelineProps {
  competitionId: string
  rounds: RoundTimelineEntry[]
}

const STATUS_TINT: Record<string, string> = {
  [COMPETITION_INVITE_STATUS.ACCEPTED_PAID]: "bg-emerald-500",
  [COMPETITION_INVITE_STATUS.PENDING]: "bg-amber-500",
  [COMPETITION_INVITE_STATUS.DECLINED]: "bg-rose-500",
  [COMPETITION_INVITE_STATUS.EXPIRED]: "bg-zinc-400",
  [COMPETITION_INVITE_STATUS.REVOKED]: "bg-zinc-300",
}

const STAT_ORDER: Array<{ key: string; label: string }> = [
  { key: COMPETITION_INVITE_STATUS.ACCEPTED_PAID, label: "Paid" },
  { key: COMPETITION_INVITE_STATUS.PENDING, label: "Pending" },
  { key: COMPETITION_INVITE_STATUS.DECLINED, label: "Declined" },
  { key: COMPETITION_INVITE_STATUS.EXPIRED, label: "Expired" },
  { key: COMPETITION_INVITE_STATUS.REVOKED, label: "Revoked" },
]

function StackedBar({
  counts,
  total,
}: {
  counts: Record<string, number>
  total: number
}) {
  if (total === 0) {
    return (
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" />
    )
  }
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      {STAT_ORDER.map(({ key }) => {
        const value = counts[key] ?? 0
        if (value === 0) return null
        const pct = (value / total) * 100
        return (
          <div
            key={key}
            className={STATUS_TINT[key] ?? "bg-zinc-300"}
            style={{ width: `${pct}%` }}
            aria-label={`${key}: ${value}`}
          />
        )
      })}
    </div>
  )
}

function StatTick({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function StatusPill({ status }: { status: CompetitionInviteRound["status"] }) {
  switch (status) {
    case COMPETITION_INVITE_ROUND_STATUS.DRAFT:
      return <Badge variant="outline">Draft</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.SENDING:
      return <Badge variant="secondary">Sending</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.SENT:
      return <Badge>Sent</Badge>
    case COMPETITION_INVITE_ROUND_STATUS.FAILED:
      return <Badge variant="destructive">Failed</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—"
  const date = typeof d === "string" ? new Date(d) : d
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function RoundsTimeline({
  competitionId,
  rounds,
}: RoundsTimelineProps) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        No rounds sent yet. Pick recipients on the Roster tab and click
        Send to start your first round.
      </div>
    )
  }

  return (
    <ol className="relative space-y-6 border-l-2 pl-6">
      {rounds.map(({ round, counts }) => {
        const total = STAT_ORDER.reduce(
          (sum, { key }) => sum + (counts[key] ?? 0),
          0,
        )
        return (
          <li key={round.id} className="relative">
            <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs font-bold text-background">
              {round.roundNumber}
            </span>
            <div className="rounded-md border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight">
                      {round.label}
                    </h3>
                    <StatusPill status={round.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {round.subject}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>RSVP by {formatDate(round.rsvpDeadlineAt)}</div>
                  <div>Sent {formatDate(round.sentAt)}</div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <StackedBar counts={counts} total={total} />
                <div className="grid grid-cols-5 gap-2">
                  {STAT_ORDER.map(({ key, label }) => (
                    <StatTick
                      key={key}
                      label={label}
                      value={counts[key] ?? 0}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {round.recipientCount} recipient
                  {round.recipientCount === 1 ? "" : "s"}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    to="/compete/organizer/$competitionId/invites/rounds/$roundId"
                    params={{ competitionId, roundId: round.id }}
                  >
                    View detail →
                  </Link>
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
