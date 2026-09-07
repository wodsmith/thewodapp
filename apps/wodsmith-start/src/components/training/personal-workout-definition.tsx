import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { WorkoutDefinitionFields } from "@/components/workouts/workout-definition-fields"
import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import { getPersonalTrainingWorkoutOptionsFn } from "@/server-fns/training-personal-fns"

export function PersonalWorkoutDefinition({
  teamId,
  value,
  onChange,
  disabled,
}: {
  teamId: string
  value: NormalizedWorkoutSave
  onChange: (patch: Partial<NormalizedWorkoutSave>) => void
  disabled: boolean
}) {
  const [options, setOptions] = useState<Awaited<
    ReturnType<typeof getPersonalTrainingWorkoutOptionsFn>
  > | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry reloads catalogs after a failed request.
  useEffect(() => {
    let active = true
    setOptions(null)
    setError(false)
    getPersonalTrainingWorkoutOptionsFn({ data: { teamId } })
      .then((next) => {
        if (active) setOptions(next)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [teamId, attempt])
  return (
    <div className="space-y-5">
      <WorkoutDefinitionFields
        value={value}
        onChange={onChange}
        nameLabel="Workout name"
        required
        autoFocus
        disabled={disabled}
        fields={[
          "name",
          "description",
          "scheme",
          "scoreType",
          "timeCapSeconds",
          "roundsToScore",
          "repsPerRound",
          "tiebreakScheme",
        ]}
      />
      {options ? (
        <WorkoutDefinitionFields
          value={value}
          onChange={onChange}
          disabled={disabled}
          movements={options.movements}
          scalingGroups={options.scalingGroups}
          fields={["movementIds", "scalingGroupId"]}
        />
      ) : error ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-destructive">
            Could not load movements and scaling groups. Your workout details
            are still here.
          </p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={disabled}
            onClick={() => setAttempt((previous) => previous + 1)}
          >
            Retry movement and scaling options
          </Button>
        </div>
      ) : (
        <output className="block text-sm text-muted-foreground">
          Loading movements and scaling groups…
        </output>
      )}
    </div>
  )
}
