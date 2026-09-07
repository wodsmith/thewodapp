import { RoundCapFields } from "@/components/compete/round-cap-fields"
import {
  getSchemeLabel,
  getScoreHelpText,
  getScorePlaceholder,
} from "@/components/compete/score-entry-helpers"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type {
  OwnTrainingResult,
  TrainingWorkoutScoreInput,
} from "@/lib/training/types"
import { trainingAggregationLabel } from "@/lib/training/workout-display"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"

export function initialWorkoutScore(
  workout: NormalizedWorkoutSave | undefined,
  result?: OwnTrainingResult,
): TrainingWorkoutScoreInput {
  const input = result?.details?.input
  const restoreScore = (score: string | undefined) =>
    workout?.scheme === "pass-fail" && score
      ? /^(pass|p|yes|1)$/i.test(score)
        ? "pass"
        : "fail"
      : (score ?? "")
  return {
    score: restoreScore(input?.score),
    status: input?.status ?? "scored",
    secondaryScore: input?.secondaryScore ?? "",
    unit: input?.unit ?? "lb",
    distanceUnit:
      input?.distanceUnit ?? (workout?.scheme === "feet" ? "ft" : "m"),
    tiebreakScore: input?.tiebreakScore ?? "",
    roundScores: Array.from(
      { length: workout?.roundsToScore ?? 1 },
      (_, index) => ({
        score: restoreScore(input?.roundScores?.[index]?.score),
        status: input?.roundScores?.[index]?.status ?? "scored",
        secondaryScore: input?.roundScores?.[index]?.secondaryScore ?? "",
      }),
    ),
  }
}

export function TrainingWorkoutScoreFields({
  workout,
  value,
  onChange,
  id,
}: {
  workout: NormalizedWorkoutSave
  value: TrainingWorkoutScoreInput
  onChange: (value: TrainingWorkoutScoreInput) => void
  id: string
}) {
  const multiple = workout.roundsToScore > 1
  const cap = workout.scheme === "time-with-cap"
  const unitKind =
    workout.scheme === "load"
      ? "load"
      : workout.scheme === "meters" || workout.scheme === "feet"
        ? "distance"
        : null
  const scoreLabel =
    workout.scheme === "load"
      ? "Load"
      : workout.scheme === "pass-fail"
        ? "Result"
        : getSchemeLabel(workout.scheme)
  const rows = multiple
    ? (value.roundScores ?? [])
    : [
        {
          score: value.score,
          status: value.status,
          secondaryScore: value.secondaryScore,
        },
      ]
  function changeRow(index: number, patch: Partial<(typeof rows)[number]>) {
    if (multiple)
      onChange({
        ...value,
        roundScores: rows.map((row, position) =>
          position === index ? { ...row, ...patch } : row,
        ),
      })
    else onChange({ ...value, ...patch })
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {getScoreHelpText(workout.scheme, workout.timeCapSeconds)}
        {multiple
          ? ` · ${workout.roundsToScore} separately recorded scores · ${trainingAggregationLabel(workout.scoreType)}`
          : ""}
      </p>
      {unitKind ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-workout-unit`}>
            {unitKind === "load" ? "Load unit" : "Distance unit"}
          </Label>
          <select
            id={`${id}-workout-unit`}
            className="min-h-11 w-full rounded-md border border-input bg-background px-3"
            value={unitKind === "load" ? value.unit : value.distanceUnit}
            onChange={(event) =>
              onChange(
                unitKind === "load"
                  ? { ...value, unit: event.target.value as "lb" | "kg" }
                  : {
                      ...value,
                      distanceUnit: event.target
                        .value as TrainingWorkoutScoreInput["distanceUnit"],
                    },
              )
            }
          >
            {unitKind === "load" ? (
              <>
                <option value="lb">lb</option>
                <option value="kg">kg</option>
              </>
            ) : (
              <>
                <option value="m">m</option>
                <option value="km">km</option>
                <option value="ft">ft</option>
                <option value="mi">mi</option>
              </>
            )}
          </select>
        </div>
      ) : null}
      {rows.map((row, index) => (
        <fieldset
          key={`${id}-round-${index + 1}`}
          className="space-y-3 [&_label]:min-h-11"
        >
          <legend className="mb-2 text-sm font-medium">
            {multiple ? `Round ${index + 1}` : "Score"}
          </legend>
          <div className="space-y-2">
            <Label htmlFor={`${id}-score-${index}`}>
              {multiple
                ? `Round ${index + 1} ${scoreLabel.toLowerCase()}`
                : scoreLabel}
            </Label>
            {workout.scheme === "pass-fail" ? (
              <select
                id={`${id}-score-${index}`}
                required
                className="min-h-11 w-full rounded-md border border-input bg-background px-3"
                value={row.score}
                onChange={(event) =>
                  changeRow(index, { score: event.target.value })
                }
              >
                <option value="">Choose a result</option>
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
              </select>
            ) : (
              <Input
                id={`${id}-score-${index}`}
                type="text"
                inputMode={
                  workout.scheme === "load" || unitKind === "distance"
                    ? "decimal"
                    : "text"
                }
                placeholder={getScorePlaceholder(workout.scheme)}
                required={row.status !== "cap"}
                disabled={row.status === "cap"}
                value={row.score}
                onChange={(event) =>
                  changeRow(index, { score: event.target.value })
                }
              />
            )}
            {row.status === "cap" ? (
              <p className="text-sm text-muted-foreground">
                Recorded at the prescribed time cap.
              </p>
            ) : null}
          </div>
          {cap ? (
            <RoundCapFields
              roundNumber={index + 1}
              value={{
                status: row.status ?? "scored",
                secondaryScore: row.secondaryScore ?? "",
              }}
              onChange={(next) => changeRow(index, next)}
            />
          ) : null}
        </fieldset>
      ))}
      {workout.tiebreakScheme ? (
        <div className="space-y-2">
          <Label htmlFor={`${id}-tiebreak`}>
            Tiebreak {workout.tiebreakScheme === "time" ? "time" : "reps"}
          </Label>
          <Input
            id={`${id}-tiebreak`}
            type="text"
            placeholder={getScorePlaceholder(workout.tiebreakScheme)}
            value={value.tiebreakScore ?? ""}
            onChange={(event) =>
              onChange({ ...value, tiebreakScore: event.target.value })
            }
          />
          <p className="text-sm text-muted-foreground">
            {getScoreHelpText(workout.tiebreakScheme)} Optional.
          </p>
        </div>
      ) : null}
    </div>
  )
}
