import { describe, expect, it } from "vitest"
import { decideCompetitionResult } from "@/server/competition-results/decision"
import { normalizeSubmissionScoreAdjustment } from "@/server/competition-results/review"

const workout = {
  workoutId: "workout",
  scheme: "time-with-cap",
  scoreType: "sum",
  roundsToScore: 2,
  timeCap: 600,
  tiebreakScheme: null,
}
const cappedResult = (reps: string) =>
  decideCompetitionResult(
    {
      status: "scored",
      roundScores: [
        { score: "4:00" },
        { score: "", status: "cap", secondaryScore: reps },
      ],
    },
    workout,
  )

describe("competition result invariants", () => {
  // @lat: [[competition-results#Competition Result Commands#Capped round ranking]]
  it("ranks more reps at cap ahead when the round count and time tie", () => {
    const fewer = cappedResult("100"),
      more = cappedResult("150")
    expect(more.secondaryValue).toBe(150)
    expect(BigInt(more.sortKey!)).toBeLessThan(BigInt(fewer.sortKey!))
    expect(more.rounds[1]).toMatchObject({
      value: 600000,
      secondaryValue: 150,
      status: "cap",
    })
  })

  it("ranks every completed performance ahead of a faster capped performance", () => {
    const finished = decideCompetitionResult(
      { status: "scored", roundScores: [{ score: "9:00" }, { score: "9:00" }] },
      workout,
    )
    expect(BigInt(finished.sortKey!)).toBeLessThan(
      BigInt(cappedResult("150").sortKey!),
    )
  })

  it.each([undefined, []])(
    "rejects an omitted round set for a multi-round performance",
    (roundScores) => {
      expect(() =>
        decideCompetitionResult(
          { score: "14:02", status: "scored", roundScores },
          workout,
        ),
      ).toThrow("Expected 2 round scores")
    },
  )

  it("allows a terminal result without inventing rounds", () => {
    expect(decideCompetitionResult({ status: "dq" }, workout)).toMatchObject({
      status: "dq",
      rounds: [],
      scoreValue: null,
    })
  })

  it("rejects unsafe secondary integers before sort-key encoding", () => {
    expect(() => cappedResult("999999999999999999999")).toThrow("whole number")
  })

  // @lat: [[competition-results#Competition Result Commands#Adjudicated totals preserve performance facts]]
  it("preserves rounds and the aggregate time for a parent-only capped adjustment", () => {
    const result = normalizeSubmissionScoreAdjustment({
      score: "14:02",
      status: "cap",
      workout: {
        scheme: "time-with-cap",
        scoreType: "sum",
        timeCapMs: 600000,
        tiebreakScheme: null,
      },
      existingRounds: ["scored", "cap"].map((status, index) => ({
        roundNumber: index + 1,
        status,
        secondaryValue: null,
      })),
    })
    expect(result).toMatchObject({
      scoreValue: 842000,
      replaceRounds: false,
      cappedRoundCount: 1,
      isMultiRound: true,
    })
  })
})
