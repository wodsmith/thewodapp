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
import {
	setupNewCompetition,
	duplicateCompetition,
	publishCompetition,
	checkCompetitionReadiness,
} from "../tools/outcomes"
import { createWaiverSimple } from "../tools/simplified"
import {
	manageDivisions,
	manageEvents,
	manageWaivers,
} from "../tools/consolidated"

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

### HIGH-IMPACT TOOLS (Use These First!)
- **setupNewCompetition**: Create a complete competition in ONE step (divisions + events + waivers)
- **duplicateCompetition**: Clone an existing competition with modifications
- **publishCompetition**: Validate and publish atomically (prevents publishing broken setups)
- **checkCompetitionReadiness**: Comprehensive pre-event validation with actionable checklist
- **createWaiverSimple**: Add waivers using templates (no complex JSON needed)

### LEGACY TOOLS (Use only when high-impact tools don't fit)
- Create individual divisions, events, or waivers separately
- Update competition details
- Validate competition setup

## Creating New Competitions

Use **setupNewCompetition** to create a complete competition in one atomic operation:
1. Specify competition type, expected athletes, and preferences
2. Server automatically creates divisions, events, and waivers
3. Returns ready-to-customize competition

Example: "Create Spring Throwdown 2026, individual competition, 100 athletes, Rx and Scaled divisions, 4 events"
→ Use setupNewCompetition({name: "Spring Throwdown 2026", startDate: "2026-05-15", competitionType: "individual", expectedAthletes: 100, includeScaled: true, eventCount: 4})

## Tool Selection Priority

### For managing existing resources, use CONSOLIDATED tools:
1. **manageDivisions** - Single tool for all division operations (list/create/update/delete)
2. **manageEvents** - Single tool for all event operations (list/create/update/delete)
3. **manageWaivers** - Single tool for waiver operations (list/update/delete)

Example: Instead of calling listDivisions, use manageDivisions({action: "list"})
Example: Instead of createDivision, use manageDivisions({action: "create", divisionName: "Rx Men"})

### High-value outcome tools (analysis, not CRUD):
- suggestDivisions - Keep using this (provides recommendations, not just CRUD)
- analyzeEventBalance - Keep using this (provides analysis, not just CRUD)

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
- Use createWaiverSimple for template-based creation (no complex JSON)

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

		// ===== HIGH-IMPACT OUTCOME TOOLS (MCP best practices) =====
		// These tools replace multiple sequential operations with single atomic operations
		setupNewCompetition, // Replaces: createCompetition + createDivisions + createEvents + createWaivers
		duplicateCompetition, // Clone entire competition setup
		publishCompetition, // Validate + publish atomically
		checkCompetitionReadiness, // Comprehensive pre-event validation

		// ===== CONSOLIDATED CRUD TOOLS (Token budget optimization) =====
		// Unified management tools (list/create/update/delete via action parameter)
		manageDivisions, // Replaces: listDivisions, createDivision, updateDivision, deleteDivision
		manageEvents, // Replaces: listEvents, createEvent, updateEvent, deleteEvent
		manageWaivers, // Replaces: listWaivers, updateWaiver, deleteWaiver

		// ===== SIMPLIFIED TOOLS (Flattened arguments, server-side encoding) =====
		createWaiverSimple, // Template-based waiver creation (no Lexical JSON)

		// ===== HIGH-VALUE OUTCOME TOOLS (Keep separate from manage_X) =====
		suggestDivisions: setupTools.suggestDivisions, // High-value outcome tool
		analyzeEventBalance: setupTools.analyzeEventBalance, // High-value outcome tool

		// ===== COMPETITION MANAGEMENT =====
		updateCompetitionDetails: setupTools.updateCompetitionDetails,
		validateCompetition: setupTools.validateCompetition,
	},
})
