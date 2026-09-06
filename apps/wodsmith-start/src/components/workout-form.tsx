import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useId, useState } from "react"
import { MovementsList } from "@/components/movements-list"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  type Movement,
  SCORE_TYPE_VALUES,
  type ScoreType,
  type TiebreakScheme,
  WORKOUT_SCHEME_VALUES,
  type WorkoutScheme,
} from "@/db/schemas/workouts"

// Scheme display labels
const SCHEME_LABELS: Record<WorkoutScheme, string> = {
  time: "For Time",
  "time-with-cap": "For Time (with cap)",
  "rounds-reps": "AMRAP (Rounds + Reps)",
  reps: "Max Reps",
  emom: "EMOM",
  load: "Max Load",
  calories: "Calories",
  meters: "Meters",
  feet: "Feet",
  points: "Points",
  "pass-fail": "Pass/Fail",
}

// Score type display labels
const SCORE_TYPE_LABELS: Record<ScoreType, string> = {
  min: "Min (lowest single set wins)",
  max: "Max (highest single set wins)",
  sum: "Sum (total across rounds)",
  average: "Average (mean across rounds)",
  first: "First",
  last: "Last",
}

// Get default score type based on scheme
function getDefaultScoreType(scheme: WorkoutScheme): ScoreType {
  switch (scheme) {
    case "time":
    case "time-with-cap":
      return "min" // Lower time is better
    case "rounds-reps":
    case "reps":
    case "calories":
    case "meters":
    case "feet":
    case "load":
    case "emom":
    case "pass-fail":
    case "points":
      return "max" // Higher is better
    default:
      return "max"
  }
}

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

  const handleMovementToggle = (movementId: string) => {
    update({
      movementIds: selectedMovements.includes(movementId)
        ? selectedMovements.filter((id) => id !== movementId)
        : [...selectedMovements, movementId],
    })
  }

  const handleSchemeChange = (newScheme: WorkoutScheme) => {
    update({
      scheme: newScheme,
      scoreType: getDefaultScoreType(newScheme),
      timeCap: newScheme === "time-with-cap" ? timeCap : undefined,
    })
  }

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
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor={fieldId("name")} className="font-bold uppercase">
            Workout Name
          </Label>
          <Input
            id={fieldId("name")}
            data-import-field="name"
            type="text"
            placeholder="e.g., Fran, Cindy, Custom WOD"
            value={name}
            onChange={(e) => update({ name: e.target.value })}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label
            htmlFor={fieldId("description")}
            className="font-bold uppercase"
          >
            Description
          </Label>
          <Textarea
            id={fieldId("description")}
            data-import-field="description"
            rows={4}
            placeholder="Describe the workout (e.g., 21-15-9 reps for time of Thrusters and Pull-ups)"
            value={description}
            onChange={(e) => update({ description: e.target.value })}
            required
          />
        </div>

        {/* Movements - only show if movements are provided */}
        {movements.length > 0 && (
          <MovementsList
            movements={movements}
            selectedMovements={selectedMovements}
            onMovementToggle={handleMovementToggle}
            mode="selectable"
            variant="default"
            containerHeight="h-[300px]"
          />
        )}

        {/* Scheme */}
        <div className="space-y-2">
          <Label htmlFor={fieldId("scheme")} className="font-bold uppercase">
            Scheme
          </Label>
          <Select value={scheme ?? ""} onValueChange={handleSchemeChange}>
            <SelectTrigger id={fieldId("scheme")} data-import-field="scheme">
              <SelectValue placeholder="Select a scheme" />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_SCHEME_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SCHEME_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Score Type - only show when scheme is selected */}
        {scheme && (
          <div className="space-y-2">
            <Label
              htmlFor={fieldId("scoreType")}
              className="font-bold uppercase"
            >
              Score Type
            </Label>
            <Select
              value={scoreType ?? ""}
              onValueChange={(v) => update({ scoreType: v as ScoreType })}
            >
              <SelectTrigger
                id={fieldId("scoreType")}
                data-import-field="scoreType"
              >
                <SelectValue placeholder="Select score type" />
              </SelectTrigger>
              <SelectContent>
                {SCORE_TYPE_VALUES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {SCORE_TYPE_LABELS[st]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Time Cap - only show for time-with-cap scheme */}
        {scheme === "time-with-cap" && (
          <div className="space-y-2">
            <Label htmlFor={fieldId("timeCap")} className="font-bold uppercase">
              Time Cap (seconds)
            </Label>
            <Input
              id={fieldId("timeCap")}
              data-import-field="timeCap"
              type="number"
              placeholder="e.g., 600 (10 minutes)"
              value={timeCap ?? ""}
              onChange={(e) =>
                update({
                  timeCap: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              min="1"
            />
          </div>
        )}

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

        {/* Advanced Options */}
        <div className="space-y-2">
          <Label
            htmlFor={fieldId("roundsToScore")}
            className="font-bold uppercase"
          >
            Number of separately recorded scores
          </Label>
          <Input
            id={fieldId("roundsToScore")}
            data-import-field="roundsToScore"
            type="number"
            placeholder="1 (one final result)"
            value={roundsToScore ?? ""}
            onChange={(e) =>
              update({
                roundsToScore: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            min="1"
          />
        </div>

        {(embedded || mode === "edit") && (
          <>
            <div className="space-y-2">
              <Label htmlFor={fieldId("repsPerRound")}>
                Reps per round (optional)
              </Label>
              <Input
                id={fieldId("repsPerRound")}
                data-import-field="repsPerRound"
                type="number"
                min="1"
                value={value.repsPerRound ?? ""}
                onChange={(e) =>
                  update({
                    repsPerRound: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("tiebreakScheme")}>
                Tiebreak (optional)
              </Label>
              <Select
                value={value.tiebreakScheme ?? "none"}
                onValueChange={(v) =>
                  update({
                    tiebreakScheme:
                      v === "none" ? undefined : (v as TiebreakScheme),
                  })
                }
              >
                <SelectTrigger
                  id={fieldId("tiebreakScheme")}
                  data-import-field="tiebreakScheme"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="time">Time</SelectItem>
                  <SelectItem value="reps">Reps</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={fieldId("scalingGroupId")}>
                Scaling group (optional)
              </Label>
              <Select
                value={value.scalingGroupId ?? "none"}
                onValueChange={(id) =>
                  update({ scalingGroupId: id === "none" ? undefined : id })
                }
              >
                <SelectTrigger
                  id={fieldId("scalingGroupId")}
                  data-import-field="scalingGroupId"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {scalingGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.title}
                    </SelectItem>
                  ))}
                  {value.scalingGroupId &&
                    !scalingGroups.some(
                      (group) => group.id === value.scalingGroupId,
                    ) && (
                      <SelectItem value={value.scalingGroupId}>
                        {embedded
                          ? "Matched group is unavailable"
                          : "Current scaling group"}
                      </SelectItem>
                    )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Loads and scaling prescriptions stay in the description.
              </p>
            </div>
          </>
        )}

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
