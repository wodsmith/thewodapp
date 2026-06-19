"use client"

/**
 * Send invites dialog — Phase 2 single-round send UX.
 *
 * Takes a list of pre-selected recipients (source rows from the roster
 * and/or draft bespoke rows), plus a subject + deadline, and issues the
 * invites via `issueInvitesFn`. No email composer yet; Phase 4 adds the
 * structured composer.
 */

import { useServerFn } from "@tanstack/react-start"
import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { CompetitionInviteOrigin } from "@/db/schemas/competition-invites"
import { issueInvitesFn } from "@/server-fns/competition-invite-fns"

export interface SendRecipient {
  email: string
  origin: CompetitionInviteOrigin
  sourceId?: string | null
  sourceCompetitionId?: string | null
  sourcePlacement?: number | null
  sourcePlacementLabel?: string | null
  bespokeReason?: string | null
  inviteeFirstName?: string | null
  inviteeLastName?: string | null
  userId?: string | null
}

interface SendInvitesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  /** All championship divisions the organizer can target. The dialog
   *  shows a <Select> so the organizer picks which division this batch of
   *  invites lands in — it's no longer assumed by the parent route. */
  championshipDivisions: Array<{ id: string; label: string }>
  /** Preferred default championship division id. The parent passes this
   *  when the candidates table is filtered to a single division so the
   *  dialog opens already pointed at the matching championship division.
   *  Falls back to `championshipDivisions[0]` when missing or unmatched. */
  defaultDivisionId?: string
  championshipName: string
  recipients: SendRecipient[]
  onSent?: () => void
  /** ADR-0012 Phase 4: resolved per-(source, championship-division)
   *  allocation map. Used to compute the over-issue warning. Optional:
   *  callers that don't pass it skip the warning + per-recipient
   *  breakdown entirely. */
  allocationsBySourceByDivision?: Record<string, Record<string, number>>
  /** ADR-0012 Phase 4: count of currently active (pending OR
   *  accepted_paid) invites grouped by (sourceId, championshipDivisionId)
   *  in the championship. Combined with the incoming recipient bucket
   *  count to detect over-issue against `allocationsBySourceByDivision`.
   *  Bespoke (sourceId === null) recipients bypass the check entirely. */
  existingActiveCountsBySourceByDivision?: Record<
    string,
    Record<string, number>
  >
  /** ADR-0012 Phase 4: human-readable source label keyed by `sourceId`.
   *  Used by the over-issue warning + per-recipient breakdown so the
   *  organizer sees "RX (Throwdown A): 5 of 3 allocated" instead of a
   *  raw source id. Optional — falls back to the source id. */
  sourceLabelsById?: Record<string, string>
}

interface BucketSummary {
  sourceId: string
  divisionId: string
  divisionLabel: string
  sourceLabel: string
  existing: number
  incoming: number
  allocation: number
  wouldExceed: boolean
}

function defaultSubject(
  championshipName: string,
  divisionLabel: string,
): string {
  return `You're invited to ${championshipName} - ${divisionLabel}`
}

function defaultBody(championshipName: string): string {
  return `You've earned a spot at ${championshipName}. This invitation is locked to your email — only you can claim it. Continue below to confirm your spot and complete registration.`
}

