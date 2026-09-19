import { describe, expect, it } from "vitest"

import { canonicalizeScore } from "../../src/scores"

describe("canonical competition score values", () => {
  // @lat: [[competition-results#Competition Result Commands#Canonical score variants]]
  it.each([
    {
      name: "finished time",
      input: {
        scheme: "time" as const,
        outcome: "finished" as const,
        milliseconds: 62_345,
      },
    },
    {
      name: "capped time",
      input: {
        scheme: "time-with-cap" as const,
        outcome: "capped" as const,
        capMilliseconds: 600_000,
        repsAtCap: 127,
      },
    },
    {
      name: "quantity with tiebreak",
      input: {
        scheme: "quantity" as const,
        unit: "reps" as const,
        value: 250,
        tiebreak: { scheme: "time" as const, value: 123_000 },
      },
    },
    {
      name: "pass/fail",
      input: { scheme: "pass-fail" as const, passed: true },
    },
    {
      name: "inactive",
      input: { scheme: "inactive" as const, outcome: "withdrawn" as const },
    },
  ])("accepts a canonical $name value", ({ input }) => {
    expect(canonicalizeScore(input)).toEqual({ ok: true, value: input })
  })

  // @lat: [[competition-results#Competition Result Commands#Derived multi-round aggregate]]
  it.each([
    ["min", 100],
    ["max", 300],
    ["sum", 600],
    ["average", 200],
    ["first", 100],
    ["last", 300],
  ] as const)("derives %s multi-round aggregation", (aggregation, expected) => {
    const result = canonicalizeScore({
      scheme: "multi-round",
      aggregation,
      rounds: [
        { roundNumber: 1, value: 100, outcome: "finished" },
        {
          roundNumber: 2,
          value: 200,
          outcome: "capped",
          repsAtCap: 25,
        },
        { roundNumber: 3, value: 300, outcome: "finished" },
      ],
    })

    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({
        aggregate: expected,
        cappedRoundCount: 1,
      }),
    })
  })

  // @lat: [[competition-results#Competition Result Commands#Large averages retain exact rounding]]
  it("rounds large safe-integer averages without losing precision", () => {
    const cases = [
      {
        values: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 2],
        expected: Number.MAX_SAFE_INTEGER - 1,
      },
      {
        values: [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1],
        expected: Number.MAX_SAFE_INTEGER,
      },
      {
        values: [
          Number.MAX_SAFE_INTEGER,
          Number.MAX_SAFE_INTEGER - 2,
          Number.MAX_SAFE_INTEGER - 2,
        ],
        expected: Number.MAX_SAFE_INTEGER - 1,
      },
    ]

    for (const { values, expected } of cases) {
      const result = canonicalizeScore({
        scheme: "multi-round",
        aggregation: "average",
        rounds: values.map((value, index) => ({
          roundNumber: index + 1,
          value,
          outcome: "finished",
        })),
      })

      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({ aggregate: expected }),
      })
      if (result.ok && result.value.scheme === "multi-round") {
        expect(Number.isSafeInteger(result.value.aggregate)).toBe(true)
      }
    }
  })

  // @lat: [[competition-results#Competition Result Commands#Malformed canonical facts are rejected]]
  it("rejects malformed round facts instead of repairing them", () => {
    const result = canonicalizeScore({
      scheme: "multi-round",
      aggregation: "sum",
      rounds: [
        { roundNumber: 2, value: -1, outcome: "finished", repsAtCap: 3 },
      ],
    })

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "InvalidScore",
        issues: [
          "round numbers must be contiguous and one-based",
          "round values must be non-negative safe integers",
          "finished rounds cannot carry reps at cap",
        ],
      },
    })
  })
})
