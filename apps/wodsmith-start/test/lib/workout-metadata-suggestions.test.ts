import { describe, expect, it } from "vitest"
import {
  hasWorkoutMetadataSuggestion,
  selectWorkoutMetadataSuggestion,
} from "@/lib/workout-metadata-suggestions"

const movements = [
  { id: "thruster", name: "Thruster", type: "weightlifting" },
  { id: "pull-up", name: "Pull-up", type: "gymnastic" },
  { id: "run", name: "Run", type: "monostructural" },
]

describe("selectWorkoutMetadataSuggestion", () => {
  it("keeps confident closed-set answers and movement probabilities", () => {
    const suggestion = selectWorkoutMetadataSuggestion(
      {
        scheme: { choice: "time", confidence: 0.9 },
        scoreType: { choice: "min", confidence: 0.8 },
        movementProbabilities: {
          thruster: 0.98,
          "pull-up": 0.91,
          run: 0.2,
        },
      },
      movements,
    )

    expect(suggestion).toMatchObject({
      scheme: "time",
      scoreType: "min",
      movements: [
        { id: "thruster", probability: 0.98 },
        { id: "pull-up", probability: 0.91 },
      ],
    })
    expect(hasWorkoutMetadataSuggestion(suggestion)).toBe(true)
  })

  it("does not promote uncertain judgments into form values", () => {
    const suggestion = selectWorkoutMetadataSuggestion(
      {
        scheme: { choice: "points", confidence: 0.2 },
        scoreType: { choice: "max", confidence: 0.3 },
        movementProbabilities: { thruster: 0.69 },
      },
      movements,
    )

    expect(suggestion).toEqual({ movements: [] })
    expect(hasWorkoutMetadataSuggestion(suggestion)).toBe(false)
  })
})
