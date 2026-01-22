/**
 * @fileoverview Mastra instance for local development and CLI tools.
 *
 * This file exports a Mastra instance configured for local development
 * using in-memory storage. For production, agents are configured through
 * the TanStack Start server with Cloudflare D1 storage.
 *
 * Run `pnpm mastra:dev` to start Mastra Studio locally.
 */

import { Mastra } from "@mastra/core"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"

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

/**
 * Create a simple in-memory storage for local development.
 * This allows testing agents without Cloudflare bindings.
 */
function createLocalMemory() {
	return new Memory({
		options: {
			lastMessages: 20,
		},
	})
}

/**
 * Wrap an agent with local memory for development.
 * In production, agents use Cloudflare D1 + Vectorize.
 *
 * Note: Uses type assertion to access internal agent config since
 * Agent class doesn't expose config properties directly.
 */
function withLocalMemory(agent: Agent): Agent {
	// Access internal config via type assertion for development purposes
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const agentConfig = (agent as any).__config
	return new Agent({
		...agentConfig,
		memory: createLocalMemory(),
	})
}

/**
 * Mastra instance for local development.
 *
 * Provides access to:
 * - All competition management agents
 * - Workflows for multi-step operations
 * - Tools for direct invocation
 *
 * Note: This uses in-memory storage. Production uses Cloudflare D1.
 */
export const mastra = new Mastra({
	agents: {
		competitionRouter: withLocalMemory(competitionRouter),
		setupAgent: withLocalMemory(setupAgent),
		operationsAgent: withLocalMemory(operationsAgent),
		registrationAgent: withLocalMemory(registrationAgent),
		financeAgent: withLocalMemory(financeAgent),
		competitionPlanner: withLocalMemory(competitionPlanner),
	},
	workflows: {
		publishCompetitionWorkflow,
	},
})

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
