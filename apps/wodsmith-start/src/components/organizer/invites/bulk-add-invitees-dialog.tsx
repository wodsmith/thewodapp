"use client"

/**
 * Bulk paste dialog for bespoke invitees.
 *
 * Accepts CSV, TSV (Google Sheets paste), or one-email-per-line. The
 * server splits and stages draft rows; duplicates and invalid lines are
 * surfaced inline with row numbers so the organizer can fix and re-paste.
 */

import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBespokeInvitesBulkFn } from "@/server-fns/competition-invite-fns"

interface Division {
  id: string
  label: string
}

interface BulkAddInviteesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  divisions: Division[]
  defaultDivisionId: string
  onCreated?: () => void
}

export function BulkAddInviteesDialog({
  open,
  onOpenChange,
  championshipCompetitionId,
  divisions,
  defaultDivisionId,
  onCreated,
}: BulkAddInviteesDialogProps) {
  const createBulk = useServerFn(createBespokeInvitesBulkFn)
  const [pasteText, setPasteText] = useState("")
  const [divisionId, setDivisionId] = useState(defaultDivisionId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    created: number
    duplicates: number
    invalid: number
    invalidLines: string[]
    duplicateEmails: string[]
  } | null>(null)

  const reset = () => {
    setPasteText("")
    setDivisionId(defaultDivisionId)
    setError(null)
    setSummary(null)
  }

  const onSubmit = async () => {
    setSubmitting(true)
    setError(null)
    setSummary(null)
    try {
      const result = await createBulk({
        data: {
          championshipCompetitionId,
          championshipDivisionId: divisionId,
          pasteText,
        },
      })
      setSummary({
        created: result.created.length,
        duplicates: result.duplicates.length,
        invalid: result.invalid.length,
        invalidLines: result.invalid.map(
          (r) => `Row ${r.rowNumber}: ${r.reason}`,
        ),
        duplicateEmails: result.duplicates.map(
          (d) => `${d.email} (${d.reason})`,
        ),
      })
      if (result.created.length > 0) {
        onCreated?.()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk upload failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk add invitees</DialogTitle>
          <DialogDescription>
            Paste emails — CSV (`email,firstName,lastName,division,reason`),
            TSV (Google Sheets), or one email per line. 500-row cap per
            submission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bulk-division">Division *</Label>
            <select
              id="bulk-division"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              disabled={submitting}
            >
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="bulk-paste">Emails</Label>
            <Textarea
              id="bulk-paste"
              className="h-48 font-mono text-sm"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              disabled={submitting}
              placeholder={`jane@example.com\nbob@example.com,Bob,Smith,,Sponsor\n…`}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {summary ? (
            <Alert>
              <AlertDescription>
                <div className="space-y-1">
                  <div>
                    <strong>{summary.created}</strong> staged as drafts ·{" "}
                    <strong>{summary.duplicates}</strong> duplicates ·{" "}
                    <strong>{summary.invalid}</strong> invalid
                  </div>
                  {summary.duplicateEmails.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer">
                        Duplicate rows ({summary.duplicateEmails.length})
                      </summary>
                      <ul className="mt-2 list-disc pl-5 text-xs">
                        {summary.duplicateEmails.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  {summary.invalidLines.length > 0 ? (
                    <details>
                      <summary className="cursor-pointer">
                        Invalid rows ({summary.invalidLines.length})
                      </summary>
                      <ul className="mt-2 list-disc pl-5 text-xs">
                        {summary.invalidLines.map((l) => (
                          <li key={l}>{l}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
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
            Close
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || pasteText.trim().length === 0}
          >
            {submitting ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
