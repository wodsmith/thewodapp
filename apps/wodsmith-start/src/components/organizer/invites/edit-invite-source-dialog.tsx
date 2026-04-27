"use client"

/**
 * Edit-or-create dialog for a qualification source.
 *
 * Wraps `InviteSourceForm` with the create / update server fns and the
 * loading / error UI. Same dialog handles both flows — when `source` is
 * passed, runs `updateInviteSourceFn`; otherwise `createInviteSourceFn`.
 */

import { useServerFn } from "@tanstack/react-start"
import { useState } from "react"
import {
  InviteSourceForm,
  type InviteSourceFormValues,
} from "@/components/organizer/invites/invite-source-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { CompetitionInviteSource } from "@/db/schemas/competition-invites"
import {
  createInviteSourceFn,
  updateInviteSourceFn,
} from "@/server-fns/competition-invite-fns"

interface EditInviteSourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  championshipCompetitionId: string
  source?: CompetitionInviteSource
  competitionOptions: Array<{ id: string; name: string }>
  seriesOptions: Array<{ id: string; name: string }>
  onSaved?: () => void
}

export function EditInviteSourceDialog({
  open,
  onOpenChange,
  championshipCompetitionId,
  source,
  competitionOptions,
  seriesOptions,
  onSaved,
}: EditInviteSourceDialogProps) {
  const createSource = useServerFn(createInviteSourceFn)
  const updateSource = useServerFn(updateInviteSourceFn)
  const [error, setError] = useState<string | null>(null)
  const isEdit = !!source

  const onSubmit = async (values: InviteSourceFormValues) => {
    setError(null)
    try {
      if (isEdit && source) {
        await updateSource({
          data: {
            id: source.id,
            championshipCompetitionId,
            kind: values.kind,
            sourceCompetitionId:
              values.kind === "competition" ? values.sourceCompetitionId : null,
            sourceGroupId:
              values.kind === "series" ? values.sourceGroupId : null,
            directSpotsPerComp:
              values.kind === "series"
                ? (values.directSpotsPerComp ?? null)
                : null,
            globalSpots: values.globalSpots ?? null,
            notes: values.notes ?? null,
          },
        })
      } else {
        await createSource({
          data: {
            championshipCompetitionId,
            kind: values.kind,
            sourceCompetitionId:
              values.kind === "competition" ? values.sourceCompetitionId : null,
            sourceGroupId:
              values.kind === "series" ? values.sourceGroupId : null,
            directSpotsPerComp:
              values.kind === "series"
                ? (values.directSpotsPerComp ?? null)
                : null,
            globalSpots: values.globalSpots ?? null,
            notes: values.notes ?? null,
          },
        })
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save source")
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit qualification source" : "Add qualification source"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the source's allocation. Already-issued invites are not affected."
              : "Pick a competition or series to feed athletes into this championship's roster."}
          </DialogDescription>
        </DialogHeader>
        <InviteSourceForm
          defaultValues={source}
          competitionOptions={competitionOptions}
          seriesOptions={seriesOptions}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          submitLabel={isEdit ? "Save changes" : "Add source"}
        />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
