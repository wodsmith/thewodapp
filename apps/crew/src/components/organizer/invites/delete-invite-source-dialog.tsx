"use client"

/**
 * Confirmation dialog for deleting a qualification source.
 *
 * Per ADR-0011 verification line 615: deleting a source does NOT delete
 * already-issued invites — the warning copy here exists to set that
 * expectation before the organizer commits.
 */

import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { CompetitionInviteSource } from "@/db/schemas/competition-invites"
import { deleteInviteSourceFn } from "@/server-fns/competition-invite-fns"

interface DeleteInviteSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  source: CompetitionInviteSource | null
  sourceLabel: string
  onDeleted?: () => void
}

export function DeleteInviteSourceDialog({
  open,
  onOpenChange,
  championshipCompetitionId,
  source,
  sourceLabel,
  onDeleted,
}: DeleteInviteSourceDialogProps) {
  const deleteSource = useServerFn(deleteInviteSourceFn)
  const [submitting, setSubmitting] = useState(false)

  const onConfirm = async () => {
    if (!source) return
    setSubmitting(true)
    try {
      await deleteSource({
        data: { id: source.id, championshipCompetitionId },
      })
      onOpenChange(false)
      onDeleted?.()
      toast.success("Source removed")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete source",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this source?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-medium">{sourceLabel}</span> will stop
            contributing athletes to the roster. Already-issued invites stay
            active — they don't get revoked. New roster computations won't
            include athletes from this source going forward.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
            disabled={submitting}
          >
            {submitting ? "Removing…" : "Remove source"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
