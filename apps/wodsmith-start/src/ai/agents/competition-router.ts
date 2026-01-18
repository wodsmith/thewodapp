/**
 * @fileoverview Competition Router Agent - Top-level routing agent.
 *
 * This is the main entry point for competition management AI.
 * It routes requests to specialized sub-agents based on the task:
 * - Setup Agent: Divisions, events, waivers, competition configuration
 * - Operations Agent: Heats, scheduling, results
 * - Registration Agent: Athlete registrations, waiver status
 * - Finance Agent: Revenue, sponsors, reporting
 */

import { Agent } from "@mastra/core/agent"
import { getOpenAIModel } from "@/lib/ai"
import { createMemory } from "../mastra"

// Import sub-agents
import { setupAgent } from "./setup-agent"
import { operationsAgent } from "./operations-agent"
import { registrationAgent } from "./registration-agent"
import { financeAgent } from "./finance-agent"

// Import shared tools for direct access
import * as sharedTools from "../tools/shared"

export const competitionRouter = new Agent({
	id: "competition-router",
	name: "Competition Management Router",
	model: () => getOpenAIModel("medium"),
	// Lazy memory initialization - createMemory() accesses env.DB which is only
	// available during request handling in Cloudflare Workers
	memory: () => createMemory(),
	// Allow multiple steps for complex workflows (default is 1)
	defaultOptions: {
		maxSteps: 20,
	},

	// GPT-5 reasoning model fix: disable server-side storage to prevent
	// orphaned item_reference errors on follow-up requests.
	// See: https://github.com/mastra-ai/mastra/issues/10981
	instructions: {
		role: "system",
		content: `You are a Functional Fitness competition management assistant helping organizers create and run successful events.

## How You Work
You route tasks to specialized sub-agents based on what the organizer needs:

### Setup Agent - Competition Configuration
Use for: divisions, events/workouts, waivers, competition details, validation
Examples:
- "Create divisions for my competition"
- "Add an event called Fran"
- "Set up liability waivers"
- "Validate my competition setup"

### Operations Agent - Day-of Management
Use for: heat scheduling, athlete assignments, result entry
Examples:
- "Create heats for Event 1"
- "Assign athletes to heats"
- "Enter results for the first event"
- "Who still needs to be scheduled?"

### Registration Agent - Athlete Management
Use for: registration overview, athlete lookup, waiver status
Examples:
- "How many athletes are registered?"
- "Show registrations by division"
- "Check waiver status for an athlete"
- "Update an athlete's division"

### Finance Agent - Revenue & Reporting
Use for: revenue reports, sponsor exports, financial summaries
Examples:
- "Show revenue breakdown"
- "Export sponsors for the program"
- "What's our total registration revenue?"

## Guidelines
1. Start by understanding what competition the organizer is working with
2. Route to the appropriate sub-agent based on the task
3. Provide clear, actionable responses
4. Proactively suggest related tasks (e.g., after creating divisions, suggest adding events)
5. Warn about potential issues (incomplete setup, missing waivers, etc.)

## Competition Knowledge
- Individual competitions: Rx Men/Women, Scaled Men/Women
- Team competitions: teamSize > 1, require team names and teammates
- Events should cover different time domains (short, medium, long)
- Heat scheduling: 8-12 athletes per heat, 10-15 min between heats
- Revenue = Registration fees - Platform fees - Stripe fees

## When in Doubt
- Use getCompetitionDetails to understand the current state
- Use validateCompetition to check for issues
- Ask clarifying questions rather than making assumptions
`,
		providerOptions: {
			openai: {
				store: false,
				include: ["reasoning.encrypted_content"],
			},
		},
	},

	// Sub-agents for routing
	agents: {
		setupAgent,
		operationsAgent,
		registrationAgent,
		financeAgent,
	},

	// Direct access to shared tools for quick lookups
	tools: {
		getCompetitionDetails: sharedTools.getCompetitionDetails,
		listCompetitions: sharedTools.listCompetitions,
	},
})
