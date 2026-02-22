/**
 * @fileoverview Agent exports.
 *
 * Export the competition router as the main entry point,
 * plus individual agents for direct access if needed.
 */

// Main router agent (recommended entry point)
export { competitionRouter } from "./competition-router"

// Sub-agents (for direct access)
export { setupAgent } from "./setup-agent"
export { operationsAgent } from "./operations-agent"
export { registrationAgent } from "./registration-agent"
export { financeAgent } from "./finance-agent"

// Legacy agent (kept for backwards compatibility)
export { competitionPlanner } from "./competition-planner"