function defaultDeadline(): string {
  // Build a YYYY-MM-DD string from local-date components. Using
  // `toISOString().slice(0, 10)` would shift forward/backward a day for
  // anyone east/west of UTC at the time-of-day boundary.
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function SendInvitesDialog({
  open,
  onOpenChange,
  championshipCompetitionId,
  championshipDivisions,
  defaultDivisionId,
  championshipName,
  recipients,
  onSent,
  allocationsBySourceByDivision,
  existingActiveCountsBySourceByDivision,
  sourceLabelsById,
}: SendInvitesDialogProps) {
  const issueInvites = useServerFn(issueInvitesFn)
  const initialDivisionId =
    (defaultDivisionId &&
      championshipDivisions.find((d) => d.id === defaultDivisionId)?.id) ||
    championshipDivisions[0]?.id ||
    ""
  const [targetDivisionId, setTargetDivisionId] =
    useState<string>(initialDivisionId)
  const targetDivision = championshipDivisions.find(
    (d) => d.id === targetDivisionId,
  )
  const initialDivisionLabel =
    championshipDivisions.find((d) => d.id === initialDivisionId)?.label ?? ""
  const [subject, setSubject] = useState(() =>
    defaultSubject(championshipName, initialDivisionLabel),
  )
  const [bodyText, setBodyText] = useState(() => defaultBody(championshipName))
  const [deadline, setDeadline] = useState(defaultDeadline)
  // ADR-0012 Phase 4: bucket recipients by (sourceId, championshipDivisionId)
  // for over-issue detection + per-recipient breakdown. The dialog issues
  // the entire batch into `targetDivisionId`, so the championship-division
  // dimension collapses to a single value here. Bespoke (sourceId == null)
  // recipients bypass the allocation model entirely (ADR-0012: bespoke
  // invites have no source attribution and are unbounded by allocation).
  const allocationCheckEnabled =
    !!allocationsBySourceByDivision && !!existingActiveCountsBySourceByDivision
  const buckets = useMemo<BucketSummary[]>(() => {
    if (!allocationCheckEnabled || !targetDivisionId) return []
    const grouped = new Map<string, number>()
    for (const r of recipients) {
      if (!r.sourceId) continue
      grouped.set(r.sourceId, (grouped.get(r.sourceId) ?? 0) + 1)
    }
    const out: BucketSummary[] = []
    for (const [sourceId, incoming] of grouped) {
      const allocation =
        allocationsBySourceByDivision?.[sourceId]?.[targetDivisionId] ?? 0
      const existing =
        existingActiveCountsBySourceByDivision?.[sourceId]?.[
          targetDivisionId
        ] ?? 0
      out.push({
        sourceId,
        divisionId: targetDivisionId,
        divisionLabel: targetDivision?.label ?? "",
        // Source-name resolution is owned by the parent (it has the
        // competition + series name maps); the dialog falls back to
        // the source id so the warning is still actionable.
        sourceLabel: sourceLabelsById?.[sourceId] ?? sourceId,
        existing,
        incoming,
        allocation,
        wouldExceed: allocation > 0 && existing + incoming > allocation,
      })
    }
    return out
  }, [
    recipients,
    targetDivisionId,
    targetDivision?.label,
    allocationCheckEnabled,
    allocationsBySourceByDivision,
    existingActiveCountsBySourceByDivision,
    sourceLabelsById,
  ])
  const exceedingBuckets = buckets.filter((b) => b.wouldExceed)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    sentCount: number
    skippedCount: number
    failed: Array<{ email: string; error: string }>
  } | null>(null)

  // Reset transient state whenever the dialog closes — covers Cancel,
  // Close, Escape, click-outside, and any external `open={false}` toggle.
  // Without this, a reopen flashes the prior "Queued N invite emails"
  // alert and the footer is stuck in "Close" mode.
  useEffect(() => {
    if (open) return
    const resetDivisionId =
      (defaultDivisionId &&
        championshipDivisions.find((d) => d.id === defaultDivisionId)?.id) ||
      championshipDivisions[0]?.id ||
      ""
    const resetDivisionLabel =
      championshipDivisions.find((d) => d.id === resetDivisionId)?.label ?? ""
    setTargetDivisionId(resetDivisionId)
    setSubject(defaultSubject(championshipName, resetDivisionLabel))
    setBodyText(defaultBody(championshipName))
    setDeadline(defaultDeadline())
    setSubmitting(false)
    setError(null)
    setResult(null)
  }, [open, championshipName, championshipDivisions, defaultDivisionId])

  // Keep the default subject in sync with the division the organizer
  // picks — the suffix is the division label and changing the division
  // should retitle the email unless the user has typed a custom subject.
  // We refresh as long as the current value matches a previously-default
  // pattern so user-edited subjects are preserved.
  useEffect(() => {
    setSubject((prev) => {
      const candidates = championshipDivisions.map((d) =>
        defaultSubject(championshipName, d.label),
      )
      return candidates.includes(prev)
        ? defaultSubject(championshipName, targetDivision?.label ?? "")
        : prev
    })
    // `targetDivision` is the only state-derived dep here — its reference
    // changes whenever `targetDivisionId` resolves to a different element,
    // so listing it covers the division-change trigger.
  }, [championshipName, championshipDivisions, targetDivision])

  const onSubmit = async () => {
    if (!targetDivisionId) {
      setError("Pick a championship division before sending.")
      return
    }
    if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      setError("Pick a valid RSVP deadline before sending.")
      return
    }
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const response = await issueInvites({
        data: {
          championshipCompetitionId,
          championshipDivisionId: targetDivisionId,
          // Pass the raw calendar string. Building a `Date` here would
          // parse the local-tz instant and then format on Workers (UTC)
          // would render the wrong day for any organizer west of UTC.
          rsvpDeadlineDate: deadline,
          subject,
          bodyText: bodyText || undefined,
          recipients,
        },
      })
      setResult({
        sentCount: response.sentCount,
        skippedCount: response.skipped.length,
        failed: (response.failed ?? []).map((f) => ({
          email: f.email,
          error: f.error,
        })),
      })
      onSent?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send invites</DialogTitle>
          <DialogDescription>
            {recipients.length} recipient{recipients.length === 1 ? "" : "s"}{" "}
            selected. Each gets a unique claim link locked to their email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="send-target-division">
              Championship division *
            </Label>
            <Select
              value={targetDivisionId}
              onValueChange={setTargetDivisionId}
              disabled={submitting || championshipDivisions.length === 0}
            >
              <SelectTrigger id="send-target-division">
                <SelectValue placeholder="Pick a division" />
              </SelectTrigger>
              <SelectContent>
                {championshipDivisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="send-subject">Subject *</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <Label htmlFor="send-deadline">RSVP deadline *</Label>
            <Input
              id="send-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <div>
            <Label htmlFor="send-body">Custom body (optional)</Label>
            <Textarea
              id="send-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              disabled={submitting}
              placeholder="Leave blank to use the default invitation copy."
              className="h-24"
            />
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <div className="font-medium mb-1">Recipients:</div>
            <div className="flex flex-wrap gap-1">
              {recipients.slice(0, 15).map((r) => (
                <span
                  key={r.email}
                  className="rounded-sm bg-background px-1.5 py-0.5 font-mono"
                >
                  {r.email}
                </span>
              ))}
              {recipients.length > 15 ? (
                <span className="text-muted-foreground">
                  +{recipients.length - 15} more
                </span>
              ) : null}
            </div>
          </div>
          {allocationCheckEnabled && buckets.length > 0 ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs">
              <div className="font-medium mb-1">
                Allocation per source → {targetDivision?.label}:
              </div>
              <ul className="space-y-0.5">
                {buckets.map((b) => {
                  const newTotal = b.existing + b.incoming
                  const denom = b.allocation > 0 ? `${b.allocation}` : "—"
                  return (
                    <li
                      key={b.sourceId}
                      className={
                        b.wouldExceed
                          ? "text-amber-400 tabular-nums"
                          : "text-muted-foreground tabular-nums"
                      }
                    >
                      <span className="font-medium text-foreground">
                        {b.sourceLabel}
                      </span>{" "}
                      → {b.divisionLabel}: spot{" "}
                      {b.existing > 0
                        ? `${b.existing + 1}-${newTotal}`
                        : `${newTotal}`}{" "}
                      of {denom}
                      {b.existing > 0 ? (
                        <span className="ml-1">
                          (existing {b.existing} + incoming {b.incoming})
                        </span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
          {exceedingBuckets.length > 0 ? (
            <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-200">
              <AlertDescription>
                This send will exceed allocation in {exceedingBuckets.length}{" "}
                source/division bucket
                {exceedingBuckets.length === 1 ? "" : "s"}:{" "}
                {exceedingBuckets
                  .map(
                    (b) =>
                      `${b.sourceLabel} (${b.divisionLabel}): ${b.existing + b.incoming} of ${b.allocation} allocated`,
                  )
                  .join(", ")}
                . Sending is allowed — Round 1 over-invites are expected.
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <Alert
              variant={result.failed.length > 0 ? "destructive" : "default"}
            >
              <AlertDescription>
                <div>
                  Queued <strong>{result.sentCount}</strong> invite email
                  {result.sentCount === 1 ? "" : "s"}
                  {result.skippedCount > 0
                    ? ` · skipped ${result.skippedCount} already-active`
                    : ""}
                  {result.failed.length > 0
                    ? ` · ${result.failed.length} failed`
                    : ""}
                  .
                </div>
                {result.failed.length > 0 ? (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer">
                      Failed rows ({result.failed.length}) — re-clicking Send
                      will retry these.
                    </summary>
                    <ul className="mt-2 list-disc pl-5">
                      {result.failed.map((f) => (
                        <li key={f.email} className="font-mono">
                          {f.email}: {f.error}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {result ? "Close" : "Cancel"}
          </Button>
          {!result ? (
            <Button
              onClick={onSubmit}
              disabled={
                submitting || recipients.length === 0 || !subject || !deadline
              }
            >
              {submitting
                ? "Sending…"
                : `Send ${recipients.length} invite${recipients.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
