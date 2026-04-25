"use client"

/**
 * Round Builder right-rail.
 *
 * Composes a draft round in a slide-in Sheet: smart-select quick actions,
 * round metadata (label, subject, deadline), recipients chips, and a
 * sticky send footer. Submits through `issueInvitesFn`, which creates the
 * round on the server and threads it through the send pipeline.
 *
 * Mirrors the layout in `docs/mockups/competition-invites/project/invites/round-builder.jsx`
 * minus the email composer body — Phase 4 replaces the textarea with the
 * structured composer.
 */

import { useServerFn } from "@tanstack/react-start"
import { useEffect, useMemo, useState } from "react"
import type { SendRecipient } from "@/components/organizer/invites/send-invites-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  getRoundDetailFn,
  issueInvitesFn,
} from "@/server-fns/competition-invite-fns"

interface RoundBuilderSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  championshipDivisionId: string
  recipients: SendRecipient[]
  /** When set, "Re-invite non-responders" fetches this round's invites
   *  and adds the pending/expired/revoked ones. Hidden when null. */
  mostRecentSentRoundId: string | null
  /** Smart-select handler — adds the next N waitlist roster rows. */
  onSelectNextN: (n: number) => void
  /** Smart-select handler — selects every active draft bespoke row. */
  onSelectAllDraftBespoke: () => void
  /** Smart-select handler — adds the supplied non-responder emails to the
   *  current selection. The parent owns the selection state, so we hand
   *  it the email list and it folds them in. */
  onSelectReinviteNonResponders: (emails: string[]) => void
  /** Default round number used to pre-fill the label. */
  defaultRoundNumber: number
  onSent?: (result: { roundId: string; sentCount: number }) => void
}

