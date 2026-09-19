import { describe, expect, it, vi } from "vitest"
import {
  inferCompetitionEventDescription,
  inferWorkoutDescription,
  inlineScalingAssignments,
  pruneOverlappingMovementIds,
  workoutDescriptionCandidates,
} from "@/server/workout-description-inference"

const source = "Fran\n21-15-9 thrusters and pull-ups for time\nTime cap: 10 minutes\nRx: 95/65 lb\nScaled: 65/45 lb and jumping pull-ups"
const catalog = { movements: [{ id: "thruster", name: "Thruster", type: "weightlifting" }, { id: "pullup", name: "Pull-up", type: "gymnastic" }], scalingGroupId: "divisions", levels: [{ id: "rx", label: "Rx" }, { id: "scaled", label: "Scaled" }] }
function model(overrides: Record<string, unknown> = {}) {
  return vi.fn<typeof fetch>(async (_url, init) => {
    const body = JSON.parse(String(init?.body))
    const picks: Record<string, string> = { title: "t0", scheme: "time-with-cap", aggregation: "default", rounds: "1", cap: "600", tiebreak: "none", reps: "none" }
    return new Response(JSON.stringify({ answers: Object.fromEntries(Object.entries(body.questions).map(([id, raw]) => {
      const q = raw as { type: string; criteria: Record<string, string> }
      if (id in overrides) return [id, overrides[id]]
      if (q.type === "noul") return [id, { type: "noul", noul: id === "multipart" ? 0.01 : 0.99 }]
      let choice = picks[id]
      if (id.startsWith("level")) {
        const match = id.match(/level(\d+)line(\d+)/)!
        const level = Number(match[1]), line = Number(match[2])
        choice = line === 0 ? "other" : line < 3 ? "common" : line === level + 3 ? "specific" : "other"
      }
      return [id, { type: "choice", choice, confidence: 0.99, probabilities: { [choice]: 0.99 } }]
    })) }), { status: 200 })
  })
}

