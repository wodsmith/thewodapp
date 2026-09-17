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

function typeSafeResponse(
  recorded: ReadonlyArray<(typeof schemes)[number]>,
  recordedProbability = 0.95,
) {
  return {
    model: CROSSFIT_MODEL,
    answers: Object.fromEntries(
      schemes.map((scheme) => [
        scheme,
        {
          type: "noul",
          noul: recorded.includes(scheme) ? recordedProbability : 0.05,
        },
      ]),
    ),
    usage: { input_tokens: 100, output_tokens: 20 },
  }
}

function typeSafeFetch(
  recorded: ReadonlyArray<(typeof schemes)[number]>,
  recordedProbability = 0.95,
) {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify(typeSafeResponse(recorded, recordedProbability)),
      ),
    )
}

async function source(markdown: string) {
  return parseCrossFitResponse(payload(markdown), "2026-09-09")
}

describe("TypeSafe CrossFit conversion", () => {
  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#TypeSafe confidence and evidence]]
  it("keeps deterministic formats off the API and gates inferred choices by confidence", async () => {
    const deterministic = await source(
      "5 rounds for time of:\n20 squats\n\nPost time to comments.",
    )
    const unused = typeSafeFetch([])
    await expect(
      convertCrossFitSource(
        deterministic,
        { TYPESAFE_API_KEY: "test-key" },
        unused,
      ),
    ).resolves.toMatchObject({ model: null, tokens: 0 })
    expect(unused).not.toHaveBeenCalled()

    const inferred = await source("Build to a challenging power clean.")
    await expect(
      convertCrossFitSource(
        inferred,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch(["load"], 0.64),
      ),
    ).rejects.toThrow("probability")
    await expect(
      convertCrossFitSource(inferred, {}, typeSafeFetch(["load"])),
    ).rejects.toThrow("TYPESAFE_API_KEY")
    const unauthorized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("invalid key", { status: 401 }))
    await expect(
      convertCrossFitSource(
        inferred,
        { TYPESAFE_API_KEY: "test-key" },
        unauthorized,
      ),
    ).rejects.toThrow("TypeSafe API failed with 401")
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Historical TypeSafe regressions]]
  it("preserves time and load without turning a transition clock into a cap", async () => {
    const workout = await source(
      "Part A\nOn a 15-minute clock, for time:\n10 shuttle runs\n15 clean and jerks\n\nPart B\nAt 15 minutes, on a 3-minute clock:\nBuild to a 1-rep-max clean and jerk\n\nPost time and heaviest lift to comments.",
    )
    const fetcher = typeSafeFetch(["time", "load"])
    const result = await convertCrossFitSource(
      workout,
      { TYPESAFE_API_KEY: "test-key" },
      fetcher,
    )

    expect(result).toMatchObject({ model: CROSSFIT_MODEL, tokens: 120 })
    expect(result.normalized.components).toEqual([
      {
        scheme: "time",
        scoreType: "min",
        evidence: "for time",
        timeCap: null,
        roundsToScore: 1,
      },
      {
        scheme: "load",
        scoreType: "max",
        evidence: "Post time and heaviest lift to comments",
        timeCap: null,
        roundsToScore: 1,
      },
    ])
    const [, init] = fetcher.mock.calls[0]
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer test-key",
    )
    const request = JSON.parse(String(init?.body))
    expect(request).toMatchObject({
      model: CROSSFIT_MODEL,
      state: { prescription: expect.not.stringContaining("Scaling") },
      questions: {
        time: {
          type: "noul",
          instructions: expect.stringContaining(
            "combined scoring instruction",
          ),
          criteria: {
            true: expect.stringContaining("joined with another named score"),
          },
        },
        "rounds-reps": {
          criteria: {
            false: expect.stringContaining(
              "rep count without completed rounds",
            ),
          },
        },
        meters: {
          criteria: {
            false: expect.stringContaining("movement target"),
          },
        },
      },
    })

    const reps = await source(
      "Complete as many reps as possible in 8 minutes of:\n25 pull-ups\nMax bar muscle-ups\n\nPost reps to comments.",
    )
    const response = typeSafeResponse(["reps"])
    response.answers["rounds-reps"].noul = 0.6
    const lowConfidenceOmission = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(response)))
    await expect(
      convertCrossFitSource(
        reps,
        { TYPESAFE_API_KEY: "test-key" },
        lowConfidenceOmission,
      ),
    ).resolves.toMatchObject({
      normalized: { components: [{ scheme: "reps", scoreType: "max" }] },
    })
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Combined TypeSafe evidence]]
  it("accepts combined load-and-time evidence", async () => {
    const combined = await source(
      "For load and time:\nComplete 5 heavy cleans, then run 400 meters.\nPost time and load to comments.",
    )
    await expect(
      convertCrossFitSource(
        combined,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch(["time", "load"]),
      ),
    ).resolves.toMatchObject({
      normalized: {
        components: [
          { scheme: "time", timeCap: null },
          { scheme: "load", timeCap: null },
        ],
      },
    })
  })

  // @lat: [[crossfit-import#CrossFit Daily Import#Tests#Explicit TypeSafe caps]]
  it("uses only an explicit time cap", async () => {
    const capped = await source(
      "For time: 100 squats.\nTime cap: 10 minutes.\nPost time to comments.",
    )
    await expect(
      convertCrossFitSource(
        capped,
        { TYPESAFE_API_KEY: "test-key" },
        typeSafeFetch(["time"]),
      ),
    ).resolves.toMatchObject({
      normalized: {
        components: [
          {
            scheme: "time-with-cap",
            evidence: "Time cap: 10 minutes",
            timeCap: 600,
          },
        ],
      },
    })
  })
})
