import { describe, expect, it, vi } from "vitest"
import { parseCrossFitResponse } from "@/lib/crossfit/source"
import {
  CROSSFIT_MODEL,
  convertCrossFitSource,
} from "@/server/crossfit-converter"

const schemes = [
  "time",
  "rounds-reps",
  "reps",
  "load",
  "calories",
  "meters",
] as const
type Scheme = (typeof schemes)[number]

interface TypeSafePlan {
  recorded: Scheme[]
  evidence?: Partial<Record<Scheme, string>>
  aggregations?: Partial<
    Record<Exclude<Scheme, "time">, "max" | "sum" | "average" | "unclear">
  >
  aggregationProbability?: number
  capProbabilities?: Record<number, number>
  capSeconds?: number | null
  multiPartProbability?: number
  movements?: string[][]
  movementProbabilities?: Record<string, number>
  multiple?: Scheme[]
  probabilities?: Partial<Record<Scheme, number>>
  recordedProbability?: number
}

const movementCatalog = [
  { id: "mov_airsquat", name: "air squat", type: "gymnastic" as const },
  { id: "mov_benchpress", name: "bench press", type: "weightlifting" as const },
  { id: "mov_burpee", name: "burpee", type: "gymnastic" as const },
  { id: "mov_cleanjerk", name: "clean and jerk", type: "weightlifting" as const },
  { id: "mov_frontsquat", name: "front squat", type: "weightlifting" as const },
  { id: "mov_lunge", name: "lunge", type: "gymnastic" as const },
  { id: "mov_powersnatch", name: "power snatch", type: "weightlifting" as const },
  { id: "mov_ropeclimb", name: "rope climb", type: "gymnastic" as const },
  { id: "mov_run", name: "run", type: "monostructural" as const },
]

function payload(markdown: string) {
  return {
    wods: {
      id: "w20260909",
      cleanID: "20260909",
      url: "/260909",
      language: "en",
      publishingState: "published",
      wodRaw: markdown,
      modified: "2026-09-08T23:55:03+0000",
    },
  }
}

function typeSafeFetch(plan: TypeSafePlan) {
  return vi.fn<typeof fetch>(async (_input, init) => {
    const request = JSON.parse(String(init?.body))
    const questions = request.questions as Record<string, unknown>
    if (questions.multi_part) {
      const answers = {
        multi_part: {
          type: "noul",
          noul: plan.multiPartProbability ?? 0.05,
        },
        ...Object.fromEntries(
          schemes.map((scheme) => [
            scheme,
            {
              type: "noul",
              noul:
                plan.probabilities?.[scheme] ??
                (plan.recorded.includes(scheme)
                  ? (plan.recordedProbability ?? 0.95)
                  : 0.05),
            },
          ]),
        ),
      }
      return new Response(
        JSON.stringify({
          model: CROSSFIT_MODEL,
          answers,
          usage: { input_tokens: 100, output_tokens: 20 },
        }),
      )
    }

    const answers: Record<string, unknown> = {}
    for (const id of Object.keys(questions)) {
      if (id.startsWith("evidence_")) {
        const scheme = id.slice("evidence_".length) as Scheme
        const needle = plan.evidence?.[scheme]
        const candidates = request.state.evidenceCandidates as Record<
          string,
          string
        >
        const choice =
          Object.entries(candidates).find(([, text]) =>
            needle ? text.includes(needle) : false,
          )?.[0] ?? "none"
        answers[id] = {
          type: "choice",
          choice,
          confidence: 0.95,
          probabilities: { [choice]: 0.95, none: choice === "none" ? 1 : 0.05 },
        }
      } else if (id.startsWith("multiple_values_")) {
        const scheme = id.slice("multiple_values_".length) as Scheme
        answers[id] = {
          type: "noul",
          noul: plan.multiple?.includes(scheme) ? 0.95 : 0.05,
        }
      } else if (id === "single_value_load") {
        answers[id] = {
          type: "noul",
          noul: plan.multiple?.includes("load") ? 0.05 : 0.95,
        }
      } else if (id.startsWith("aggregation_sum_")) {
        const scheme = id.slice("aggregation_sum_".length) as Exclude<Scheme, "time">
        const choice = plan.aggregations?.[scheme] ?? "max"
        const probability = plan.aggregationProbability ?? 0.95
        answers[id] = {
          type: "noul",
          noul: choice === "sum" ? probability : choice === "unclear" ? 0.5 : 0.05,
        }
      } else if (id.startsWith("aggregation_average_")) {
        const scheme = id.slice("aggregation_average_".length) as Exclude<Scheme, "time">
        const choice = plan.aggregations?.[scheme] ?? "max"
        const probability = plan.aggregationProbability ?? 0.95
        answers[id] = {
          type: "noul",
          noul: choice === "average" ? probability : choice === "unclear" ? 0.5 : 0.05,
        }
      } else if (id.startsWith("cap_")) {
        const candidateId = id.slice("cap_".length)
        const seconds = request.state.durationCandidates[candidateId]
          .seconds as number
        answers[id] = {
          type: "noul",
          noul:
            plan.capProbabilities?.[seconds] ??
            (plan.capSeconds === seconds ? 0.95 : 0.05),
        }
      } else if (id.startsWith("movement_")) {
        const [, eventIndexText, movementIndexText] = id.split("_")
        const eventIndex = Number(eventIndexText)
        const movementIndex = Number(movementIndexText)
        const movementId = request.state.movementCatalog[movementIndex]
          .id as string
        const selected = (
          plan.movements?.[eventIndex] ?? [movementCatalog[0].id]
        ).includes(movementId)
        answers[id] = {
          type: "noul",
          noul:
            plan.movementProbabilities?.[movementId] ??
            (selected ? 0.95 : 0.05),
        }
      }
    }
    return new Response(
      JSON.stringify({
        model: CROSSFIT_MODEL,
        answers,
        usage: { input_tokens: 200, output_tokens: 40 },
      }),
    )
  })
}

