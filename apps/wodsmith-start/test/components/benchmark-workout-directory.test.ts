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
  benchmarkCategory: string | null = null,
): BenchmarkDirectoryWorkout {
  return { id, trackOrder, benchmarkCategory, workout }
}

describe("getBenchmarkWorkoutDomain", () => {
  // @lat: [[research#Benchmark Workout Directory Test#Category Mapping]]
  it.each([
    {
      category: "Strength",
      workout: benchmarkWorkout("strength", { name: "Fran", scheme: "time" }, 1, "strength"),
    },
    {
      category: "Gymnastics",
      workout: benchmarkWorkout("gymnastics", { name: "Back Squat", scheme: "load" }, 1, "gymnastics"),
    },
    {
      category: "Engine",
      workout: benchmarkWorkout("engine", { name: "Strict HSPU", scheme: "reps" }, 1, "engine"),
    },
    {
      category: "Benchmark Workouts",
      workout: benchmarkWorkout("benchmark", { name: "2K Row", scheme: "time" }, 1, "benchmark_workout"),
    },
    {
      category: "Custom Category",
      workout: benchmarkWorkout("custom", { name: "Custom", scheme: "points" }, 1, "custom_category"),
    },
  ])("maps the persisted category key to $category", ({ category, workout }) => {
    expect(getBenchmarkWorkoutDomain(workout)).toBe(category)
  })

  // @lat: [[research#Benchmark Workout Directory Test#Category Fallback]]
  it("uses the stable fallback when category data is missing", () => {
    const workout = benchmarkWorkout("unknown", {
      name: "Kettlebell Odyssey",
      scheme: "time",
    })

    expect(getBenchmarkWorkoutDomain(workout)).toBe("Uncategorized")
  })
})

describe("groupBenchmarkWorkouts", () => {
  // @lat: [[research#Benchmark Workout Directory Test#Category Ordering]]
  it("uses benchmark category order while preserving input order within each group", () => {
    const workouts = [
      benchmarkWorkout("uncategorized", { name: "Unknown", scheme: "time" }),
      benchmarkWorkout("benchmark", { name: "Fran", scheme: "time" }, 1, "benchmark_workout"),
      benchmarkWorkout("engine-first", { name: "5K Row", scheme: "time" }, 5, "engine"),
      benchmarkWorkout("gymnastics", { name: "Strict HSPU", scheme: "reps" }, 1, "gymnastics"),
      benchmarkWorkout("strength-first", { name: "Deadlift", scheme: "load" }, 99, "strength"),
      benchmarkWorkout("engine-second", { name: "1 Mile Run", scheme: "time" }, 1, "engine"),
      benchmarkWorkout("strength-second", { name: "Strict Press", scheme: "load" }, 2, "strength"),
    ]

    const groups = groupBenchmarkWorkouts(workouts)

    expect(groups.map(({ domain }) => domain)).toEqual([
      "Strength",
      "Gymnastics",
      "Engine",
      "Benchmark Workouts",
      "Uncategorized",
    ])
    expect(groups.map(({ workouts: group }) => group.map(({ id }) => id))).toEqual([
      ["strength-first", "strength-second"],
      ["gymnastics"],
      ["engine-first", "engine-second"],
      ["benchmark"],
      ["uncategorized"],
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
    }, 1, "strength"),
  ]

  // @lat: [[research#Benchmark Workout Directory Test#Directory Filtering]]
  it.each([
    ["  FRAN  ", ["classic"]],
    ["pull-up", ["classic"]],
    ["repetitions", ["skill"]],
    ["reps", ["skill"]],
    ["weight", ["strength"]],
    ["strength", ["strength"]],
  ])("filters by normalized name, movement, or result format: %s", (query, ids) => {
    expect(filterBenchmarkWorkouts(workouts, query).map(({ id }) => id)).toEqual(ids)
  })

  // @lat: [[research#Benchmark Workout Directory Test#Directory Filtering]]
  it("returns every workout in input order for an empty query", () => {
    expect(filterBenchmarkWorkouts(workouts, "   ")).toEqual(workouts)
  })
})

describe("formatBenchmarkResult", () => {
  // @lat: [[research#Benchmark Workout Directory Test#Result Labels]]
  it("labels points workouts explicitly", () => {
    expect(formatBenchmarkResult({ name: "Skill test", scheme: "points" })).toBe(
      "Points",
    )
  })
})
