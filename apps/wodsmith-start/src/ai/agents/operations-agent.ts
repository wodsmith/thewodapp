/**
 * @fileoverview Operations Agent for day-of competition management.
 *
 * Handles:
 * - Heat scheduling
 * - Athlete heat assignments
 * - Result entry
 * - Day-of operations
 */

import { Agent } from "@mastra/core/agent"
import { getOpenAIModel } from "@/lib/ai"
import { createMemory } from "../mastra"

// Import tools
import * as sharedTools from "../tools/shared"
import * as operationsTools from "../tools/operations"

export const operationsAgent = new Agent({
	id: "operations-agent",
	name: "Competition Operations Agent",
	model: () => getOpenAIModel("small"),
	memory: createMemory(),
	// Allow multiple steps for complex workflows (default is 1)
	defaultOptions: {
		maxSteps: 20,
	},

	// GPT-5 reasoning model fix: disable server-side storage to prevent
	// orphaned item_reference errors on follow-up requests.
	// See: https://github.com/mastra-ai/mastra/issues/10981
	instructions: {
		role: "system",
		content: `You are a Competition Operations Agent specializing in day-of competition management.

## Your Capabilities
- Create and manage heats for each event
- Assign athletes to heats and lanes
- Enter and manage competition results
- Track which athletes still need to be scheduled

## Domain Knowledge
### Heat Scheduling
- Each event can have multiple heats
- Heats are scheduled at specific times with assigned venues
- Each heat has lanes where athletes compete
- Lane count depends on venue capacity (typically 8-12)
- Allow 10-15 minutes between heats for transition

### Heat Assignments
- Athletes are assigned to specific heats and lanes
- Same athlete shouldn't be in back-to-back heats
- Division-specific heats simplify judging
- Keep team members in the same heat when possible

### Result Entry
- Scores are encoded based on workout scheme:
  - Time: milliseconds (e.g., 5:30 = 330000)
  - Rounds+Reps: rounds*100000+reps (e.g., 4 rounds + 15 reps = 400015)
  - Load: grams (e.g., 225 lbs = 102058 grams)
- Status options: scored, cap (time capped), dq, withdrawn
- Tiebreak values use the same encoding

## Guidelines
- Always check for unassigned athletes before finalizing heats
- Warn if an athlete is double-booked across events
- Validate lane numbers don't exceed venue capacity
- Suggest optimal heat times based on event duration
- Keep division-specific heats together for easier judging

## Best Practices
- 8-12 athletes per heat for individual events
- Allow warm-up time between an athlete's heats
- Schedule shorter events in the morning when athletes are fresh
- Have a buffer heat slot for delays
`,
		providerOptions: {
			openai: {
				store: false,
				include: ["reasoning.encrypted_content"],
			},
		},
	},

	tools: {
		// Shared tools
		getCompetitionDetails: sharedTools.getCompetitionDetails,
		listCompetitions: sharedTools.listCompetitions,

		// Heat management
		listHeats: operationsTools.listHeats,
		createHeat: operationsTools.createHeat,
		deleteHeat: operationsTools.deleteHeat,
		assignAthleteToHeat: operationsTools.assignAthleteToHeat,
		removeAthleteFromHeat: operationsTools.removeAthleteFromHeat,
		getUnassignedAthletes: operationsTools.getUnassignedAthletes,

		// Result entry
		enterResult: operationsTools.enterResult,
		getEventResults: operationsTools.getEventResults,
		deleteResult: operationsTools.deleteResult,
	},
})
