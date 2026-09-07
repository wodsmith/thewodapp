import { type ReactNode, useId } from "react"
import { MovementsList } from "@/components/movements-list"
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
import { SCORE_TYPES, TIEBREAK_SCHEMES, WORKOUT_SCHEMES } from "@/constants"
import type { Movement, WorkoutScheme } from "@/db/schemas/workouts"
import { DEFAULT_SCORE_TYPES } from "@/lib/scoring/constants"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

export type WorkoutDefinitionField = Exclude<
  keyof NormalizedWorkoutSave,
  "scope"
>

/** Shared authoring controls; callers own context, validation, and persistence. */
export function WorkoutDefinitionFields({
  value,
  onChange,
  movements = [],
  scalingGroups = [],
  fields,
  nameLabel = "Workout Name",
  descriptionHint = "Describe the workout athletes will perform.",
  errors = {},
  disabled = false,
  autoFocus = false,
  required = false,
  allowEmptyScoreType = true,
}: {
  value: Partial<NormalizedWorkoutSave>
  onChange: (patch: Partial<NormalizedWorkoutSave>) => void
  movements?: Pick<Movement, "id" | "name" | "type">[]
  scalingGroups?: { id: string; title: string }[]
  fields?: readonly WorkoutDefinitionField[]
  nameLabel?: string
  descriptionHint?: string
  errors?: Partial<Record<WorkoutDefinitionField, string>>
  disabled?: boolean
  autoFocus?: boolean
  required?: boolean
  allowEmptyScoreType?: boolean
}) {
  const prefix = useId()
  const id = (field: WorkoutDefinitionField) => `${prefix}-${field}`
  const visible = (field: WorkoutDefinitionField) =>
    !fields || fields.includes(field)
  const attributes = (field: WorkoutDefinitionField) => ({
    id: id(field),
    "aria-invalid": !!errors[field],
    "aria-describedby": `${id(field)}-help${errors[field] ? ` ${id(field)}-error` : ""}`,
    "data-import-field": field === "timeCapSeconds" ? "timeCap" : field,
  })
  const field = (
    key: WorkoutDefinitionField,
    label: string,
    control: ReactNode,
    hint = "",
  ) =>
    visible(key) && (
      <div className="min-w-0 space-y-2">
        <Label
          id={`${id(key)}-label`}
          htmlFor={key === "movementIds" ? undefined : id(key)}
        >
          {label}
        </Label>
        {control}
        <p
          id={`${id(key)}-help`}
          className={hint ? "text-sm text-muted-foreground" : "sr-only"}
        >
          {hint}
        </p>
        {errors[key] && (
          <p
            id={`${id(key)}-error`}
            role="alert"
            className="text-sm text-destructive"
          >
            {errors[key]}
          </p>
        )}
      </div>
    )
  const integer = (text: string) => (text === "" ? null : Number(text))

  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-4"
      data-workout-definition-fields
    >
      <legend className="sr-only">Workout details</legend>
      {field(
        "name",
        nameLabel,
        <Input
          {...attributes("name")}
          value={value.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Fran"
          maxLength={255}
          autoFocus={autoFocus}
          required={required}
        />,
      )}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {field(
          "scheme",
          "Scheme",
          <Select
            disabled={disabled}
            value={value.scheme ?? ""}
            onValueChange={(scheme) =>
              onChange({
                scheme: scheme as WorkoutScheme,
                scoreType: DEFAULT_SCORE_TYPES[scheme as WorkoutScheme],
                ...(scheme === "pass-fail" ? { tiebreakScheme: null } : {}),
                ...(scheme !== "time-with-cap" ? { timeCapSeconds: null } : {}),
              })
            }
          >
            <SelectTrigger {...attributes("scheme")} className="w-full">
              <SelectValue placeholder="Select scheme" />
            </SelectTrigger>
            <SelectContent>
              {WORKOUT_SCHEMES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>,
        )}
        {field(
          "scoreType",
          "Score Type",
          <Select
            disabled={disabled}
            value={value.scoreType ?? (allowEmptyScoreType ? "none" : "")}
            onValueChange={(scoreType) =>
              onChange({
                scoreType:
                  scoreType === "none"
                    ? null
                    : (scoreType as NormalizedWorkoutSave["scoreType"]),
              })
            }
          >
            <SelectTrigger {...attributes("scoreType")} className="w-full">
              <SelectValue placeholder="Select score type" />
            </SelectTrigger>
            <SelectContent>
              {allowEmptyScoreType && (
                <SelectItem value="none">None</SelectItem>
              )}
              {SCORE_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value="first">First recorded score</SelectItem>
              <SelectItem value="last">Last recorded score</SelectItem>
            </SelectContent>
          </Select>,
          "How separately recorded scores are combined.",
        )}
        {field(
          "roundsToScore",
          "Rounds to Score",
          <Input
            {...attributes("roundsToScore")}
            type="number"
            min={1}
            max={1000}
            step={1}
            placeholder="1"
            value={value.roundsToScore ?? ""}
            onChange={(e) =>
              onChange({ roundsToScore: integer(e.target.value) ?? undefined })
            }
          />,
          "Number of scores each athlete records, not rounds in an AMRAP.",
        )}
        {value.scheme === "time-with-cap" &&
          field(
            "timeCapSeconds",
            "Time Cap (minutes)",
            <Input
              {...attributes("timeCapSeconds")}
              type="number"
              min={1 / 60}
              step="any"
              required={required}
              value={
                value.timeCapSeconds == null ? "" : value.timeCapSeconds / 60
              }
              onChange={(e) =>
                onChange({
                  timeCapSeconds:
                    e.target.value === ""
                      ? null
                      : Math.round(Number(e.target.value) * 60),
                })
              }
            />,
            "Athletes who reach the cap record their reps completed.",
          )}
        {value.scheme !== "pass-fail" &&
          field(
            "tiebreakScheme",
            "Tiebreak Scheme (optional)",
            <Select
              disabled={disabled}
              value={value.tiebreakScheme ?? "none"}
              onValueChange={(v) =>
                onChange({
                  tiebreakScheme: v === "none" ? null : (v as "time" | "reps"),
                })
              }
            >
              <SelectTrigger
                {...attributes("tiebreakScheme")}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {TIEBREAK_SCHEMES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>,
            "Used to break ties when scores are equal.",
          )}
        {field(
          "repsPerRound",
          "Reps per Round (optional)",
          <Input
            {...attributes("repsPerRound")}
            type="number"
            min={1}
            step={1}
            value={value.repsPerRound ?? ""}
            onChange={(e) =>
              onChange({ repsPerRound: integer(e.target.value) })
            }
          />,
          "Total reps in one complete round.",
        )}
      </div>
      {field(
        "description",
        "Description",
        <Textarea
          {...attributes("description")}
          rows={6}
          value={value.description ?? ""}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={"21-15-9 reps for time:\nThrusters (95/65 lb)\nPull-ups"}
          maxLength={20000}
          required={required}
        />,
        descriptionHint,
      )}
      {field(
        "movementIds",
        "Movements (optional)",
        <fieldset
          {...attributes("movementIds")}
          aria-labelledby={`${id("movementIds")}-label`}
          tabIndex={-1}
        >
          <MovementsList
            movements={movements}
            selectedMovements={value.movementIds ?? []}
            onMovementToggle={(movementId) =>
              onChange({
                movementIds: (value.movementIds ?? []).includes(movementId)
                  ? value.movementIds?.filter((id) => id !== movementId)
                  : [...(value.movementIds ?? []), movementId],
              })
            }
            mode="selectable"
            variant="compact"
            containerHeight="h-[200px]"
            showLabel={false}
          />
        </fieldset>,
      )}
      {field(
        "scalingGroupId",
        "Scaling group (optional)",
        <Select
          disabled={disabled}
          value={value.scalingGroupId ?? "none"}
          onValueChange={(v) =>
            onChange({ scalingGroupId: v === "none" ? null : v })
          }
        >
          <SelectTrigger {...attributes("scalingGroupId")} className="w-full">
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
              !scalingGroups.some((g) => g.id === value.scalingGroupId) && (
                <SelectItem value={value.scalingGroupId}>
                  Current scaling group
                </SelectItem>
              )}
          </SelectContent>
        </Select>,
        "Loads and scaling prescriptions stay in the description.",
      )}
    </fieldset>
  )
}
