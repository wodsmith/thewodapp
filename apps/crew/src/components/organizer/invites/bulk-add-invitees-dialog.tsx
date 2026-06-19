"use client"

import { useServerFn } from "@tanstack/react-start"
import { useEffect, useState } from "react"
import { toast } from "sonner"
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

  useEffect(() => {
    if (open) return
    setPasteText("")
    setDivisionId(defaultDivisionId)
    setError(null)
  }, [open, defaultDivisionId])

  const onSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const normalized = pasteText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n")
      const result = await createBulk({
        data: {
          championshipCompetitionId,
          championshipDivisionId: divisionId,
          pasteText: normalized,
        },
      })
      const { created, duplicates, invalid } = result
      const parts = [`${created.length} invited`]
      if (duplicates.length > 0) parts.push(`${duplicates.length} duplicate`)
      if (invalid.length > 0) parts.push(`${invalid.length} invalid`)
      const message = parts.join(" · ")
      if (invalid.length > 0 || duplicates.length > 0) {
        toast.warning(message)
      } else {
        toast.success(message)
      }
      if (created.length > 0) onCreated?.()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk invite failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk add invitees</DialogTitle>
          <DialogDescription>
            Paste emails — one per line or comma-separated. 500-row cap per
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
              placeholder={`jane@example.com\nbob@example.com\nor: jane@example.com, bob@example.com`}
            />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || pasteText.trim().length === 0}
          >
            {submitting ? "Inviting…" : "Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