async function source(markdown: string) {
  return parseCrossFitResponse(payload(markdown), "2026-09-09")
}

describe("TypeSafe CrossFit conversion", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#TypeSafe confidence and evidence]]
  it("routes every workout semantic decision through TypeSafe", async () => {
    const workout = await source(
      "5 rounds for time of:\n20 squats\n\nPost time to comments.",
    )
    const fetcher = typeSafeFetch({
      recorded: ["time"],
      evidence: { time: "Post time" },
      capSeconds: null,
    })
    await expect(
      convertCrossFitSource(
        workout,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        fetcher,
      ),
    ).resolves.toMatchObject({
      model: CROSSFIT_MODEL,
      tokens: 600,
      normalized: {
        kind: "workout",
        structure: "single",
        score: { scheme: "time", scoreType: "min", roundsToScore: 1 },
      },
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
    const classificationRequest = JSON.parse(
      String(fetcher.mock.calls[0][1]?.body),
    )
    expect(classificationRequest.questions).toMatchObject({
      multi_part: { type: "noul" },
      time: { type: "noul" },
      meters: {
        criteria: { false: expect.stringContaining("movement target") },
      },
    })
    const detailRequest = JSON.parse(String(fetcher.mock.calls[1][1]?.body))
    expect(detailRequest.questions).toMatchObject({
      evidence_time: { type: "choice" },
      multiple_values_time: { type: "noul" },
    })

    await expect(
      convertCrossFitSource(workout, movementCatalog, {}, fetcher),
    ).rejects.toThrow("TYPESAFE_API_KEY")
    const unauthorized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("invalid key", { status: 401 }))
    await expect(
      convertCrossFitSource(
        workout,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        unauthorized,
      ),
    ).rejects.toThrow("TypeSafe API failed with 401")

    await expect(
      convertCrossFitSource(
        workout,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time"],
          evidence: { time: "Post time" },
          movementProbabilities: { mov_benchpress: 0.5 },
        }),
      ),
    ).rejects.toThrow("movement mov_benchpress probability")
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Historical TypeSafe regressions]]
  it.each([
    {
      name: "prescribed barbell weights are not load scores",
      markdown:
        "For time:\n100 hang power snatches\n\n♀ 45-lb barbell\n♂ 65-lb barbell\n\nPost your time to the comments.",
      plan: {
        recorded: ["time"] as Scheme[],
        evidence: { time: "Post your time" },
        capSeconds: null,
        movements: [["mov_powersnatch"]],
      },
      expectedMovementIds: ["mov_powersnatch"],
      expected: { scheme: "time", roundsToScore: 1 },
    },
    {
      name: "fixed-window max reps are reps rather than rounds and reps",
      markdown:
        "Complete as many reps as possible in 12 minutes of:\n2 wall walks\n2 legless rope climbs\n\nAdd 1 wall walk every round.\n\nPost reps to comments.",
      plan: {
        recorded: ["reps"] as Scheme[],
        evidence: { reps: "Post reps" },
        movements: [["mov_ropeclimb"]],
      },
      expectedMovementIds: ["mov_ropeclimb"],
      expected: { scheme: "reps", scoreType: "max" },
    },
    {
      name: "movement distance and prescribed weight are not scores",
      markdown:
        "Complete as many reps as possible in 8 minutes of:\n50-foot back rack lunges\n25 pull-ups\nMax bar muscle-ups\n\n♀ 80-lb barbell\n♂ 115-lb barbell\n\nPost reps to comments.",
      plan: {
        recorded: ["reps"] as Scheme[],
        evidence: { reps: "Post reps" },
        movements: [["mov_lunge"]],
      },
      expectedMovementIds: ["mov_lunge"],
      expected: { scheme: "reps", scoreType: "max" },
    },
    {
      name: "model-confirmed load sets use the exact sequence count",
      markdown:
        "Front squat 3-3-3-2-2-1-1 reps\n\nPost loads to comments.",
      plan: {
        recorded: ["load"] as Scheme[],
        evidence: { load: "Post loads" },
        movements: [["mov_frontsquat"]],
        multiple: ["load"] as Scheme[],
      },
      expectedMovementIds: ["mov_frontsquat"],
      expected: { scheme: "load", scoreType: "max", roundsToScore: 7 },
    },
  ])("classifies $name", async ({ markdown, plan, expected, expectedMovementIds }) => {
    await expect(
      convertCrossFitSource(
        await source(markdown),
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch(plan),
      ),
    ).resolves.toMatchObject({
      normalized: {
        structure: "single",
        movementIds: expectedMovementIds,
        score: expected,
      },
    })
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Implicit TypeSafe caps]]
  it.each([
    {
      name: "a phase window",
      markdown:
        "On a 20-minute clock:\n\nFrom 0:00-10:00, for time:\nRun 1,600 meters\n\n10:00-20:00:\nBuild to a 5-rep-max bench press\n\nPost time and load to comments.",
      capSeconds: 600,
      labels: ["Time", "Load"],
      movementIds: [["mov_run"], ["mov_benchpress"]],
    },
    {
      name: "an explicitly headed part clock",
      markdown:
        "Part A\nOn a 15-minute clock, for time:\n10 shuttle runs\n15 clean and jerks\n\nPart B\nAt 15 minutes, on a 3-minute clock:\nBuild to a 1-rep-max clean and jerk\n\nPost time and heaviest lift to comments.",
      capSeconds: 900,
      labels: ["Part A", "Part B"],
      movementIds: [
        ["mov_cleanjerk", "mov_run"],
        ["mov_cleanjerk"],
      ],
    },
  ])("uses $name as the time cap", async ({ markdown, capSeconds, labels, movementIds }) => {
    const result = await convertCrossFitSource(
      await source(markdown),
      movementCatalog,
      { TYPESAFE_API_KEY: "test-key" },
      typeSafeFetch({
        recorded: ["time", "load"],
        evidence: { time: "Post time", load: "Post time" },
        capSeconds,
        multiPartProbability: 0.95,
        movements: movementIds,
      }),
    )
    expect(result.normalized).toMatchObject({
      structure: "multi-part",
      subEvents: [
        {
          label: labels[0],
          movementIds: movementIds[0],
          score: { scheme: "time-with-cap", timeCap: capSeconds },
        },
        {
          label: labels[1],
          movementIds: movementIds[1],
          score: { scheme: "load", timeCap: null },
        },
      ],
    })
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Explicit TypeSafe caps]]
  it("uses a model-confirmed explicit cap and rejects uncertain cap relevance", async () => {
    const capped = await source(
      "For time: 100 squats.\nTime cap: 10 minutes.\nPost time to comments.",
    )
    await expect(
      convertCrossFitSource(
        capped,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time"],
          evidence: { time: "Post time" },
          capSeconds: 600,
        }),
      ),
    ).resolves.toMatchObject({
      normalized: {
        score: { scheme: "time-with-cap", timeCap: 600 },
      },
    })

    await expect(
      convertCrossFitSource(
        capped,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time"],
          evidence: { time: "Post time" },
          capProbabilities: { 600: 0.5 },
        }),
      ),
    ).rejects.toThrow("time-cap decision was uncertain")
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Combined TypeSafe evidence]]
  it("does not manufacture sub-events from two scores in one effort", async () => {
    const combined = await source(
      "For load and time:\nComplete 5 heavy cleans, then run 400 meters.\nPost time and load to comments.",
    )
    await expect(
      convertCrossFitSource(
        combined,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time", "load"],
          evidence: { time: "Post time", load: "Post time" },
        }),
      ),
    ).rejects.toThrow("single-part")
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Model-classified score details]]
  it("uses TypeSafe for aggregation and repeated-result decisions", async () => {
    const total = await source(
      "As many burpees as possible. Post total reps to comments.",
    )
    await expect(
      convertCrossFitSource(
        total,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["reps"],
          evidence: { reps: "Post total reps" },
          aggregations: { reps: "sum" },
          movements: [["mov_burpee"]],
        }),
      ),
    ).resolves.toMatchObject({
      normalized: { score: { scoreType: "sum", roundsToScore: 1 } },
    })

    await expect(
      convertCrossFitSource(
        total,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["reps"],
          evidence: { reps: "Post total reps" },
          aggregationProbability: 0.5,
          aggregations: { reps: "sum" },
          movements: [["mov_burpee"]],
        }),
      ),
    ).rejects.toThrow("aggregation was uncertain")
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Multi-part structure confidence]]
  it("holds uncertain or incomplete classifications for review", async () => {
    const workout = await source(
      "Part A\nFor time: 20 squats.\n\nPart B\nBuild to a heavy single. Post time and load to comments.",
    )
    await expect(
      convertCrossFitSource(
        workout,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time", "load"],
          multiPartProbability: 0.5,
        }),
      ),
    ).rejects.toThrow("multi-part probability")

    await expect(
      convertCrossFitSource(
        workout,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: ["time"],
          evidence: { time: "Post time" },
          multiPartProbability: 0.95,
        }),
      ),
    ).rejects.toThrow("two independently scoreable sub-events")

    const uncertainScore = await source("Build to a challenging power clean.")
    await expect(
      convertCrossFitSource(
        uncertainScore,
        movementCatalog,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch({
          recorded: [],
          probabilities: { load: 0.5 },
        }),
      ),
    ).rejects.toThrow("load probability")
  })
})