describe("description-first workout recognition", () => {
  it("isolates spoken division prescriptions and suppresses a generic movement contained in a selected specific movement", () => {
    const prompt =
      "10 reps down to one doing dumbbell squats with a pair of dumbbells men are 50s. Women are 35 scaled men are 35 women are 20. Then a one rep max power clean."
    const levels = [
      { id: "rx-men", label: "Rx Men" },
      { id: "rx-women", label: "Rx Women" },
      { id: "scaled-men", label: "Scaled Men" },
      { id: "scaled-women", label: "Scaled Women" },
    ]
    expect(inlineScalingAssignments(prompt, levels)).toEqual([
      {
        scalingLevelId: "rx-men",
        description:
          "10 reps down to one doing dumbbell squats with a pair of dumbbells\nmen are 50s",
      },
      {
        scalingLevelId: "rx-women",
        description:
          "10 reps down to one doing dumbbell squats with a pair of dumbbells\nWomen are 35",
      },
      {
        scalingLevelId: "scaled-men",
        description:
          "10 reps down to one doing dumbbell squats with a pair of dumbbells\nscaled men are 35",
      },
      {
        scalingLevelId: "scaled-women",
        description:
          "10 reps down to one doing dumbbell squats with a pair of dumbbells\nwomen are 20",
      },
    ])
    const movements = [
      { id: "power-clean", name: "Power Clean", type: "weightlifting" },
      { id: "clean", name: "Clean", type: "weightlifting" },
    ]
    expect(
      pruneOverlappingMovementIds(prompt, movements, ["power-clean", "clean"]),
    ).toEqual(["power-clean"])
    expect(
      pruneOverlappingMovementIds(
        `${prompt} Finish with one clean.`,
        movements,
        ["power-clean", "clean"],
      ),
    ).toEqual(["power-clean", "clean"])
  })

  it("creates a parent definition with independently scored time and load sub-events", async () => {
    const description =
      "Part A is 10 reps down to one of dumbbell squats for time with a 10 minute cap. At 10 minutes transition to a one rep max power clean with a five minute window."
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        questions: Record<string, { type: string }>
        state: { source: string }
      }
      const structure = Object.hasOwn(body.questions, "count")
      const isLoad = /power clean/i.test(body.state.source)
      return new Response(
        JSON.stringify({
          answers: Object.fromEntries(
            Object.entries(body.questions).map(([id, question]) => {
              if (question.type === "noul") {
                const included = id === "valid" ||
                  (id === "movement0" && !isLoad) ||
                  (id === "movement1" && isLoad)
                return [id, { type: "noul", noul: included ? 0.99 : 0.01 }]
              }
              let selected = "none"
              if (structure) {
                if (id === "count") selected = "2"
                else if (id === "schemePart1") selected = "time-with-cap"
                else if (id === "schemePart2") selected = "load"
                else if (id.startsWith("schemePart")) selected = "unknown"
                else if (id === "line0") selected = "part1"
                else if (id === "line1") selected = "part2"
              } else if (id === "scheme") selected = isLoad ? "load" : "time-with-cap"
              else if (id === "rounds") selected = "1"
              else if (id === "aggregation") selected = "default"
              else if (id === "cap") selected = isLoad ? "300" : "600"
              else if (id.startsWith("level")) selected = "other"
              return [
                id,
                {
                  type: "choice",
                  choice: selected,
                  confidence: 0.99,
                  probabilities: { [selected]: 0.99 },
                },
              ]
            }),
          ),
        }),
      )
    })
    const result = await inferCompetitionEventDescription(
      description,
      catalog,
      "key",
      fetcher,
    )
    expect(result).toMatchObject({
      kind: "multi-part",
      subEvents: [
        {
          name: "Part A",
          scheme: "time-with-cap",
          timeCapSeconds: 600,
          movementIds: ["thruster"],
        },
        {
          name: "Part B",
          scheme: "load",
          scoreType: "max",
          timeCapSeconds: null,
          movementIds: ["pullup"],
        },
      ],
    })
  })
  it("segments inline division prescriptions and supports compound and hyphenated durations", () => {
    const result = workoutDescriptionCandidates("For time Rx: 95 lb Scaled: 65 lb; 10-minute cap; 9 minutes and 30 seconds", ["Rx", "Scaled"])
    expect(result.lines).toEqual(["For time", "Rx: 95 lb", "Scaled: 65 lb", "10-minute cap", "9 minutes and 30 seconds"])
    expect(result.durations).toEqual(expect.arrayContaining([600, 570]))
    expect(workoutDescriptionCandidates("Fran for time. Record three scores, ten minute cap")).toMatchObject({ titles: expect.arrayContaining(["Fran"]), numbers: expect.arrayContaining([3]), durations: expect.arrayContaining([600]) })
    expect(workoutDescriptionCandidates("x".repeat(300)).titles).toHaveLength(1)
  })
  // @lat: [[workout-authoring#Workout Authoring#Description inference]]
  it("retains cap seconds, catalog movements, and the exact contextual scaling prescriptions", async () => {
    const fetcher = model()
    const result = await inferWorkoutDescription(source, catalog, "test-key", fetcher)
    expect(result).toMatchObject({ name: "Fran", scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 600, roundsToScore: 1, movementIds: ["thruster", "pullup"], scalingGroupId: "divisions" })
    expect(result.scalingDescriptions).toEqual([
      { scalingLevelId: "rx", description: "21-15-9 thrusters and pull-ups for time\nTime cap: 10 minutes\nRx: 95/65 lb" },
      { scalingLevelId: "scaled", description: "21-15-9 thrusters and pull-ups for time\nTime cap: 10 minutes\nScaled: 65/45 lb and jumping pull-ups" },
    ])
    const body = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(body.state.scalingLevels).toEqual(catalog.levels)
    expect(body.model).toBe("jev-latest")
  })
  it("does not invent a title when none is supplied", async () => {
    const result = await inferWorkoutDescription(source, catalog, "key", model({ title: { type: "choice", choice: "none", confidence: 0.99, probabilities: { none: 0.99 } } }))
    expect(result.name).toBe("time-with-cap workout")
  })
  it("uses safe defaults for an uncertain title and an irrelevant cap", async () => {
    const result = await inferWorkoutDescription(
      source,
      catalog,
      "key",
      model({
        title: {
          type: "choice",
          choice: "t0",
          confidence: 0.4,
          probabilities: { t0: 0.4 },
        },
        scheme: {
          type: "choice",
          choice: "load",
          confidence: 0.99,
          probabilities: { load: 0.99 },
        },
        cap: {
          type: "choice",
          choice: "600",
          confidence: 0.4,
          probabilities: { "600": 0.4 },
        },
      }),
    )
    expect(result).toMatchObject({
      name: "load workout",
      scheme: "load",
      timeCapSeconds: null,
    })
  })
  it("ignores uncertainty for optional fields that do not affect this workout", async () => {
    const uncertain = (choice: string) => ({
      type: "choice",
      choice,
      confidence: 0.4,
      probabilities: { [choice]: 0.4 },
    })
    const result = await inferWorkoutDescription(
      source,
      catalog,
      "key",
      model({
        aggregation: uncertain("sum"),
        tiebreak: uncertain("time"),
        reps: uncertain("45"),
      }),
    )
    expect(result).toMatchObject({
      scoreType: "min",
      tiebreakScheme: null,
      repsPerRound: null,
    })
  })
  it.each([
    ["scheme", { type: "choice", choice: "time", confidence: 0.3, probabilities: { time: 0.4 } }, /scored/],
    ["multipart", { type: "noul", noul: 0.99 }, /one scored workout/],
    ["movement0", { type: "noul", noul: 0.5 }, /Thruster/],
    ["cap", { type: "choice", choice: "123456", confidence: 1, probabilities: {} }, /incomplete/],
  ])("rejects uncertain or invalid %s answers", async (id, answer, message) => {
    await expect(inferWorkoutDescription(source, catalog, "key", model({ [id as string]: answer }))).rejects.toThrow(message as RegExp)
  })
  it("rejects missing answers and unavailable credentials without inventing defaults", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ answers: {} })))
    await expect(inferWorkoutDescription(source, catalog, "key", fetcher)).rejects.toThrow(/incomplete/)
    fetcher.mockClear()
    await expect(inferWorkoutDescription(source, catalog, "", fetcher)).rejects.toThrow(/unavailable/)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("copies title candidates and normalizes durations without confusing repetitions with seconds", () => {
    const result = workoutDescriptionCandidates('Workout called "Helen"; 3 rounds for time; 12:30 cap; rest 90 seconds')
    expect(result.titles).toContain("Helen")
    expect(result.durations).toEqual(expect.arrayContaining([750, 90]))
    expect(result.durations).not.toContain(3)
  })
})