function defaultDeadline(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function RoundBuilderSheet({
  open,
  onOpenChange,
  championshipCompetitionId,
  championshipDivisionId,
  recipients,
  mostRecentSentRoundId,
  onSelectNextN,
  onSelectAllDraftBespoke,
  onSelectReinviteNonResponders,
  defaultRoundNumber,
  onSent,
}: RoundBuilderSheetProps) {
  const issueInvites = useServerFn(issueInvitesFn)
  const getRoundDetail = useServerFn(getRoundDetailFn)
  const [label, setLabel] = useState(`Round ${defaultRoundNumber}`)
  const [subject, setSubject] = useState("You're invited")
  const [bodyText, setBodyText] = useState("")
  const [deadline, setDeadline] = useState(defaultDeadline)
  const [submitting, setSubmitting] = useState(false)
  const [reinviteLoading, setReinviteLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    sentCount: number
    skippedCount: number
    roundId: string
  } | null>(null)

  useEffect(() => {
    if (open) return
    setLabel(`Round ${defaultRoundNumber}`)
    setSubject("You're invited")
    setBodyText("")
    setDeadline(defaultDeadline())
    setSubmitting(false)
    setReinviteLoading(false)
    setError(null)
    setResult(null)
  }, [open, defaultRoundNumber])

  const sourceRecipients = useMemo(
    () => recipients.filter((r) => r.origin === "source"),
    [recipients],
  )
  const bespokeRecipients = useMemo(
    () => recipients.filter((r) => r.origin === "bespoke"),
    [recipients],
  )

  const handleReinvite = async () => {
    if (!mostRecentSentRoundId) return
    setReinviteLoading(true)
    try {
      const detail = await getRoundDetail({
        data: {
          championshipCompetitionId,
          roundId: mostRecentSentRoundId,
        },
      })
      const NON_RESPONDER = new Set([
        "pending",
        "expired",
        "revoked",
      ])
      const emails = detail.invites
        .filter((inv) => NON_RESPONDER.has(inv.status))
        .map((inv) => inv.email.toLowerCase())
      onSelectReinviteNonResponders(emails)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load prior round.",
      )
    } finally {
      setReinviteLoading(false)
    }
  }

  const onSubmit = async () => {
    if (!deadline) {
      setError("Pick an RSVP deadline before sending.")
      return
    }
    const rsvpDeadlineAt = new Date(`${deadline}T23:59:59`)
    if (Number.isNaN(rsvpDeadlineAt.getTime())) {
      setError("RSVP deadline isn't a valid date.")
      return
    }
    setSubmitting(true)
    setError(null)
    setResult(null)
    try {
      const response = await issueInvites({
        data: {
          championshipCompetitionId,
          championshipDivisionId,
          rsvpDeadlineAt,
          subject,
          bodyText: bodyText || undefined,
          roundLabel: label,
          recipients,
        },
      })
      setResult({
        sentCount: response.sentCount,
        skippedCount: response.skipped.length,
        roundId: response.roundId,
      })
      onSent?.({
        roundId: response.roundId,
        sentCount: response.sentCount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Round builder</SheetTitle>
          <SheetDescription>
            Compose a wave of invites. Each recipient gets a unique
            email-locked claim link.
          </SheetDescription>
        </SheetHeader>

        <div className="-mx-6 mt-4 flex-1 space-y-5 overflow-y-auto px-6 pb-4">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick add
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectNextN(5)}
                disabled={submitting}
              >
                Next 5 on leaderboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectNextN(10)}
                disabled={submitting}
              >
                Next 10 on leaderboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSelectAllDraftBespoke}
                disabled={submitting}
              >
                All draft bespoke
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReinvite}
                disabled={
                  submitting ||
                  reinviteLoading ||
                  !mostRecentSentRoundId
                }
                title={
                  mostRecentSentRoundId
                    ? "Add the prior round's pending/expired/revoked recipients"
                    : "No prior sent round to re-invite from"
                }
              >
                {reinviteLoading
                  ? "Loading…"
                  : "Re-invite non-responders"}
              </Button>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recipients
              </h3>
              <Badge variant="outline">
                {recipients.length}{" "}
                {recipients.length === 1 ? "recipient" : "recipients"}
              </Badge>
            </div>
            {recipients.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Use Quick Add or pick rows on the roster to populate
                recipients.
              </div>
            ) : (
              <div className="space-y-2">
                {sourceRecipients.length > 0 ? (
                  <RecipientChipList
                    title="From qualification sources"
                    recipients={sourceRecipients}
                  />
                ) : null}
                {bespokeRecipients.length > 0 ? (
                  <RecipientChipList
                    title="Bespoke / direct"
                    recipients={bespokeRecipients}
                  />
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Round details
            </h3>
            <div>
              <Label htmlFor="round-label">Label</Label>
              <Input
                id="round-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={submitting}
                placeholder="Round 1 — Guaranteed"
              />
            </div>
            <div>
              <Label htmlFor="round-subject">Email subject</Label>
              <Input
                id="round-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <Label htmlFor="round-deadline">RSVP deadline</Label>
              <Input
                id="round-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            <div>
              <Label htmlFor="round-body">Custom body (optional)</Label>
              <Textarea
                id="round-body"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                disabled={submitting}
                placeholder="Leave blank to use the default invitation copy. Phase 4 replaces this with a structured composer."
                className="h-24"
              />
            </div>
          </section>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <Alert>
              <AlertDescription>
                Queued <strong>{result.sentCount}</strong> invite email
                {result.sentCount === 1 ? "" : "s"}
                {result.skippedCount > 0
                  ? ` · skipped ${result.skippedCount} already-active`
                  : ""}
                .
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="-mx-6 -mb-6 border-t bg-background px-6 py-3">
          <div className="flex items-center justify-end gap-2">
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
                  submitting ||
                  recipients.length === 0 ||
                  !subject ||
                  !deadline ||
                  !label
                }
              >
                {submitting
                  ? "Sending…"
                  : `Send ${recipients.length} invite${recipients.length === 1 ? "" : "s"}`}
              </Button>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function RecipientChipList({
  title,
  recipients,
}: {
  title: string
  recipients: SendRecipient[]
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {recipients.slice(0, 30).map((r) => {
          const display =
            [r.inviteeFirstName, r.inviteeLastName]
              .filter(Boolean)
              .join(" ") || r.email
          return (
            <span
              key={r.email}
              className="rounded-sm border bg-background px-1.5 py-0.5 text-xs"
              title={r.email}
            >
              {display}
            </span>
          )
        })}
        {recipients.length > 30 ? (
          <span className="text-xs text-muted-foreground">
            +{recipients.length - 30} more
          </span>
        ) : null}
      </div>
    </div>
  )
}
