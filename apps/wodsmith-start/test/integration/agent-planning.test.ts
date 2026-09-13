import { describe, expect, it, vi } from "vitest"
import type { AgentActor } from "@repo/agent-auth"
import type { TrainingPlanningDependencies } from "@/server/training-plans"
const state = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock("@/server/training-plans", async (original) => ({
  ...(await original<typeof import("@/server/training-plans")>()),
  createTrainingPlanningService: () => ({ get: state.get }),
}))
import {
  executePlanningOperation,
  listPlanningOperations,
} from "@/agent/planning-operations"
const actor: AgentActor = {
  userId: "athlete",
  clientId: "client",
  grantId: "grant",
  scopes: ["training:read"],
  allowedTeamIds: ["gym"],
}
function dependencies() {
  return {
    db: {},
    actor,
    authorizeActor: vi.fn().mockResolvedValue(undefined),
  } as unknown as TrainingPlanningDependencies
}
describe("planning gateway contract", () => {
  // @lat: [[agent-gateway#Planning adapter]]
  it("advertises scoped canonical schemas with distinct commit annotations", () => {
    const reads = listPlanningOperations(actor)
    expect(reads.map((entry) => entry.name)).toEqual([
      "get_session_blueprint",
      "list_training_plans",
      "get_training_plan",
      "preview_training_plan",
    ])
    expect(reads.every((entry) => entry.annotations.readOnlyHint)).toBe(true)
    const all = listPlanningOperations({
      ...actor,
      scopes: ["training:read", "training:write"],
    })
    expect(all).toHaveLength(8)
    expect(
      all.every(
        (entry) =>
          entry.inputSchema.type === "object" &&
          entry.outputSchema?.type === "object",
      ),
    ).toBe(true)
    expect(
      all.find((entry) => entry.name === "commit_training_plan")?.annotations,
    ).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    })
  })
  it("loads the real blueprint only with live grant authorization", async () => {
    const deps = dependencies()
    const result = await executePlanningOperation(
      deps,
      actor,
      "get_session_blueprint",
      {},
    )
    expect(result).toMatchObject({
      ok: true,
      data: { blueprint: { version: "general-functional-fitness@1" } },
    })
    expect(deps.authorizeActor).toHaveBeenCalledWith(
      deps.db,
      actor,
      "training:read",
    )
    expect(
      await executePlanningOperation(
        { ...deps, authorizeActor: undefined },
        actor,
        "get_session_blueprint",
        {},
      ),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } })
  })
  it("rejects missing write scope and unknown blueprint versions", async () => {
    const deps = dependencies()
    expect(
      await executePlanningOperation(deps, actor, "commit_training_plan", {}),
    ).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } })
    expect(deps.authorizeActor).not.toHaveBeenCalled()
    expect(
      await executePlanningOperation(deps, actor, "get_session_blueprint", {
        version: "future",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
    expect(
      await executePlanningOperation(deps, actor, "get_session_blueprint", {
        userId: "other",
      }),
    ).toMatchObject({ ok: false, error: { code: "VALIDATION" } })
  })
  it.each([
    ["REVISION_CONFLICT", "CONFLICT"],
    ["PLAN_COMMITTED", "CONFLICT"],
    ["PREVIEW_STALE", "CONFLICT"],
    ["IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT", "CONFLICT"],
    ["INVALID_INPUT", "VALIDATION"],
    ["MISSING_INPUTS", "VALIDATION"],
    ["EMPTY_PLAN", "VALIDATION"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["FORBIDDEN", "FORBIDDEN"],
  ])("preserves actionable %s errors as %s", async (domainCode, code) => {
    state.get.mockRejectedValueOnce(
      new Error(`${domainCode}: Reload the proposal`),
    )
    expect(
      await executePlanningOperation(
        dependencies(),
        actor,
        "get_training_plan",
        { trainingPlanId: "plan" },
      ),
    ).toEqual({
      ok: false,
      error: { code, message: `${domainCode}: Reload the proposal` },
    })
  })
  it("sanitizes internal database errors", async () => {
    state.get.mockRejectedValueOnce(new Error("database password secret"))
    const result = await executePlanningOperation(
      dependencies(),
      actor,
      "get_training_plan",
      { trainingPlanId: "plan" },
    )
    expect(result).toMatchObject({ ok: false, error: { code: "UNAVAILABLE" } })
    expect(JSON.stringify(result)).not.toContain("secret")
  })
})
