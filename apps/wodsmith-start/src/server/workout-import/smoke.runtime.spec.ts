import { beforeEach, describe, expect, it, vi } from "vitest"
import { WorkoutImportRuntimeError } from "./limits"

const infer = vi.hoisted(() => vi.fn())
vi.mock("./inference", () => ({ inferWorkoutImport: infer }))

import smoke from "../../../scripts/workout-import-smoke.worker"

const env = { AI: {} as Ai, SMOKE_GATEWAY: "test" }
beforeEach(() => vi.resetAllMocks())
describe("local smoke error boundary", () => {
  // @lat: [[workout-import-runtime#Smoke errors]]
  it("rejects malformed and oversized sources without dispatching inference", async () => {
    for (const [body, status] of [
      ["{", 400],
      ["x".repeat(2_000_001), 413],
      [JSON.stringify({ text: 3 }), 400],
    ] as const) {
      const response = await smoke.fetch(
        new Request("http://127.0.0.1/", { method: "POST", body }),
        env,
      )
      expect(response.status).toBe(status)
      expect(await response.json()).toMatchObject({
        error: "invalid_source",
        dispatches: 0,
        liveModel: false,
      })
    }
    expect(infer).not.toHaveBeenCalled()
  })
  it.each([
    ["timeout", 408],
    ["rate_limited", 429],
  ] as const)("preserves %s status", async (code, status) => {
    infer.mockRejectedValueOnce(new WorkoutImportRuntimeError(code, status))
    const response = await smoke.fetch(
      new Request("http://127.0.0.1/", {
        method: "POST",
        body: JSON.stringify({ text: "synthetic" }),
      }),
      env,
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({ error: code })
  })
})
