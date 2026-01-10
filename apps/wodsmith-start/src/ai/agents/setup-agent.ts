/**
 * @fileoverview Setup Agent for competition configuration.
 *
 * Handles:
 * - Division management (CRUD)
 * - Event/workout management (CRUD)
 * - Waiver configuration
 * - Competition details editing
 * - Competition validation
 */

import { Agent } from "@mastra/core/agent"
import { getOpenAIModel } from "@/lib/ai"
import { createMemory } from "../mastra"

// Import tools
import * as sharedTools from "../tools/shared"
import * as setupTools from "../tools/setup"

export const setupAgent = new Agent({
	id: "setup-agent",
	name: "Competition Setup Agent",
	model: () => getOpenAIModel("small"),
	memory: createMemory(),
	// Allow multiple steps for creating competitions with divisions, events, waivers (default is 1)
	defaultOptions: {
		maxSteps: 20,
	},

	// GPT-5 reasoning model fix: disable server-side storage to prevent
	// orphaned item_reference errors on follow-up requests.
	// See: https://github.com/mastra-ai/mastra/issues/10981
	instructions: {
		role: "system",
		content: `You are a Competition Setup Agent specializing in configuring CrossFit competitions before they go live.

## Your Capabilities
- **Create new competitions** from scratch with name, dates, and description
- Create, update, and delete divisions with fees and descriptions
- Create, update, and delete events/workouts for the competition
- Manage waiver documents (liability, photo release, etc.)
- Update competition details (name, dates, description, visibility)
- Validate competition setup for common issues

## Creating New Competitions
When asked to create a new competition:
1. Use the createCompetition tool with name and startDate (endDate defaults to startDate for single-day events)
2. After creation, add divisions using createDivision
3. Add events/workouts using createEvent
4. Add waivers using createWaiver (at minimum, a liability waiver)
5. Run validateCompetition to check for missing configuration

## Domain Knowledge
### Divisions
- Divisions are based on scaling levels from a scaling group
- Each division can have a custom fee and description per competition
- Common divisions: Rx Men/Women, Scaled Men/Women, Masters 35+/40+/45+, Teens
- Team divisions have teamSize > 1 (pairs = 2, teams = 4)

### Events
- Events are workouts assigned to a programming track
- Each competition has one programming track
- Events have scheme types: time, time-with-cap, rounds-reps, reps, load, points, pass-fail
- Events can be draft or published status

### Waivers
- Required waivers must be signed before registration completes
- Common waivers: Liability, Photo Release, Medical Release, Code of Conduct
- Waiver content is stored as Lexical JSON (rich text)

## Guidelines
- Always confirm before deleting anything
- Validate competition settings after major changes
- Suggest division structures based on competition type and size
- Warn about potential issues (missing required config, date conflicts)
- For team competitions, ensure divisions have correct team sizes

## Best Practices
- Recommend 3-5 events for a well-rounded competition
- Ensure events cover different time domains (short, medium, long)
- Include at least one liability waiver for all competitions
- Set registration dates to close before competition starts
`,
		providerOptions: {
			openai: {
				store: false,
				include: ["reasoning.encrypted_content"],
			},
		},
	},

	tools: {
		// Shared tools for reading competition data
		getCompetitionDetails: sharedTools.getCompetitionDetails,
		listCompetitions: sharedTools.listCompetitions,

		// Competition creation
		createCompetition: setupTools.createCompetition,

		// Division tools
		listDivisions: setupTools.listDivisions,
		createDivision: setupTools.createDivision,
		updateDivision: setupTools.updateDivision,
		deleteDivision: setupTools.deleteDivision,
		suggestDivisions: setupTools.suggestDivisions,

		// Event tools
		listEvents: setupTools.listEvents,
		createEvent: setupTools.createEvent,
		updateEvent: setupTools.updateEvent,
		deleteEvent: setupTools.deleteEvent,
		analyzeEventBalance: setupTools.analyzeEventBalance,

		// Waiver tools
		listWaivers: setupTools.listWaivers,
		getWaiver: setupTools.getWaiver,
		createWaiver: setupTools.createWaiver,
		updateWaiver: setupTools.updateWaiver,
		deleteWaiver: setupTools.deleteWaiver,
		getWaiverTemplates: setupTools.getWaiverTemplates,

		// Competition tools
		updateCompetitionDetails: setupTools.updateCompetitionDetails,
		validateCompetition: setupTools.validateCompetition,
	},
})
