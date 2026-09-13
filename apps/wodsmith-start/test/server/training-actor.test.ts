import { assertTrainingActor, assertTrainingScope, assertTrainingTeam } from "@repo/wodsmith-training"
import { expect, it } from "vitest"

// @lat: [[training-agent-services#Verification#Partial grants fail closed]]
it("rejects every partial grant while preserving plain web actors and empty restricted grants", () => {
  const grant = { grantId: "grant", clientId: "client", scopes: ["training:read"], allowedTeamIds: ["team"] }
  const fields = Object.keys(grant) as (keyof typeof grant)[]
  for (let mask = 1; mask < 15; mask++) {
    const actor = { userId: "athlete", ...Object.fromEntries(fields.filter((_, index) => mask & (1 << index)).map(key => [key, grant[key]])) }
    expect(() => assertTrainingActor(actor)).toThrow("Incomplete training grant")
    expect(() => assertTrainingScope(actor, "results:delete")).toThrow("Incomplete training grant")
    expect(() => assertTrainingTeam(actor, "other")).toThrow("Incomplete training grant")
  }
  expect(() => assertTrainingScope({ userId: "athlete" }, "results:delete")).not.toThrow()
  expect(() => assertTrainingActor({ userId: "athlete", ...grant })).not.toThrow()
  const empty = { userId: "athlete", ...grant, scopes: [], allowedTeamIds: [] }
  expect(() => assertTrainingActor(empty)).not.toThrow()
  expect(() => assertTrainingScope(empty, "training:read")).toThrow("permission is required")
  expect(() => assertTrainingTeam(empty, "team")).toThrow("outside the training grant")
  expect(() => assertTrainingActor({ userId: "athlete", ...grant, grantId: "" })).toThrow("Incomplete training grant")
})
