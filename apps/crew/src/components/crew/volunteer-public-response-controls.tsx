"use client"

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { getCrewAssignmentConfirmationStatusLabel } from "../../lib/crew/assignment-confirmation-display"

export type CrewVolunteerPublicResponseAction =
  | "confirm"
  | "decline"
  | "request_change"

type CrewVolunteerPublicNoteAction = Exclude<
  CrewVolunteerPublicResponseAction,
  "confirm"
>

export interface CrewVolunteerPublicResponseAssignment {
  id: string
  confirmation?: {
    status?: string | null
    responseNote?: string | null
  } | null
}

interface CrewVolunteerPublicResponseControlsProps {
  assignment: CrewVolunteerPublicResponseAssignment
  pendingAction: string | null
  className?: string
  onConfirm: () => void
  onNoteSubmit: (
    action: CrewVolunteerPublicNoteAction,
    note: string,
  ) => Promise<void> | void
}

interface CrewVolunteerResponseNoteFormProps {
  action: CrewVolunteerPublicNoteAction
  disabled: boolean
  isPending: boolean
  rows: number
  onSubmit: (
    action: CrewVolunteerPublicNoteAction,
    note: string,
  ) => Promise<void> | void
}

interface ResponseNoteFormValues {
  note: string
}

export function CrewVolunteerPublicResponseControls({
  assignment,
  pendingAction,
  className = "",
  onConfirm,
  onNoteSubmit,
}: CrewVolunteerPublicResponseControlsProps) {
  const status = assignment.confirmation?.status ?? "pending"
  const canRespond = status === "pending"

  if (!canRespond) {
    return (
      <div
        className={`mt-5 rounded-md border bg-background p-3 text-sm ${className}`}
      >
        <p className="font-medium">
          {getCrewVolunteerRecordedResponseMessage(status)}
        </p>
        {assignment.confirmation?.responseNote ? (
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
            {assignment.confirmation.responseNote}
          </p>
        ) : null}
      </div>
    )
  }

  const disabled = pendingAction !== null
  const confirmKey = getCrewVolunteerResponseActionKey(assignment.id, "confirm")
  const declineKey = getCrewVolunteerResponseActionKey(assignment.id, "decline")
  const changeKey = getCrewVolunteerResponseActionKey(
    assignment.id,
    "request_change",
  )

  return (
    <div
      className={`mt-5 space-y-4 rounded-md border bg-background p-4 ${className}`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onConfirm}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-fit"
      >
        {pendingAction === confirmKey ? (
          <Loader2 className="size-4 animate-spin" />
        ) : null}
        Confirm
      </button>

      <div className="grid gap-4 sm:grid-cols-2">
        <CrewVolunteerResponseNoteForm
          action="request_change"
          disabled={disabled}
          isPending={pendingAction === changeKey}
          rows={3}
          onSubmit={onNoteSubmit}
        />
        <CrewVolunteerResponseNoteForm
          action="decline"
          disabled={disabled}
          isPending={pendingAction === declineKey}
          rows={3}
          onSubmit={onNoteSubmit}
        />
      </div>
    </div>
  )
}

export function getCrewVolunteerResponseActionKey(
  assignmentId: string,
  action: CrewVolunteerPublicResponseAction,
) {
  return `${assignmentId}:${action}`
}

export function getCrewVolunteerRecordedResponseMessage(status: string) {
  if (status === "confirmed") {
    return "Confirmed. We'll remind you before your shift."
  }
  if (status === "declined") {
    return "Declined. The organizer will see your note."
  }
  if (status === "change_requested") {
    return "Change request sent. The organizer will see your note."
  }
  return `Response recorded: ${getCrewAssignmentConfirmationStatusLabel(status)}.`
}

function CrewVolunteerResponseNoteForm({
  action,
  disabled,
  isPending,
  rows,
  onSubmit,
}: CrewVolunteerResponseNoteFormProps) {
  const formSchema = useMemo(
    () =>
      z.object({
        note: z
          .string()
          .trim()
          .min(1, getMissingNoteMessage(action))
          .max(1000, "Keep your note under 1000 characters."),
      }),
    [action],
  )
  const form = useForm<ResponseNoteFormValues>({
    resolver: standardSchemaResolver(formSchema),
    defaultValues: { note: "" },
  })
  const label = action === "request_change" ? "Request change" : "Decline"
  const placeholder =
    action === "request_change"
      ? "What needs to change?"
      : "Let the organizer know why"
  const buttonLabel = action === "request_change" ? "Send request" : "Decline"

  async function handleValidSubmit(values: ResponseNoteFormValues) {
    await onSubmit(action, values.note.trim())
  }

  return (
    <form onSubmit={form.handleSubmit(handleValidSubmit)} className="space-y-2">
      <label className="grid gap-2 text-sm">
        <span className="font-medium">{label}</span>
        <textarea
          {...form.register("note")}
          rows={rows}
          disabled={disabled}
          className="rounded-md border bg-card px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={placeholder}
        />
      </label>
      {form.formState.errors.note?.message ? (
        <p className="text-xs text-destructive">
          {form.formState.errors.note.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={disabled}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {buttonLabel}
      </button>
    </form>
  )
}

function getMissingNoteMessage(action: CrewVolunteerPublicNoteAction) {
  return action === "decline"
    ? "Add a note before declining."
    : "Add a note before requesting a change."
}
