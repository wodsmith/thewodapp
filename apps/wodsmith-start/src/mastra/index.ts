/**
 * @fileoverview Mastra Studio entry point for local development.
 *
 * This file exports a Mastra instance for `mastra dev` (Studio).
 * It defines agents WITHOUT tools or Cloudflare bindings since Studio
 * runs in Node.js, not Cloudflare Workers.
 *
 * For production, agents are configured through TanStack Start server
 * with PlanetScale storage — see `./agents/` and `./mastra.ts`.
 *
 * Run `pnpm mastra:dev` to start Mastra Studio at http://localhost:4111
 */

import { Mastra } from "@mastra/core/mastra"
import { Agent } from "@mastra/core/agent"
import { Memory } from "@mastra/memory"
import { PlanetScaleStore } from "../ai/storage"

// NOTE: We intentionally do NOT import from ./agents or ./tools here
// because they transitively import `cloudflare:workers` which is not
// available in the Node.js runtime used by `mastra dev`.

/**
 * Shared memory for studio agents.
 * Uses PlanetScale for persistent storage when DATABASE_URL is set,
 * otherwise falls back to in-memory storage.
 */
function createStudioMemory() {
	const databaseUrl = process.env.DATABASE_URL

	if (databaseUrl) {
		const storage = new PlanetScaleStore({
			id: "studio-memory",
			url: databaseUrl,
			tablePrefix: "mastra_",
		})
		return new Memory({
			storage,
			options: {
				lastMessages: 20,
			},
		})
	}

	return new Memory({
		options: {
			lastMessages: 20,
		},
	})
}

// ---------------------------------------------------------------------------
// Agent Definitions (mirroring ./agents/*.ts but without CF dependencies)
// ---------------------------------------------------------------------------

const setupAgent = new Agent({
	id: "setup-agent",
	name: "Competition Setup Agent",
	model: "openai/gpt-4o-mini",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Competition Setup Agent specializing in configuring CrossFit competitions.

You help organizers with:
- Creating competitions with divisions, events, and waivers
- Managing division structure (Rx, Scaled, Masters, etc.)
- Adding events/workouts to competitions
- Configuring waivers (liability, photo release, etc.)
- Validating competition setup before publishing

NOTE: In Studio mode, tools are not available. You can discuss competition setup
concepts and help organizers plan, but cannot execute database operations.`,
})

const operationsAgent = new Agent({
	id: "operations-agent",
	name: "Competition Operations Agent",
	model: "openai/gpt-4o-mini",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Competition Operations Agent for day-of competition management.

You help organizers with:
- Heat scheduling and athlete assignments
- Result entry and scoring
- Day-of logistics and timeline management
- Equipment and venue coordination

NOTE: In Studio mode, tools are not available. You can discuss operations
concepts and help organizers plan, but cannot execute database operations.`,
})

const registrationAgent = new Agent({
	id: "registration-agent",
	name: "Registration Agent",
	model: "openai/gpt-4o-mini",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Registration Agent for athlete management.

You help organizers with:
- Registration overview and statistics
- Athlete lookup and status
- Waiver completion tracking
- Division assignments and transfers

NOTE: In Studio mode, tools are not available. You can discuss registration
concepts and help organizers plan, but cannot execute database operations.`,
})

const financeAgent = new Agent({
	id: "finance-agent",
	name: "Finance Agent",
	model: "openai/gpt-4o-mini",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Finance Agent for competition revenue and reporting.

You help organizers with:
- Revenue breakdown and reporting
- Sponsor management and exports
- Financial summaries and projections
- Fee structure analysis

NOTE: In Studio mode, tools are not available. You can discuss finance
concepts and help organizers plan, but cannot execute database operations.`,
})

const competitionRouter = new Agent({
	id: "competition-router",
	name: "Competition Management Router",
	model: "openai/gpt-4o",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Functional Fitness competition management assistant helping organizers create and run successful events.

## How You Work
You route tasks to specialized sub-agents based on what the organizer needs:

### Setup Agent - Competition Configuration
Use for: divisions, events/workouts, waivers, competition details, validation

### Operations Agent - Day-of Management
Use for: heat scheduling, athlete assignments, result entry

### Registration Agent - Athlete Management
Use for: registration overview, athlete lookup, waiver status

### Finance Agent - Revenue & Reporting
Use for: revenue reports, sponsor exports, financial summaries

## Guidelines
1. Start by understanding what competition the organizer is working with
2. Route to the appropriate sub-agent based on the task
3. Provide clear, actionable responses
4. Proactively suggest related tasks
5. Warn about potential issues (incomplete setup, missing waivers, etc.)

NOTE: In Studio mode, database tools are not available. You can test agent
routing and prompt quality, but cannot execute database operations.`,
	agents: {
		setupAgent,
		operationsAgent,
		registrationAgent,
		financeAgent,
	},
})

const competitionPlanner = new Agent({
	id: "competition-planner",
	name: "Competition Planner",
	model: "openai/gpt-4o",
	memory: createStudioMemory(),
	defaultOptions: { maxSteps: 20 },
	instructions: `You are a Competition Planner that helps organizers design and plan CrossFit competitions from scratch.

You can help with:
- Competition format selection (individual, team, pairs)
- Division structure recommendations
- Event selection and programming
- Timeline and logistics planning
- Budget and pricing strategy

NOTE: In Studio mode, tools are not available. You can discuss planning
concepts and help organizers design competitions.`,
})

// ---------------------------------------------------------------------------
// Mastra Instance
// ---------------------------------------------------------------------------

export const mastra = new Mastra({
	agents: {
		competitionRouter,
		setupAgent,
		operationsAgent,
		registrationAgent,
		financeAgent,
		competitionPlanner,
	},
})
