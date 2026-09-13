import { expect, it } from "vitest"
import { missingSchemaColumns } from "../../scripts/check-production-schema"

// @lat: [[architecture#Deployment Schema Readiness Tests]]
it("requires every committed column while allowing additional production columns", () => {
  const snapshot = { tables: {
    sessions: { name: "personal_training_sessions", columns: { compositionState: { name: "composition_state" } } },
    plans: { name: "training_plan_drafts", columns: { id: { name: "id" } } },
  } }
  expect(missingSchemaColumns(snapshot, [])).toEqual(["personal_training_sessions.composition_state", "training_plan_drafts.id"])
  expect(missingSchemaColumns(snapshot, [{ tableName: "training_plan_drafts", columnName: "id" }])).toEqual(["personal_training_sessions.composition_state"])
  expect(missingSchemaColumns(snapshot, [
    { tableName: "personal_training_sessions", columnName: "composition_state" },
    { tableName: "training_plan_drafts", columnName: "id" },
    { tableName: "legacy", columnName: "old" },
  ])).toEqual([])
})
