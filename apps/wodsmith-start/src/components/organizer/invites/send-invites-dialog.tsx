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
import { useEffect, useState } from "react"
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
  championshipDivisionId: string
  recipients: SendRecipient[]
  onSent?: () => void
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
  championshipDivisionId,
  recipients,
  onSent,
}: SendInvitesDialogProps) {
  const issueInvites = useServerFn(issueInvitesFn)
  const [subject, setSubject] = useState("You're invited")
  const [bodyText, setBodyText] = useState("")
  const [deadline, setDeadline] = useState(defaultDeadline)
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
    setSubject("You're invited")
    setBodyText("")
    setDeadline(defaultDeadline())
    setSubmitting(false)
    setError(null)
    setResult(null)
  }, [open])

  const onSubmit = async () => {
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
          championshipDivisionId,
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
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <Alert variant={result.failed.length > 0 ? "destructive" : "default"}>
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
                      Failed rows ({result.failed.length}) — re-clicking
                      Send will retry these.
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
                submitting ||
                recipients.length === 0 ||
                !subject ||
                !deadline
              }
            >
              {submitting ? "Sending…" : `Send ${recipients.length} invite${recipients.length === 1 ? "" : "s"}`}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
