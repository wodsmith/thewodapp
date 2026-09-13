import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"

// Checking the final Worker module catches CI accidentally building Start's
// default entrypoint, which omits custom RPC/DO/workflow exports entirely.
const entry = await readFile(
  new URL("../dist/server/index.js", import.meta.url),
  "utf8",
)
assert.match(
  entry,
  /\bAgentTrainingService\b/,
  "Built Start Worker must export AgentTrainingService",
)
assert.match(
  entry,
  /\bWorkoutImportAgent\b/,
  "Custom Worker exports must be preserved",
)
console.log("Custom Start Worker entrypoints are present")
