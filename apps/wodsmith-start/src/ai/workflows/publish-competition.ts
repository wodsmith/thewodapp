/**
 * @fileoverview Publish Competition Workflow
 *
 * Multi-step workflow that validates a competition is ready for publishing:
 * 1. Load competition details
 * 2. Validate basic setup (name, dates, venue)
 * 3. Check divisions are configured
 * 4. Verify events are created
 * 5. Confirm waivers are set up (if required)
 * 6. Return comprehensive readiness report
 */

import { createWorkflow, createStep } from "@mastra/core/workflows"
import { z } from "zod"
import { getDb } from "@/db"
import {
	competitionsTable,
	scalingLevelsTable,
	waiversTable,
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schema"
import { parseCompetitionSettings } from "@/types/competitions"
import { eq, count } from "drizzle-orm"

// Schema definitions
const competitionIdSchema = z.object({
	competitionId: z.string().describe("The competition ID to validate"),
})

const competitionDataSchema = z.object({
	competitionId: z.string(),
	competition: z
		.object({
			id: z.string(),
			name: z.string(),
			status: z.string(),
			startDate: z.string().nullable(),
			endDate: z.string().nullable(),
			venue: z.string().nullable(),
			registrationStartDate: z.string().nullable(),
			registrationEndDate: z.string().nullable(),
			requiresWaiver: z.boolean().nullable(),
		})
		.nullable(),
	found: z.boolean(),
})

const validationResultSchema = z.object({
	competitionId: z.string(),
	isValid: z.boolean(),
	basicSetup: z.object({
		isValid: z.boolean(),
		issues: z.array(z.string()),
	}),
	divisions: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
	events: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
	waivers: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
	summary: z.string(),
})

// Step 1: Load competition details
const loadCompetition = createStep({
	id: "load-competition",
	inputSchema: competitionIdSchema,
	outputSchema: competitionDataSchema,
	execute: async ({ inputData }) => {
		const { competitionId } = inputData
		const db = getDb()

		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		if (!competition) {
			return {
				competitionId,
				competition: null,
				found: false,
			}
		}

		return {
			competitionId,
			competition: {
				id: competition.id,
				name: competition.name,
				status: competition.status,
				startDate: competition.startDate?.toISOString() ?? null,
				endDate: competition.endDate?.toISOString() ?? null,
				venue: null, // Venue info stored elsewhere
				registrationStartDate:
					competition.registrationOpensAt?.toISOString() ?? null,
				registrationEndDate:
					competition.registrationClosesAt?.toISOString() ?? null,
				requiresWaiver: false, // Waivers checked separately
			},
			found: true,
		}
	},
})

// Step 2: Validate basic setup
const validateBasicSetup = createStep({
	id: "validate-basic-setup",
	inputSchema: competitionDataSchema,
	outputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { competitionId, competition, found } = inputData
		const issues: string[] = []

		if (!found || !competition) {
			return {
				competitionId,
				competition,
				found,
				basicSetup: {
					isValid: false,
					issues: ["Competition not found"],
				},
			}
		}

		// Validate required fields
		if (!competition.name?.trim()) {
			issues.push("Competition name is required")
		}

		if (!competition.startDate) {
			issues.push("Start date is required")
		}

		if (!competition.endDate) {
			issues.push("End date is required")
		}

		if (
			competition.startDate &&
			competition.endDate &&
			new Date(competition.startDate) > new Date(competition.endDate)
		) {
			issues.push("End date must be after start date")
		}

		if (!competition.venue?.trim()) {
			issues.push("Venue is required")
		}

		// Validate registration dates
		if (!competition.registrationStartDate) {
			issues.push("Registration start date is recommended")
		}

		if (!competition.registrationEndDate) {
			issues.push("Registration end date is recommended")
		}

		if (
			competition.registrationEndDate &&
			competition.startDate &&
			new Date(competition.registrationEndDate) >
				new Date(competition.startDate)
		) {
			issues.push(
				"Registration should close before competition starts (recommended)",
			)
		}

		return {
			competitionId,
			competition,
			found,
			basicSetup: {
				isValid: issues.filter((i) => !i.includes("recommended")).length === 0,
				issues,
			},
		}
	},
})

// Step 3: Validate divisions
const validateDivisions = createStep({
	id: "validate-divisions",
	inputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
	}),
	outputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { competitionId, competition, found, basicSetup } = inputData
		const issues: string[] = []
		const db = getDb()

		if (!found) {
			return {
				...inputData,
				divisions: {
					isValid: false,
					count: 0,
					issues: ["Cannot validate divisions - competition not found"],
				},
			}
		}

		// Get competition settings to find scaling group
		const comp = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, competitionId),
		})

		const settings = parseCompetitionSettings(comp?.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		let divisionCount = 0
		if (scalingGroupId) {
			// Count divisions (scaling levels in the group)
			const divisionsResult = await db
				.select({ count: count() })
				.from(scalingLevelsTable)
				.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))

			divisionCount = divisionsResult[0]?.count ?? 0
		}

		if (!scalingGroupId) {
			issues.push("No scaling group configured for divisions")
		} else if (divisionCount === 0) {
			issues.push("At least one division is required")
		}

		return {
			competitionId,
			competition,
			found,
			basicSetup,
			divisions: {
				isValid: divisionCount > 0,
				count: divisionCount,
				issues,
			},
		}
	},
})

