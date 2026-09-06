import { describe, expect, it, vi } from "vitest"
import {
  guardedImportBinding,
  inferWorkoutImport,
  resolveImportProposal,
} from "./inference"
import { IMPORT_LIMITS } from "./limits"

const extraction = {
  workout: {
    name: "Three rounds",
    description: "3 rounds for time: 10 squats. Cap 12:00.",
    scheme: "time-with-cap" as const,
    scoreType: "min" as const,
    timeCapSeconds: 720,
    roundsToScore: 1,
    repsPerRound: null,
    tiebreakScheme: null,
    scalingGroupId: null,
    movementIds: [],
  },
  extractedText: "3 rounds for time: 10 squats. Cap 12:00.",
  unresolved: [],
  warnings: [],
  movementNames: ["Squat"],
}

function modelResponse(value: unknown) {
  return new Response(
    [
      `data: ${JSON.stringify({ id: "mock-completion", choices: [{ index: 0, delta: { role: "assistant", content: JSON.stringify(value) }, finish_reason: null }] })}`,
      `data: ${JSON.stringify({ id: "mock-completion", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}`,
      `data: ${JSON.stringify({ response: "", usage: { prompt_tokens: 40, completion_tokens: 60, total_tokens: 100 } })}`,
      "data: [DONE]",
    ].join("\n\n") + "\n\n",
    { headers: { "content-type": "text/event-stream" } },
  )
}

describe("TanStack Cloudflare import adapter (mock binding, no live model)", () => {
  // @lat: [[workout-import-runtime#Adapter transport]]
  it("sends vision + JSON schema through the actual adapter with private Gateway controls", async () => {
    const run = vi
      .fn()
      .mockImplementation(async () => modelResponse(extraction))
    const beforeDispatch = vi.fn().mockResolvedValue(undefined)
    const result = await inferWorkoutImport({
      ai: { run } as unknown as Pick<Ai, "run">,
      gatewayId: "private-import",
      text: "Read screenshot",
      imageBase64: "cGl4ZWxz",
      signal: new AbortController(),
      beforeDispatch,
      checkAccess: async () => {},
      movements: [{ id: "squat", name: "Squat" }],
    })
    expect(result.workout).toMatchObject({
      timeCapSeconds: 720,
      roundsToScore: 1,
      movementIds: ["squat"],
    })
    expect(run).toHaveBeenCalledTimes(1)
    const [model, input, options] = run.mock.calls[0]
    expect(model).toBe("@cf/moonshotai/kimi-k2.6")
    expect(input.response_format.type).toBe("json_schema")
    expect(JSON.stringify(input.messages)).toContain(
      "data:image/png;base64,cGl4ZWxz",
    )
    expect(input.max_tokens).toBe(IMPORT_LIMITS.outputTokens)
    expect(input.reasoning_effort).toBe("low")
    expect(options).toMatchObject({
      returnRawResponse: true,
      gateway: { id: "private-import", skipCache: true, collectLog: false },
    })
    expect(beforeDispatch).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-import-runtime#Dispatch authorization]]
  it("checks current authorization before every real provider dispatch and bounds hidden retries", async () => {
    const run = vi.fn().mockResolvedValue(modelResponse(extraction))
    const beforeDispatch = vi
      .fn()
      .mockRejectedValue(new Error("access_required"))
    const options = {
      ai: { run } as unknown as Pick<Ai, "run">,
      signal: new AbortController(),
      beforeDispatch,
    }
    const binding = guardedImportBinding(options)
    await expect(
      binding.run("@cf/meta/llama-3-8b-instruct", { prompt: "test" }),
    ).rejects.toThrow("access_required")
    expect(run).not.toHaveBeenCalled()
    beforeDispatch.mockResolvedValue(undefined)
    await binding.run("@cf/meta/llama-3-8b-instruct", { prompt: "test" })
    await expect(
      binding.run("@cf/meta/llama-3-8b-instruct", { prompt: "test" }),
    ).rejects.toThrow("rate_limited")
    expect(run).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-import-runtime#Late inference results]]
  it("discards results after revocation or cancellation", async () => {
    const controller = new AbortController()
    let permitted = true
    const run = vi.fn().mockImplementation(async () => {
      permitted = false
      return modelResponse(extraction)
    })
    await expect(
      inferWorkoutImport({
        ai: { run } as unknown as Pick<Ai, "run">,
        gatewayId: "private",
        text: "source",
        signal: controller,
        beforeDispatch: async () => {},
        checkAccess: async () => {
          if (!permitted) throw new Error("access_required")
        },
        movements: [],
      }),
    ).rejects.toThrow("access_required")
    expect(run).toHaveBeenCalledTimes(1)
    controller.abort()
    await expect(
      guardedImportBinding({
        ai: { run } as unknown as Pick<Ai, "run">,
        signal: controller,
        beforeDispatch: async () => {},
      }).run("@cf/meta/llama-3-8b-instruct", { prompt: "test" }),
    ).rejects.toThrow("cancelled")
    expect(run).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-import-runtime#Scoring and catalog validation]]
  it("resolves only unique catalog matches and surfaces invalid scoring fields", () => {
    const proposal = resolveImportProposal(
      {
        ...extraction,
        workout: {
          ...extraction.workout,
          scheme: "rounds-reps",
          timeCapSeconds: 720,
          roundsToScore: 5,
          scoreType: null,
          movementIds: ["invented"],
        },
      },
      [
        { id: "one", name: "Squat" },
        { id: "two", name: "Squat" },
      ],
    )
    expect(proposal.workout.movementIds).toEqual([])
    expect(proposal.workout.timeCapSeconds).toBeNull()
    expect(proposal.unresolved.map((q) => q.field)).toEqual(
      expect.arrayContaining(["movementIds", "scheme", "scoreType"]),
    )
  })
})
