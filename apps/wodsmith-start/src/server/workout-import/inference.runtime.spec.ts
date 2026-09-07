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

function modelResponse(value: unknown, finishReason: string | null = "stop") {
  return new Response(
    `${[
      `data: ${JSON.stringify({ id: "mock-completion", choices: [{ index: 0, delta: { role: "assistant", content: typeof value === "string" ? value : JSON.stringify(value) }, finish_reason: null }] })}`,
      `data: ${JSON.stringify({ id: "mock-completion", choices: [{ index: 0, delta: {}, finish_reason: finishReason }] })}`,
      `data: ${JSON.stringify({ response: "", usage: { prompt_tokens: 40, completion_tokens: 60, total_tokens: 100 } })}`,
      "data: [DONE]",
    ].join("\n\n")}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  )
}

describe("TanStack Cloudflare import adapter (mock binding, no live model)", () => {
  // @lat: [[workout-import-runtime#Source ambiguity classification]]
  it("routes structured source cautions to review independently of their wording", () => {
    const result = resolveImportProposal(
      {
        ...extraction,
        warnings: [
          {
            kind: "source_ambiguity",
            field: "prescription",
            message: "Please confirm this detail",
            sourceExcerpt: "135/95",
          },
          {
            kind: "suggested_name",
            message: "Please confirm this detail",
            sourceExcerpt: "Suggested title",
          },
        ],
      },
      [{ id: "squat", name: "Squat" }],
    )
    expect(result.unresolved).toEqual([
      {
        id: "source-review-0",
        field: "prescription",
        reason: "Please confirm this detail",
        sourceExcerpt: "135/95",
        choices: [],
      },
    ])
    expect(result.warnings).toEqual([
      {
        message: "Please confirm this detail",
        sourceExcerpt: "Suggested title",
      },
    ])
    expect(JSON.stringify(result)).not.toContain('"kind"')
  })

  // @lat: [[workout-import-runtime#Question envelope]]
  it("bounds generated questions while retaining every affected field and unique IDs", () => {
    const unresolved = Array.from({ length: 50 }, () => ({
      id: "movement-50",
      field: "prescription" as const,
      reason: "Confirm the prescription",
      sourceExcerpt: "source",
      choices: [],
    }))
    const result = resolveImportProposal(
      {
        ...extraction,
        workout: { ...extraction.workout, scheme: null, timeCapSeconds: null },
        unresolved,
        movementNames: Array.from({ length: 100 }, (_, i) => `movement${i}`),
      },
      [],
    )
    expect(result.unresolved.length).toBeLessThanOrEqual(50)
    expect(new Set(result.unresolved.map((q) => q.id)).size).toBe(
      result.unresolved.length,
    )
    expect(result.unresolved.map((q) => q.field)).toEqual(
      expect.arrayContaining(["prescription", "movementIds", "scheme"]),
    )
    expect(
      result.unresolved.find((q) => q.field === "movementIds")?.sourceExcerpt,
    ).toContain("movement99")
    const collision = resolveImportProposal(
      {
        ...extraction,
        workout: { ...extraction.workout, scheme: null, timeCapSeconds: null },
        unresolved: [
          { ...unresolved[0], id: "movement-1" },
          { ...unresolved[0], id: "scoring-scheme" },
        ],
        movementNames: ["unknown"],
      },
      [],
    )
    expect(new Set(collision.unresolved.map((q) => q.id)).size).toBe(
      collision.unresolved.length,
    )
  })
  // @lat: [[workout-import-runtime#Adapter transport]]
  it("transcribes images with Flash then creates the proposal with GLM through the private adapter", async () => {
    const transcript = "3 rounds for time: 10 squats. Cap 12:00."
    const run = vi
      .fn()
      .mockImplementationOnce(async () => modelResponse(transcript))
      .mockImplementationOnce(async () => modelResponse(extraction))
    const onUsage = vi.fn()
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
      onUsage,
    })
    expect(result.workout).toMatchObject({
      timeCapSeconds: 720,
      roundsToScore: 1,
      movementIds: ["squat"],
    })
    expect(run).toHaveBeenCalledTimes(2)
    const [visionModel, visionInput] = run.mock.calls[0]
    expect(visionModel).toBe("@cf/zai-org/glm-5.3-flash")
    expect(JSON.stringify(visionInput.messages)).toContain(
      "data:image/png;base64,cGl4ZWxz",
    )
    const [model, input] = run.mock.calls[1]
    expect(model).toBe("@cf/zai-org/glm-5.3")
    expect(JSON.stringify(input.messages)).toContain(transcript)
    expect(JSON.stringify(input.messages)).not.toContain("data:image")
    expect(visionInput.response_format).toBeUndefined()
    expect(input.response_format.type).toBe("json_schema")
    expect(visionInput.reasoning_effort).toBe("low")
    expect(input.reasoning_effort).toBe("low")
    expect(JSON.stringify(input.messages)).toContain("Field contract:")
    expect(JSON.stringify(input.messages)).toContain("rounds-reps")
    for (const [, request, options] of run.mock.calls) {
      expect(request.max_tokens).toBe(IMPORT_LIMITS.outputTokens)
      expect(options).toMatchObject({
        returnRawResponse: true,
        gateway: { id: "private-import", skipCache: true, collectLog: false },
      })
    }
    expect(beforeDispatch).toHaveBeenCalledTimes(2)
    expect(onUsage).toHaveBeenLastCalledWith({
      inputTokens: 80,
      outputTokens: 120,
      totalTokens: 200,
    })
    expect(result.extractedText).toBe(transcript)
  })

  // @lat: [[workout-import-runtime#Text proposal repair]]
  it("uses only GLM for text and retains one bounded schema repair", async () => {
    const run = vi
      .fn()
      .mockImplementationOnce(async () => modelResponse({}))
      .mockImplementationOnce(async () => modelResponse(extraction))
    const result = await inferWorkoutImport({
      ai: { run } as unknown as Pick<Ai, "run">,
      gatewayId: "private",
      text: "source",
      signal: new AbortController(),
      beforeDispatch: async () => {},
      checkAccess: async () => {},
      movements: [],
    })
    expect(result.workout.timeCapSeconds).toBe(720)
    expect(run.mock.calls.map(([model]) => model)).toEqual([
      "@cf/zai-org/glm-5.3",
      "@cf/zai-org/glm-5.3",
    ])
  })

  // @lat: [[workout-import-runtime#Image uncertainty review]]
  it("retains image uncertainty even when the proposal omits it", async () => {
    const text = "10 squats at [unreadable] kg"
    const run = vi
      .fn()
      .mockImplementationOnce(async () => modelResponse(text))
      .mockImplementationOnce(async () => modelResponse(extraction))
    const result = await inferWorkoutImport({
      ai: { run } as unknown as Pick<Ai, "run">,
      gatewayId: "private",
      text: "",
      imageBase64: "cGl4ZWxz",
      signal: new AbortController(),
      beforeDispatch: async () => {},
      checkAccess: async () => {},
      movements: [],
    })
    expect(result.extractedText).toBe(text)
    expect(result.unresolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "prescription",
          reason: expect.any(String),
        }),
      ]),
    )
    expect(run).toHaveBeenCalledTimes(2)
  })

  // @lat: [[workout-import-runtime#Transcription completion]]
  it("rejects incomplete plain-text OCR even when it is valid text below the size bound", async () => {
    for (const finishReason of ["length", "content_filter", "incomplete"]) {
      const run = vi
        .fn()
        .mockImplementation(async () =>
          modelResponse("For time: 10 squats", finishReason),
        )
      await expect(
        inferWorkoutImport({
          ai: { run } as unknown as Pick<Ai, "run">,
          gatewayId: "private",
          text: "",
          imageBase64: "cGl4ZWxz",
          signal: new AbortController(),
          beforeDispatch: async () => {},
          checkAccess: async () => {},
          movements: [],
        }),
      ).rejects.toMatchObject({ code: "invalid_output" })
      expect(run, `finishReason=${finishReason}`).toHaveBeenCalledTimes(1)
    }
  })

  // @lat: [[workout-import-runtime#Transcription size bound]]
  it("rejects oversized transcription before spending a proposal dispatch", async () => {
    const run = vi
      .fn()
      .mockImplementation(async () =>
        modelResponse("x".repeat(IMPORT_LIMITS.textCharacters + 1)),
      )
    await expect(
      inferWorkoutImport({
        ai: { run } as unknown as Pick<Ai, "run">,
        gatewayId: "private",
        text: "",
        imageBase64: "cGl4ZWxz",
        signal: new AbortController(),
        beforeDispatch: async () => {},
        checkAccess: async () => {},
        movements: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_output" })
    expect(run).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-import-runtime#Unreadable image isolation]]
  it("returns clarification without asking GLM to invent an unreadable image", async () => {
    const run = vi
      .fn()
      .mockImplementation(async () => modelResponse("[unreadable]"))
    const result = await inferWorkoutImport({
      ai: { run } as unknown as Pick<Ai, "run">,
      gatewayId: "private",
      text: "",
      imageBase64: "cGl4ZWxz",
      signal: new AbortController(),
      beforeDispatch: async () => {},
      checkAccess: async () => {},
      movements: [],
    })
    expect(run).toHaveBeenCalledTimes(1)
    expect(result.workout).toMatchObject({
      scheme: null,
      timeCapSeconds: null,
      roundsToScore: null,
      movementIds: [],
    })
    expect(result.unresolved).toEqual([
      expect.objectContaining({
        id: "image-readability",
        field: "prescription",
      }),
    ])
  })

  // @lat: [[workout-import-runtime#Combined source recovery]]
  it("uses pasted text when an accompanying image is unreadable, retaining the image question", async () => {
    const run = vi
      .fn()
      .mockImplementationOnce(async () => modelResponse("[unreadable]"))
      .mockImplementationOnce(async () => modelResponse(extraction))
    const result = await inferWorkoutImport({
      ai: { run } as unknown as Pick<Ai, "run">,
      gatewayId: "private",
      text: "3 rounds for time: 10 squats. Cap 12:00.",
      imageBase64: "cGl4ZWxz",
      signal: new AbortController(),
      beforeDispatch: async () => {},
      checkAccess: async () => {},
      movements: [],
    })
    expect(run).toHaveBeenCalledTimes(2)
    expect(result.workout.timeCapSeconds).toBe(720)
    expect(JSON.stringify(run.mock.calls[1][1].messages)).toContain(
      "Cap 12:00.",
    )
    expect(result.unresolved.some((q) => q.field === "prescription")).toBe(true)
  })

  // @lat: [[workout-import-runtime#Image pipeline authorization]]
  it("stops after transcription if access is revoked", async () => {
    let allowed = true
    const run = vi.fn().mockImplementation(async () => {
      allowed = false
      return modelResponse("10 squats")
    })
    await expect(
      inferWorkoutImport({
        ai: { run } as unknown as Pick<Ai, "run">,
        gatewayId: "private",
        text: "",
        imageBase64: "cGl4ZWxz",
        signal: new AbortController(),
        beforeDispatch: async () => {},
        checkAccess: async () => {
          if (!allowed) throw new Error("access_required")
        },
        movements: [],
      }),
    ).rejects.toThrow("access_required")
    expect(run).toHaveBeenCalledTimes(1)
  })

  // @lat: [[workout-import-runtime#Image pipeline budget]]
  it("does not attempt a third dispatch to repair an invalid image proposal", async () => {
    const run = vi
      .fn()
      .mockImplementationOnce(async () => modelResponse("10 squats"))
      .mockImplementation(async () => modelResponse({}))
    await expect(
      inferWorkoutImport({
        ai: { run } as unknown as Pick<Ai, "run">,
        gatewayId: "private",
        text: "",
        imageBase64: "cGl4ZWxz",
        signal: new AbortController(),
        beforeDispatch: async () => {},
        checkAccess: async () => {},
        movements: [],
      }),
    ).rejects.toMatchObject({ code: "invalid_output" })
    expect(run).toHaveBeenCalledTimes(2)
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
