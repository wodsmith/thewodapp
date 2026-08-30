import { describe, expect, it } from "vitest"
import { normalizeAthleteSelfEntryWorkoutResult } from "@/server/workout-results"

function cappedResult(overrides: {
  secondaryScore: string
  tiebreakScore: string
}) {
  return normalizeAthleteSelfEntryWorkoutResult({
    score: "9:59",
    status: "cap",
    ...overrides,
    workout: {
      scheme: "time-with-cap",
      scoreType: "min",
      timeCap: 600,
      tiebreakScheme: "time",
    },
  })
}

describe("athlete self-entry workout-result normalization", () => {
  // @lat: [[workout-result-adapters#Workout-result Adapter Characterization#Self-entry CAP and tiebreak ordering]]
  it("ranks more completed reps ahead within the CAP bucket", () => {
    const moreReps = cappedResult({
      secondaryScore: "150",
      tiebreakScore: "1:30",
    })
    const fewerReps = cappedResult({
      secondaryScore: "100",
      tiebreakScore: "1:30",
    })

    expect(BigInt(moreReps.sortKey ?? "0")).toBeLessThan(
      BigInt(fewerReps.sortKey ?? "0"),
    )
  })

  it("uses a faster tiebreak after primary and secondary values tie", () => {
    const fasterTiebreak = cappedResult({
      secondaryScore: "150",
      tiebreakScore: "1:23",
    })
    const slowerTiebreak = cappedResult({
      secondaryScore: "150",
      tiebreakScore: "1:30",
    })

    expect(BigInt(fasterTiebreak.sortKey ?? "0")).toBeLessThan(
      BigInt(slowerTiebreak.sortKey ?? "0"),
    )
  })
})
