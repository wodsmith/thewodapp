/**
 * @fileoverview AI Tools index - exports all tools for agent use
 */

// Outcome-oriented tools (high-impact, replaces multiple operations)
export {
	setupNewCompetition,
	duplicateCompetition,
	publishCompetition,
	checkCompetitionReadiness,
} from "./outcomes"

// Simplified tools (flattened arguments, server-side encoding)
export { createWaiverSimple, enterResultSimple } from "./simplified"

// Shared tools (used by multiple agents)
export * as shared from "./shared"

// Setup agent tools
export * as setup from "./setup"

// Operations agent tools
export * as operations from "./operations"

// Registration agent tools
export * as registration from "./registration"

// Finance agent tools
export * as finance from "./finance"