// Step 4: Validate events
const validateEvents = createStep({
	id: "validate-events",
	inputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	outputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		events: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { competitionId, found } = inputData
		const issues: string[] = []
		const db = getDb()

		if (!found) {
			return {
				...inputData,
				events: {
					isValid: false,
					count: 0,
					issues: ["Cannot validate events - competition not found"],
				},
			}
		}

		// Find the programming track for this competition
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		let eventCount = 0
		if (track) {
			// Count events (track workouts) in the programming track
			const eventsResult = await db
				.select({ count: count() })
				.from(trackWorkoutsTable)
				.where(eq(trackWorkoutsTable.trackId, track.id))

			eventCount = eventsResult[0]?.count ?? 0
		}

		if (!track) {
			issues.push(
				"No programming track found - create events for the competition",
			)
		} else if (eventCount === 0) {
			issues.push("At least one event is required")
		} else if (eventCount < 3) {
			issues.push(
				`Only ${eventCount} event(s) configured - consider adding more for a full competition`,
			)
		}

		return {
			...inputData,
			events: {
				isValid: eventCount > 0,
				count: eventCount,
				issues,
			},
		}
	},
})

// Step 5: Validate waivers
const validateWaivers = createStep({
	id: "validate-waivers",
	inputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		events: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	outputSchema: z.object({
		competitionId: z.string(),
		competition: competitionDataSchema.shape.competition,
		found: z.boolean(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		events: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		waivers: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	execute: async ({ inputData }) => {
		const { competitionId, competition, found } = inputData
		const issues: string[] = []
		const db = getDb()

		if (!found) {
			return {
				...inputData,
				waivers: {
					isValid: false,
					count: 0,
					issues: ["Cannot validate waivers - competition not found"],
				},
			}
		}

		// Count waivers for this competition (all waivers are active by default)
		const waiversResult = await db
			.select({ count: count() })
			.from(waiversTable)
			.where(eq(waiversTable.competitionId, competitionId))

		const waiverCount = waiversResult[0]?.count ?? 0
		const requiresWaiver = competition?.requiresWaiver ?? false

		if (requiresWaiver && waiverCount === 0) {
			issues.push(
				"Competition requires waivers but none are configured - add at least one waiver",
			)
		} else if (!requiresWaiver && waiverCount === 0) {
			issues.push(
				"No waivers configured - consider adding a liability waiver for legal protection (recommended)",
			)
		}

		// Check if competition has requiresWaiver flag but no active waivers
		const isValid = !requiresWaiver || waiverCount > 0

		return {
			...inputData,
			waivers: {
				isValid,
				count: waiverCount,
				issues,
			},
		}
	},
})

// Validation result with approval context
const validationWithApprovalInputSchema = z.object({
	competitionId: z.string(),
	competition: competitionDataSchema.shape.competition,
	found: z.boolean(),
	basicSetup: z.object({
		isValid: z.boolean(),
		issues: z.array(z.string()),
	}),
	divisions: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
	events: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
	waivers: z.object({
		isValid: z.boolean(),
		count: z.number(),
		issues: z.array(z.string()),
	}),
})

// Step 6: Request human approval
// This step suspends the workflow and waits for human approval before publishing
const requestApproval = createStep({
	id: "request-approval",
	inputSchema: validationWithApprovalInputSchema,
	outputSchema: z.object({
		competitionId: z.string(),
		approved: z.boolean(),
		validationSummary: z.string(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		events: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		waivers: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	// Schema for data sent when suspending (to show the user)
	suspendSchema: z.object({
		competitionId: z.string(),
		competitionName: z.string(),
		isValid: z.boolean(),
		validationSummary: z.string(),
		criticalIssues: z.array(z.string()),
		warnings: z.array(z.string()),
		stats: z.object({
			divisions: z.number(),
			events: z.number(),
			waivers: z.number(),
		}),
	}),
	// Schema for data received when resuming (user's approval decision)
	resumeSchema: z.object({
		approved: z.boolean(),
		reason: z.string().optional(),
	}),
	execute: async ({ inputData, resumeData, suspend, bail }) => {
		const {
			competitionId,
			competition,
			basicSetup,
			divisions,
			events,
			waivers,
			found,
		} = inputData

		// Check if we have resume data (user already made a decision)
		if (resumeData?.approved !== undefined) {
			// User has responded
			if (!resumeData.approved) {
				// User rejected - bail without error
				bail(`Publishing cancelled: ${resumeData.reason || "User declined"}`)
			}

			// User approved - continue to next step
			return {
				competitionId,
				approved: true,
				validationSummary: generateValidationSummary(inputData),
				basicSetup,
				divisions,
				events,
				waivers,
			}
		}

		// No resume data yet - check validation and suspend for approval
		const isValid =
			found &&
			basicSetup.isValid &&
			divisions.isValid &&
			events.isValid &&
			waivers.isValid

		// Collect all issues
		const criticalIssues = [
			...basicSetup.issues.filter((i) => !i.includes("recommended")),
			...divisions.issues.filter((i) => !i.includes("recommended")),
			...events.issues.filter((i) => !i.includes("recommended")),
			...waivers.issues.filter((i) => !i.includes("recommended")),
		]
		const warnings = [
			...basicSetup.issues.filter((i) => i.includes("recommended")),
			...divisions.issues.filter((i) => i.includes("recommended")),
			...events.issues.filter((i) => i.includes("recommended")),
			...waivers.issues.filter((i) => i.includes("recommended")),
		]

		const validationSummary = isValid
			? `✅ "${competition?.name}" is ready to publish!`
			: `❌ "${competition?.name}" has ${criticalIssues.length} critical issue(s) to resolve.`

		// If not valid, bail with issues (can't publish with critical issues)
		if (!isValid) {
			bail(
				`Cannot publish: ${criticalIssues.length} critical issue(s): ${criticalIssues.join("; ")}`,
			)
		}

		// Valid - suspend and wait for human approval
		await suspend({
			competitionId,
			competitionName: competition?.name ?? "Unknown",
			isValid,
			validationSummary,
			criticalIssues,
			warnings,
			stats: {
				divisions: divisions.count,
				events: events.count,
				waivers: waivers.count,
			},
		})

		// This code runs after resume
		return {
			competitionId,
			approved: true,
			validationSummary,
			basicSetup,
			divisions,
			events,
			waivers,
		}
	},
})

// Helper function to generate validation summary
function generateValidationSummary(
	inputData: z.infer<typeof validationWithApprovalInputSchema>,
): string {
	const { competition, basicSetup, divisions, events, waivers, found } =
		inputData
	const isValid =
		found &&
		basicSetup.isValid &&
		divisions.isValid &&
		events.isValid &&
		waivers.isValid

	if (!found) {
		return "Competition not found."
	}
	if (isValid) {
		return `✅ "${competition?.name}" ready: ${divisions.count} division(s), ${events.count} event(s), ${waivers.count} waiver(s).`
	}
	const criticalIssues = [
		...basicSetup.issues.filter((i) => !i.includes("recommended")),
		...divisions.issues.filter((i) => !i.includes("recommended")),
		...events.issues.filter((i) => !i.includes("recommended")),
		...waivers.issues.filter((i) => !i.includes("recommended")),
	]
	return `❌ ${criticalIssues.length} issue(s): ${criticalIssues.join("; ")}`
}

// Step 7: Execute publish (only runs if approved)
const executePublish = createStep({
	id: "execute-publish",
	inputSchema: z.object({
		competitionId: z.string(),
		approved: z.boolean(),
		validationSummary: z.string(),
		basicSetup: z.object({
			isValid: z.boolean(),
			issues: z.array(z.string()),
		}),
		divisions: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		events: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
		waivers: z.object({
			isValid: z.boolean(),
			count: z.number(),
			issues: z.array(z.string()),
		}),
	}),
	outputSchema: validationResultSchema,
	execute: async ({ inputData }) => {
		const {
			competitionId,
			approved,
			validationSummary,
			basicSetup,
			divisions,
			events,
			waivers,
		} = inputData
		const db = getDb()

		if (!approved) {
			return {
				competitionId,
				isValid: false,
				basicSetup,
				divisions,
				events,
				waivers,
				summary: "Publishing was not approved.",
			}
		}

		// Actually publish the competition
		await db
			.update(competitionsTable)
			.set({
				status: "published",
				updatedAt: new Date(),
			})
			.where(eq(competitionsTable.id, competitionId))

		return {
			competitionId,
			isValid: true,
			basicSetup,
			divisions,
			events,
			waivers,
			summary: `🎉 Competition published successfully! ${validationSummary}`,
		}
	},
})

// Create the workflow with human-in-the-loop approval
export const publishCompetitionWorkflow = createWorkflow({
	id: "publish-competition",
	inputSchema: competitionIdSchema,
	outputSchema: validationResultSchema,
})
	.then(loadCompetition)
	.then(validateBasicSetup)
	.then(validateDivisions)
	.then(validateEvents)
	.then(validateWaivers)
	.then(requestApproval) // Suspends for human approval
	.then(executePublish) // Only executes after approval
	.commit()
