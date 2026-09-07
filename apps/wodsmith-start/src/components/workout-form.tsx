import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type {
  Movement,
  ScoreType,
  TiebreakScheme,
  WorkoutScheme,
} from "@/db/schemas/workouts"

export type WorkoutFormData = {
  name: string
  description: string
  scheme: WorkoutScheme
  scoreType?: ScoreType
  scope: "private" | "public"
  timeCap?: number
  roundsToScore?: number
  movementIds?: string[]
  repsPerRound?: number
  tiebreakScheme?: TiebreakScheme
  scalingGroupId?: string
}

// Flexible movement type that can accept partial Movement data
type MovementData = Pick<Movement, "id" | "name" | "type">

type WorkoutFormProps = {
  mode: "create" | "edit"
  initialData?: Partial<WorkoutFormData>
  onSubmit: (data: WorkoutFormData) => Promise<void>
  backUrl: string
  movements?: MovementData[]
  initialMovementIds?: string[]
  isRemix?: boolean
  /** Controlled editing makes asynchronous draft application an explicit parent action. */
  editor?: {
    value: Partial<WorkoutFormData>
    onChange: (value: Partial<WorkoutFormData>) => void
  }
  scalingGroups?: { id: string; title: string }[]
  embedded?: boolean
  submitLabel?: string
  submitDisabled?: boolean
  onCancel?: () => void
  fieldMessages?: Partial<Record<keyof WorkoutFormData, string>>
}

export function WorkoutForm({
  mode,
  initialData,
  onSubmit,
  backUrl,
  movements = [],
  initialMovementIds = [],
  isRemix = false,
  editor,
  embedded = false,
  scalingGroups = [],
  submitLabel,
  submitDisabled = false,
  onCancel,
  fieldMessages = {},
}: WorkoutFormProps) {
  const navigate = useNavigate()
  const editorId = useId()
  const fieldId = (field: string) => (embedded ? `${editorId}-${field}` : field)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial data initializes manual create/edit/remix exactly once. AI review owns
  // an explicit controlled value; incoming agent state never resets this form.
  const [localValue, setLocalValue] = useState<Partial<WorkoutFormData>>(
    () => ({
      ...initialData,
      scope: initialData?.scope ?? "private",
      movementIds: initialData?.movementIds ?? initialMovementIds,
    }),
  )
  const value = editor?.value ?? localValue
  const update = (patch: Partial<WorkoutFormData>) => {
    const next = { ...value, ...patch }
    if (editor) editor.onChange(next)
    else setLocalValue(next)
  }
  const {
    name = "",
    description = "",
    scheme,
    scoreType,
    scope = "private",
    timeCap,
    roundsToScore,
    movementIds: selectedMovements = [],
  } = value
  const cancel = () => (onCancel ? onCancel() : navigate({ to: backUrl }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!scheme) {
      setError("Please select a scheme")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        ...value,
        name,
        description,
        scheme,
        scoreType,
        scope,
        timeCap,
        roundsToScore,
        movementIds:
          selectedMovements.length > 0 ? selectedMovements : undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={embedded ? "min-w-0" : "container mx-auto max-w-2xl px-4 py-8"}
    >
      {/* Header */}
      {!embedded && (
        <div className="mb-6 flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Back to workouts"
            onClick={cancel}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">
            {isRemix
              ? "REMIX WORKOUT"
              : mode === "create"
                ? "CREATE WORKOUT"
                : "EDIT WORKOUT"}
          </h1>
        </div>
      )}

      {/* Remix notice */}
      {isRemix && (
        <div className="mb-6 p-4 bg-muted rounded-lg border">
          <p className="text-sm text-muted-foreground">
            You're creating a remix. Modify the workout below and save to create
            your own version.
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={
          embedded
            ? "space-y-5"
            : "space-y-6 border-2 border-border p-6 rounded-lg"
        }
      >
        <WorkoutDefinitionFields
          allowEmptyScoreType={false}
          value={{ ...value, timeCapSeconds: value.timeCap }}
          onChange={(patch) => {
            const {
              timeCapSeconds,
              scoreType,
              repsPerRound,
              tiebreakScheme,
              scalingGroupId,
              ...rest
            } = patch
            update({
              ...rest,
              ...("timeCapSeconds" in patch
                ? { timeCap: timeCapSeconds ?? undefined }
                : {}),
              ...("scoreType" in patch
                ? { scoreType: scoreType ?? undefined }
                : {}),
              ...("repsPerRound" in patch
                ? { repsPerRound: repsPerRound ?? undefined }
                : {}),
              ...("tiebreakScheme" in patch
                ? { tiebreakScheme: tiebreakScheme ?? undefined }
                : {}),
              ...("scalingGroupId" in patch
                ? { scalingGroupId: scalingGroupId ?? undefined }
                : {}),
            })
          }}
          movements={movements}
          scalingGroups={scalingGroups}
          disabled={isSubmitting}
          required
          errors={{ ...fieldMessages, timeCapSeconds: fieldMessages.timeCap }}
        />

        {/* Scope */}
        <div className="space-y-2">
          <Label htmlFor={fieldId("scope")} className="font-bold uppercase">
            Visibility
          </Label>
          <Select
            value={scope}
            onValueChange={(v) => update({ scope: v as "private" | "public" })}
          >
            <SelectTrigger id={fieldId("scope")} data-import-field="scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {Object.entries(fieldMessages).length > 0 && (
          <div role="alert" className="text-sm text-destructive space-y-1">
            {Object.entries(fieldMessages).map(([field, message]) => (
              <p key={field}>{message}</p>
            ))}
          </div>
        )}
        {/* Error */}
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || submitDisabled}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : (submitLabel ??
                (mode === "create" ? "Create workout" : "Save changes"))}
          </Button>
        </div>
      </form>
    </div>
  )
}
