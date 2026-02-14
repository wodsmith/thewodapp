/**
 * @fileoverview AI module exports for production use in TanStack Start.
 *
 * This file re-exports agents, workflows, and tools for use within
 * the TanStack Start application (Cloudflare Workers runtime).
 *
 * For Mastra Studio (local dev), see `src/mastra/index.ts` instead.
 */

// Import agents
import {
	competitionRouter,
	setupAgent,
	operationsAgent,
	registrationAgent,
	financeAgent,
	competitionPlanner,
} from "./agents"

// Import workflows
import { publishCompetitionWorkflow } from "./workflows"

// Import tools for direct registration
import {
	setupNewCompetition,
	duplicateCompetition,
	publishCompetition,
	checkCompetitionReadiness,
	createWaiverSimple,
	enterResultSimple,
} from "./tools"

// Re-export for convenience
export {
	// Agents
	competitionRouter,
	setupAgent,
	operationsAgent,
	registrationAgent,
	financeAgent,
	competitionPlanner,
	// Workflows
	publishCompetitionWorkflow,
	// Tools
	setupNewCompetition,
	duplicateCompetition,
	publishCompetition,
	checkCompetitionReadiness,
	createWaiverSimple,
	enterResultSimple,
}
