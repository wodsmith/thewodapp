import type { NormalizedWorkoutSave } from "@/lib/workout-import/schemas"
import type { InferredCompetitionEvent } from "@/lib/workout-authoring"

// Illustrative browser fixture only; never claims live model quality.
export async function describeWorkoutFn({ data }: { data: { description: string } }): Promise<NormalizedWorkoutSave> {
  return { name: data.description.split("\n")[0] || "Workout", description: data.description,
    scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 600, roundsToScore: 1,
    repsPerRound: null, tiebreakScheme: null, scalingGroupId: null, scalingDescriptions: [], movementIds: [], scope: "private" }
}

export async function describeCompetitionEventFn({
  data,
}: {
  data: { description: string }
}): Promise<InferredCompetitionEvent> {
  const base = {
    roundsToScore: 1,
    repsPerRound: null,
    tiebreakScheme: null,
    scalingGroupId: "divisions",
    scope: "private" as const,
  }
  return {
    kind: "multi-part",
    name: "Dumbbell Squat & Clean Total",
    description: data.description,
    subEvents: [
      {
        ...base,
        name: "Part A",
        description:
          "10-9-8-7-6-5-4-3-2-1 dumbbell squats for time. 10 minute cap.",
        scheme: "time-with-cap",
        scoreType: "min",
        timeCapSeconds: 600,
        movementIds: ["movement-dumbbell-squat"],
        scalingDescriptions: [
          { scalingLevelId: "rx-men", description: "Pair of 50 lb dumbbells" },
          { scalingLevelId: "rx-women", description: "Pair of 35 lb dumbbells" },
          { scalingLevelId: "scaled-men", description: "Pair of 35 lb dumbbells" },
          { scalingLevelId: "scaled-women", description: "Pair of 20 lb dumbbells" },
        ],
      },
      {
        ...base,
        name: "Part B",
        description:
          "At 10:00, transition directly to a 1-rep-max power clean. Five-minute lifting window.",
        scheme: "load",
        scoreType: "max",
        timeCapSeconds: null,
        movementIds: ["movement-power-clean"],
        scalingDescriptions: [],
      },
    ],
  }
}
