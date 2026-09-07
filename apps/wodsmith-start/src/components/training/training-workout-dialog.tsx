import { useEffect, useState } from "react"
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
import {
  type WorkoutDefinitionField,
  WorkoutDefinitionFields,
} from "@/components/workouts/workout-definition-fields"
import type { TrainingBlock } from "@/lib/training/types"
import {
  type NormalizedWorkoutSave,
  normalizedWorkoutSaveSchema,
} from "@/lib/workout-import/schemas"
import { getTrainingWorkoutOptionsFn } from "@/server-fns/training-fns"

/** Mount for one create/edit operation; committing changes only the session draft. */
export function TrainingWorkoutDialog({
  block,
  teamId,
  onSave,
  onClose,
  onDirtyChange,
}: {
  block?: TrainingBlock
  teamId: string
  onSave: (block: TrainingBlock) => void
  onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [value, setValue] = useState<Partial<NormalizedWorkoutSave>>(
    () =>
      block?.workout ?? {
        name: block?.title ?? "",
        description: block?.prescription ?? "",
        scheme:
          block?.kind === "load" || block?.kind === "reps"
            ? block.kind
            : "time",
        scoreType:
          block?.kind === "load" || block?.kind === "reps" ? "max" : "min",
        scope: "private",
        roundsToScore: 1,
        timeCapSeconds: null,
        repsPerRound: null,
        tiebreakScheme: null,
        scalingGroupId: null,
        movementIds: [],
      },
  )
  const [guidance, setGuidance] = useState({
    scalingGuidance: block?.scalingGuidance ?? "",
    coachGuidance: block?.coachGuidance ?? "",
  })
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof getTrainingWorkoutOptionsFn>
  > | null>(null)
  const [loadError, setLoadError] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [errors, setErrors] = useState<
    Partial<Record<WorkoutDefinitionField, string>>
  >({})
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  useEffect(() => {
    onDirtyChange?.(dirty)
    return () => onDirtyChange?.(false)
  }, [dirty, onDirtyChange])
  // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter reloads the catalog after a failed request.
  useEffect(() => {
    let active = true
    setLoadError("")
    getTrainingWorkoutOptionsFn({ data: { teamId } })
      .then((result) => {
        if (active) setOptions(result)
      })
      .catch(() => {
        if (active)
          setLoadError(
            "Could not load movements and scaling groups. Try again.",
          )
      })
    return () => {
      active = false
    }
  }, [teamId, attempt])

  function close() {
    if (dirty) setDiscard(true)
    else onClose()
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!options) return
    const result = normalizedWorkoutSaveSchema.safeParse(value)
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [issue.path[0], issue.message]),
        ),
      )
      return
    }
    onSave({
      id: block?.id ?? crypto.randomUUID(),
      kind: "workout",
      title: result.data.name,
      prescription: result.data.description,
      workout: result.data,
      ...guidance,
    })
    onClose()
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{block ? "Edit workout" : "Create workout"}</DialogTitle>
          <DialogDescription>
            Define the workout and how athletes record their scores. Your
            changes become part of this session’s draft.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="min-w-0 space-y-6">
          <WorkoutDefinitionFields
            value={value}
            onChange={(patch) => {
              setValue((current) => ({ ...current, ...patch }))
              setDirty(true)
              setErrors({})
            }}
            movements={options?.movements}
            scalingGroups={options?.scalingGroups}
            errors={errors}
            autoFocus
            required
          />
          {!options && (
            <div
              role={loadError ? "alert" : "status"}
              className="space-y-2 text-sm text-muted-foreground"
            >
              <p>{loadError || "Loading movements and scaling groups…"}</p>
              {loadError && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAttempt((n) => n + 1)}
                >
                  Try again
                </Button>
              )}
            </div>
          )}
          <div className="space-y-4 border-t border-border pt-5">
            <h3 className="font-medium">Coaching notes</h3>
            <div className="space-y-2">
              <Label htmlFor="workout-scaling-guidance">Scaling options</Label>
              <Textarea
                id="workout-scaling-guidance"
                rows={3}
                maxLength={3000}
                value={guidance.scalingGuidance}
                onChange={(e) => {
                  setGuidance((current) => ({
                    ...current,
                    scalingGuidance: e.target.value,
                  }))
                  setDirty(true)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workout-coach-guidance">Coach’s guidance</Label>
              <Textarea
                id="workout-coach-guidance"
                rows={3}
                maxLength={3000}
                value={guidance.coachGuidance}
                onChange={(e) => {
                  setGuidance((current) => ({
                    ...current,
                    coachGuidance: e.target.value,
                  }))
                  setDirty(true)
                }}
              />
            </div>
          </div>
          {discard ? (
            <div role="alert" className="space-y-3 border-t border-border pt-4">
              <p className="text-sm">Discard your unsaved workout changes?</p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDiscard(false)}
                >
                  Keep editing
                </Button>
                <Button type="button" variant="destructive" onClick={onClose}>
                  Discard changes
                </Button>
              </div>
            </div>
          ) : (
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={!options}>
                {block ? "Apply changes" : "Add to session"}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
