"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { WorkoutMetadataSuggestionContext } from "@/components/workout-metadata-suggestions"
import { DescriptionWorkoutForm } from "@/components/workouts/description-workout-form"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type { Movement } from "@/db/schemas/workouts"
import type {
  ScoreType,
  TiebreakScheme,
  WorkoutScheme,
} from "@/lib/scoring/types"
import type {
  InferredCompetitionEvent,
  InferredCompetitionEventGroup,
  WorkoutAuthoringContext,
} from "@/lib/workout-authoring"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import { describeCompetitionEventFn } from "@/server-fns/workout-authoring-fns"

interface CreateEventDialogProps {
  metadataSuggestions?: WorkoutMetadataSuggestionContext
  authoringContext?: WorkoutAuthoringContext
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateEvent: (data: {
    name: string
    scheme: WorkoutScheme
    scoreType?: ScoreType
    description?: string
    roundsToScore?: number
    tiebreakScheme?: TiebreakScheme
    movementIds?: string[]
    timeCap?: number
    repsPerRound?: number
    scalingGroupId?: string
    scalingDescriptions?: NormalizedWorkoutSave["scalingDescriptions"]
  }) => Promise<void>
  onCreateEventGroup?: (group: InferredCompetitionEventGroup) => Promise<void>
  isCreating?: boolean
  movements: Movement[]
}

function isEventGroup(
  value: InferredCompetitionEvent,
): value is InferredCompetitionEventGroup {
  return "subEvents" in value && Array.isArray(value.subEvents)
}

export function CreateEventDialog({
  metadataSuggestions,
  authoringContext,
  open,
  onOpenChange,
  onCreateEvent,
  onCreateEventGroup,
  isCreating,
  movements,
}: CreateEventDialogProps) {
  const [value, setValue] = useState<Partial<NormalizedWorkoutSave>>({
    name: "",
    scheme: "time",
    scoreType: "min",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const busy = isCreating || submitting

  const resetForm = () => {
    setValue({ name: "", scheme: "time", scoreType: "min" })
    setError("")
  }
  const handleOpenChange = (next: boolean) => {
    if (busy) return
    if (!next) resetForm()
    onOpenChange(next)
  }
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !value.name?.trim() || !value.scheme) return
    setSubmitting(true)
    setError("")
    try {
      await onCreateEvent({
        name: value.name.trim(),
        scheme: value.scheme,
        scoreType: value.scoreType ?? undefined,
        description: value.description?.trim() || undefined,
        roundsToScore: value.roundsToScore,
        tiebreakScheme: value.tiebreakScheme ?? undefined,
        movementIds: value.movementIds?.length ? value.movementIds : undefined,
      })
      resetForm()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the event. Your entries are still here; try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (authoringContext)
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[600px] max-h-[90dvh] overflow-y-auto"
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (busy) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
            <DialogDescription>
              Describe the workout and any division-specific variations.
            </DialogDescription>
          </DialogHeader>
          <DescriptionWorkoutForm<InferredCompetitionEvent>
            context={authoringContext}
            submitLabel="Create event"
            onBusyChange={setSubmitting}
            onCancel={() => handleOpenChange(false)}
            recognize={(description) =>
              describeCompetitionEventFn({
                data: { context: authoringContext, description },
              })
            }
            onSubmit={async (workout) => {
              if (isEventGroup(workout)) {
                if (!onCreateEventGroup)
                  throw new Error("Multi-part event creation is unavailable.")
                await onCreateEventGroup(workout)
                onOpenChange(false)
                return
              }
              await onCreateEvent({
                ...workout,
                scoreType: workout.scoreType ?? undefined,
                tiebreakScheme: workout.tiebreakScheme ?? undefined,
                timeCap: workout.timeCapSeconds ?? undefined,
                repsPerRound: workout.repsPerRound ?? undefined,
                scalingGroupId: workout.scalingGroupId ?? undefined,
              })
              onOpenChange(false)
            }}
          />
        </DialogContent>
      </Dialog>
    )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new event</DialogTitle>
            <DialogDescription>
              Create a new workout event for this competition. Add
              division-specific descriptions and other event settings after
              creating.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <WorkoutDefinitionFields
              metadataSuggestions={metadataSuggestions}
              allowEmptyScoreType={false}
              value={value}
              onChange={(patch) =>
                setValue((current) => ({ ...current, ...patch }))
              }
              nameLabel="Event Name"
              movements={movements}
              disabled={busy}
              autoFocus
              fields={[
                "name",
                "scheme",
                "scoreType",
                "roundsToScore",
                "tiebreakScheme",
                "description",
                "movementIds",
              ]}
            />
            {value.scheme === "time-with-cap" && (
              <p className="mt-4 text-sm text-muted-foreground">
                Set the time cap in Event Details after creating this event.
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !value.name?.trim()}>
              {busy ? "Creating..." : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
