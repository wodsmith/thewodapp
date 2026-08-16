import { describe, expect, it } from "vitest"
import {
  type BenchmarkDirectoryWorkout,
  filterBenchmarkWorkouts,
  formatBenchmarkResult,
  getBenchmarkWorkoutDomain,
  groupBenchmarkWorkouts,
} from "@/components/benchmark-workout-directory"

function benchmarkWorkout(
  id: string,
  workout: BenchmarkDirectoryWorkout["workout"],
  trackOrder = 1,
): BenchmarkDirectoryWorkout {
  return { id, trackOrder, workout }
}

describe("getBenchmarkWorkoutDomain", () => {
  it.each([
    {
      domain: "Strength & barbell",
      workout: benchmarkWorkout("strength", {
        name: "Heavy Day",
        scheme: "load",
        movements: [{ name: "Back Squat" }],
        tags: [{ name: "STRENGTH" }],
      }),
    },
    {
      domain: "Gymnastics & skill",
      workout: benchmarkWorkout("gymnastics", {
        name: "Max Strict HSPU",
        scheme: "reps",
        movements: [{ name: "Handstand Push-Up" }],
        tags: [{ name: "Gymnastics" }],
      }),
    },
    {
      domain: "Machines & rope",
      workout: benchmarkWorkout("machine", {
        name: "Echo Bike 50 cal",
        scheme: "time",
        movements: [{ name: "Echo Bike" }],
      }),
    },
    {
      domain: "Running",
      workout: benchmarkWorkout("run", {
        name: "5K Run",
        scheme: "time",
        movements: [{ name: "Running" }],
      }),
    },
    {
      domain: "Rowing",
      workout: benchmarkWorkout("row", {
        name: "2K Row",
        scheme: "time",
        movements: [{ name: "Rowing" }],
      }),
    },
    {
      domain: "Mixed tests",
      workout: benchmarkWorkout("mixed", {
        name: "Acid Bath",
        scheme: "time",
        movements: [
          { name: "Ski Erg" },
          { name: "Rowing" },
          { name: "Echo Bike" },
        ],
        tags: [{ name: "Mixed Modal" }],
      }),
    },
    {
      domain: "CrossFit benchmarks",
      workout: benchmarkWorkout("classic", {
        name: "Fran",
        scheme: "time",
        movements: [{ name: "Thruster" }, { name: "Pull-Up" }],
        tags: [{ name: "Girl Benchmark" }],
      }),
    },
    {
      domain: "CrossFit benchmarks",
      workout: benchmarkWorkout("classic-name", {
        name: "Karen",
        scheme: "points",
      }),
    },
    {
      domain: "CrossFit benchmarks",
      workout: benchmarkWorkout("hero-tag", {
        name: "DT",
        scheme: "time",
        tags: [{ name: "Hero" }],
      }),
    },
    {
      domain: "Other benchmarks",
      workout: benchmarkWorkout("heroic-tag", {
        name: "Novel test",
        scheme: "time",
        tags: [{ name: "Heroic" }],
      }),
    },
  ])("classifies $domain from normalized workout signals", ({ domain, workout }) => {
    expect(getBenchmarkWorkoutDomain(workout)).toBe(domain)
  })

  it("uses the stable fallback for an unrecognized benchmark", () => {
    const workout = benchmarkWorkout("unknown", {
      name: "Kettlebell Odyssey",
      scheme: "time",
      movements: [{ name: "Sandbag Carry" }],
      tags: [{ name: "Benchmark" }],
    })

    expect(getBenchmarkWorkoutDomain(workout)).toBe("Other benchmarks")
  })
})

describe("groupBenchmarkWorkouts", () => {
  it("uses canonical domain order while preserving input order within each group", () => {
    const workouts = [
      benchmarkWorkout(
        "other-first",
        { name: "Unknown One", scheme: "time" },
        6,
      ),
      benchmarkWorkout("classic", {
        name: "Fran",
        scheme: "time",
        tags: [{ name: "Girl Benchmark" }],
      }),
      benchmarkWorkout(
        "row-first",
        { name: "5K Row", scheme: "time" },
        5,
      ),
      benchmarkWorkout("running", { name: "1 Mile Run", scheme: "time" }),
      benchmarkWorkout("mixed", {
        name: "Acid Bath",
        scheme: "time",
        tags: [{ name: "Mixed Modal" }],
      }),
      benchmarkWorkout("machine", {
        name: "Echo Bike 50 cal",
        scheme: "time",
      }),
      benchmarkWorkout("gymnastics", {
        name: "Max Strict HSPU",
        scheme: "reps",
      }),
      benchmarkWorkout(
        "strength-first",
        { name: "Deadlift", scheme: "load" },
        99,
      ),
      benchmarkWorkout(
        "row-second",
        { name: "500m Row", scheme: "time" },
        1,
      ),
      benchmarkWorkout(
        "strength-second",
        { name: "Strict Press", scheme: "load" },
        2,
      ),
      benchmarkWorkout(
        "other-second",
        { name: "Unknown Two", scheme: "reps" },
        3,
      ),
    ]

    const groups = groupBenchmarkWorkouts(workouts)

    expect(groups.map(({ domain }) => domain)).toEqual([
      "Strength & barbell",
      "Gymnastics & skill",
      "Machines & rope",
      "Mixed tests",
      "Running",
      "Rowing",
      "CrossFit benchmarks",
      "Other benchmarks",
    ])
    expect(groups.map(({ workouts: group }) => group.map(({ id }) => id))).toEqual([
      ["strength-first", "strength-second"],
      ["gymnastics"],
      ["machine"],
      ["mixed"],
      ["running"],
      ["row-first", "row-second"],
      ["classic"],
      ["other-first", "other-second"],
    ])
  })
})

describe("filterBenchmarkWorkouts", () => {
  const workouts = [
    benchmarkWorkout("classic", {
      name: "Fran",
      scheme: "time",
      scoreType: "time",
      movements: [{ name: "Thruster" }, { name: "Pull-Up" }],
    }),
    benchmarkWorkout("skill", {
      name: "Pegboard Capacity",
      scheme: "reps",
      scoreType: "repetitions",
      movements: [{ name: "Pegboard Ascents" }],
    }),
    benchmarkWorkout("strength", {
      name: "Back Squat",
      scheme: "load",
      scoreType: "weight",
      movements: [{ name: "Back Squat" }],
    }),
  ]

  it.each([
    ["  FRAN  ", ["classic"]],
    ["pull-up", ["classic"]],
    ["repetitions", ["skill"]],
    ["reps", ["skill"]],
    ["weight", ["strength"]],
  ])("filters by normalized name, movement, or result format: %s", (query, ids) => {
    expect(filterBenchmarkWorkouts(workouts, query).map(({ id }) => id)).toEqual(ids)
  })

  it("returns every workout in input order for an empty query", () => {
    expect(filterBenchmarkWorkouts(workouts, "   ")).toEqual(workouts)
  })
})

describe("formatBenchmarkResult", () => {
  it("labels points workouts explicitly", () => {
    expect(formatBenchmarkResult({ name: "Skill test", scheme: "points" })).toBe(
      "Points",
    )
  })
})
