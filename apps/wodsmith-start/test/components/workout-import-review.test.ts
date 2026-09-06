import { describe, expect, it } from "vitest"
import { applyReviewedFields, changedFields, undoReviewedFields } from "@/components/workout-import/review-state"

describe("workout import review", () => {
  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Concurrent edits]]
  it("accepts only selected changes and keeps edits made during inference", () => {
    const baseline = { name: "Workout", description: "3 rounds", timeCap: 900 }
    const proposed = Object.freeze({ name: "Three rounds", description: "3 rounds for time", timeCap: 720 })
    const current = { ...baseline, description: "My corrected prescription" }
    const result = applyReviewedFields(current, baseline, proposed, changedFields(baseline, proposed))
    expect(result.value).toEqual({ name: "Three rounds", description: "My corrected prescription", timeCap: 720 })
    expect(result.conflicts).toEqual(["description"])
    expect(proposed.description).toBe("3 rounds for time")
    expect(applyReviewedFields(baseline, baseline, proposed, ["timeCap"]).value.name).toBe("Workout")
  })

  // @lat: [[workout-import-ux-tests#Workout Import UX Tests#Undo preserves later edits]]
  it("undoes an accepted proposal without discarding subsequent manual edits", () => {
    const before = { name: "Workout", timeCap: 900, movementIds: ["pull-up"] }
    const after = { name: "Capped workout", timeCap: 720, movementIds: ["pull-up", "squat"] }
    const current = { ...after, name: "My workout" }
    expect(undoReviewedFields(current, { before, after, fields: changedFields(before, after) })).toEqual({
      value: { ...before, name: "My workout" },
      applied: ["timeCap", "movementIds"],
      conflicts: ["name"],
    })
  })
})
