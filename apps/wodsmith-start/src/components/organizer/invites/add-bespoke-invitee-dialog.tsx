"use client"

/**
 * Single-add bespoke invitee dialog.
 *
 * Opens from the roster "Add invitee" button. Creates a draft invite row
 * via `createBespokeInviteFn` — no email is sent until the organizer
 * picks the row into a Send action.
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createBespokeInviteFn } from "@/server-fns/competition-invite-fns"

interface Division {
  id: string
  label: string
}

interface AddBespokeInviteeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  divisions: Division[]
  defaultDivisionId: string
  onCreated?: () => void
}

export function AddBespokeInviteeDialog({
  open,
  onOpenChange,
  championshipCompetitionId,
  divisions,
  defaultDivisionId,
  onCreated,
}: AddBespokeInviteeDialogProps) {
  const createBespoke = useServerFn(createBespokeInviteFn)
  const [email, setEmail] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [reason, setReason] = useState("")
  const [divisionId, setDivisionId] = useState(defaultDivisionId)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setEmail("")
    setFirstName("")
    setLastName("")
    setReason("")
    setDivisionId(defaultDivisionId)
    setError(null)
  }

  const onSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await createBespoke({
        data: {
          championshipCompetitionId,
          championshipDivisionId: divisionId,
          email,
          inviteeFirstName: firstName || null,
          inviteeLastName: lastName || null,
          bespokeReason: reason || null,
        },
      })
      reset()
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add invitee")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add bespoke invitee</DialogTitle>
          <DialogDescription>
            Stage a draft invite for someone not on a source leaderboard.
            Nothing sends until you pick the row into a Send action.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="bespoke-email">Email *</Label>
            <Input
              id="bespoke-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={submitting}
              placeholder="athlete@example.com"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="bespoke-firstname">First name</Label>
              <Input
                id="bespoke-firstname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <Label htmlFor="bespoke-lastname">Last name</Label>
              <Input
                id="bespoke-lastname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="bespoke-division">Division *</Label>
            <select
              id="bespoke-division"
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
            <Label htmlFor="bespoke-reason">Reason (optional)</Label>
            <Input
              id="bespoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              placeholder="Sponsored athlete, Past champion, Wildcard…"
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
          <Button onClick={onSubmit} disabled={submitting || !email}>
            {submitting ? "Adding…" : "Add invitee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
