/**
 * @fileoverview Simplified tools with flattened arguments.
 *
 * Following MCP best practices:
 * - Flatten arguments (no nested objects or complex JSON)
 * - Server-side encoding/calculation
 * - Template-based content generation
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/db"
import { waiversTable } from "@/db/schemas/waivers"
import { competitionsTable } from "@/db/schemas/competitions"
import { competitionScoresTable, competitionRegistrationsTable } from "@/db/schemas/competitions"
import { trackWorkoutsTable } from "@/db/schemas/programming"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { createId } from "@paralleldrive/cuid2"
import {
	CommonErrors,
	createToolSuccess,
	createToolError,
	ErrorCode,
} from "../utils/tool-responses"
import type { ToolResponse } from "../utils/tool-responses"

/**
 * Simplified waiver creation using templates instead of Lexical JSON.
 */
export const createWaiverSimple = createTool({
	id: "create-waiver-simple",
	description: `
    Add a waiver to the competition using standard templates.

    Uses pre-built waiver templates with optional custom additions.
    No need to construct complex JSON - just specify the type and any custom text.

    Example:
      createWaiverSimple({
        competitionId: "comp_123",
        waiverType: "liability",
        customText: "Additional clause: No refunds after registration closes.",
        isRequired: true
      })

      Returns:
      {
        success: true,
        waiverId: "wvr_xyz",
        title: "Liability Waiver",
        message: "Waiver created successfully"
      }
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID"),
		waiverType: z
			.enum(["liability", "photo", "medical", "code_of_conduct"])
			.describe("Type of waiver"),
		customText: z
			.string()
			.max(1000)
			.default("")
			.describe("Optional custom text to append to the template"),
		isRequired: z
			.boolean()
			.default(true)
			.describe("Athletes must sign this to register"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Verify competition exists and get team
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Generate waiver content using template
			const waiverContent = generateWaiverContent(
				inputData.waiverType,
				inputData.customText,
			)
			const title = getWaiverTitle(inputData.waiverType)

			// Create waiver
			const waiverId = `wvr_${createId()}`
			await db.insert(waiversTable).values({
				id: waiverId,
				teamId: competition.competitionTeamId || teamId,
				competitionId: inputData.competitionId,
				title,
				content: JSON.stringify(waiverContent),
				isRequired: inputData.isRequired,
			})

			return createToolSuccess({
				data: {
					waiverId,
					title,
					waiverType: inputData.waiverType,
				},
				message: `${title} created successfully`,
				nextActions: ["validateCompetition", "publishCompetition"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create waiver"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to create waiver: ${message}`,
				suggestion: "Check if the competition exists and try again",
				nextActions: ["listCompetitions"],
			})
		}
	},
})

/**
 * Simplified result entry with server-side encoding.
 */
export const enterResultSimple = createTool({
	id: "enter-result-simple",
	description: `
    Enter a competition result with automatic score encoding.

    The server automatically encodes scores based on the workout scheme.
    Just provide the natural values (minutes, seconds, rounds, reps, pounds).

    Examples:
      // Time workout (5:30)
      enterResultSimple({
        registrationId: "reg_123",
        eventId: "evt_1",
        finishTimeMinutes: 5,
        finishTimeSeconds: 30
      })

      // AMRAP (4 rounds + 15 reps)
      enterResultSimple({
        registrationId: "reg_123",
        eventId: "evt_2",
        roundsCompleted: 4,
        repsCompleted: 15
      })

      // Max lift (225 lbs)
      enterResultSimple({
        registrationId: "reg_123",
        eventId: "evt_3",
        loadPounds: 225
      })

      Returns:
      {
        success: true,
        scoreId: "score_xyz",
        encodedScore: 330000,  // Server-calculated
        message: "Result entered: 5:30"
      }
  `,
	inputSchema: z.object({
		registrationId: z.string().describe("Athlete registration ID"),
		trackWorkoutId: z
			.string()
			.describe("Track workout ID (the event in the competition)"),
		// Time-based workouts
		finishTimeMinutes: z
			.number()
			.int()
			.min(0)
			.default(0)
			.describe("Minutes for time-based workouts"),
		finishTimeSeconds: z
			.number()
			.int()
			.min(0)
			.max(59)
			.default(0)
			.describe("Seconds for time-based workouts"),
		// AMRAP workouts
		roundsCompleted: z
			.number()
			.int()
			.min(0)
			.default(0)
			.describe("Rounds for AMRAP workouts"),
		repsCompleted: z
			.number()
			.int()
			.min(0)
			.default(0)
			.describe("Reps for AMRAP or rep-based workouts"),
		// Load workouts
		loadPounds: z
			.number()
			.min(0)
			.default(0)
			.describe("Weight in pounds for load-based workouts"),
		// Status
		status: z
			.enum(["scored", "capped", "dq", "withdrawn"])
			.default("scored")
			.describe("Result status"),
		// Tiebreak (optional)
		tiebreakMinutes: z.number().int().min(0).optional().describe("Tiebreak time minutes"),
		tiebreakSeconds: z
			.number()
			.int()
			.min(0)
			.max(59)
			.optional()
			.describe("Tiebreak time seconds"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Get track workout to determine competition and scheme
			const trackWorkout = await db
				.select({
					trackWorkout: trackWorkoutsTable,
					workout: workoutsTable,
				})
				.from(trackWorkoutsTable)
				.innerJoin(
					workoutsTable,
					eq(trackWorkoutsTable.workoutId, workoutsTable.id),
				)
				.where(eq(trackWorkoutsTable.id, inputData.trackWorkoutId))
				.limit(1)

			if (!trackWorkout[0]) {
				return createToolError({
					error: ErrorCode.RESOURCE_NOT_FOUND,
					message: `Track workout '${inputData.trackWorkoutId}' not found`,
					suggestion: "Check the event ID and try again. Use listEvents to see available events.",
					nextActions: ["listEvents"],
				})
			}

			const { workout } = trackWorkout[0]
			const scheme = workout.scheme || "time"

			// Encode score based on scheme
			let encodedScore: number
			let displayValue: string

			if (scheme === "time" || scheme === "time-with-cap") {
				const totalSeconds =
					inputData.finishTimeMinutes * 60 + inputData.finishTimeSeconds
				encodedScore = totalSeconds * 1000 // Convert to milliseconds
				displayValue = `${inputData.finishTimeMinutes}:${String(inputData.finishTimeSeconds).padStart(2, "0")}`
			} else if (scheme === "rounds-reps") {
				encodedScore =
					inputData.roundsCompleted * 100000 + inputData.repsCompleted
				displayValue = `${inputData.roundsCompleted} rounds + ${inputData.repsCompleted} reps`
			} else if (scheme === "reps") {
				encodedScore = inputData.repsCompleted
				displayValue = `${inputData.repsCompleted} reps`
			} else if (scheme === "load") {
				encodedScore = Math.round(inputData.loadPounds * 453.592) // Convert to grams
				displayValue = `${inputData.loadPounds} lbs`
			} else {
				// Default to reps
				encodedScore = inputData.repsCompleted
				displayValue = `${inputData.repsCompleted}`
			}

			// Encode tiebreak if provided
			let encodedTiebreak: number | null = null
			if (
				inputData.tiebreakMinutes !== undefined ||
				inputData.tiebreakSeconds !== undefined
			) {
				const tiebreakSeconds =
					(inputData.tiebreakMinutes || 0) * 60 + (inputData.tiebreakSeconds || 0)
				encodedTiebreak = tiebreakSeconds * 1000
			}

			// Verify registration exists
			const registration = await db.query.competitionRegistrationsTable.findFirst({
				where: eq(competitionRegistrationsTable.id, inputData.registrationId),
			})

			if (!registration) {
				return createToolError({
					error: ErrorCode.RESOURCE_NOT_FOUND,
					message: `Registration '${inputData.registrationId}' not found`,
					suggestion: "Check the registration ID. Use listRegistrations to see available registrations.",
					nextActions: ["listRegistrations"],
				})
			}

			// Insert or update score
			const scoreId = `scr_${createId()}`
			await db.insert(competitionScoresTable).values({
				id: scoreId,
				trackWorkoutId: inputData.trackWorkoutId,
				competitionRegistrationId: inputData.registrationId,
				score: encodedScore,
				tiebreak: encodedTiebreak,
				status: inputData.status,
			})

			return createToolSuccess({
				data: {
					scoreId,
					encodedScore,
					displayValue,
					status: inputData.status,
				},
				message: `Result entered: ${displayValue} (${inputData.status})`,
				nextActions: ["getEventResults", "calculateLeaderboard"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to enter result"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to enter result: ${message}`,
				suggestion: "Check registration and event IDs, then try again",
				nextActions: ["listRegistrations", "listEvents"],
			})
		}
	},
})

/**
 * Helper functions
 */

function getWaiverTitle(type: "liability" | "photo" | "medical" | "code_of_conduct"): string {
	const titles = {
		liability: "Liability Waiver",
		photo: "Photo Release",
		medical: "Medical Release",
		code_of_conduct: "Code of Conduct",
	}
	return titles[type]
}

function generateWaiverContent(
	type: "liability" | "photo" | "medical" | "code_of_conduct",
	customText: string,
) {
	const templates = {
		liability: {
			heading: "ASSUMPTION OF RISK AND WAIVER OF LIABILITY",
			body: "I understand that participation in this competition involves risks including, but not limited to, physical injury, death, or property damage. I voluntarily assume all risks associated with my participation. I hereby release, waive, and discharge the organizers, staff, volunteers, and sponsors from any and all liability for injuries or damages arising from my participation.",
		},
		photo: {
			heading: "PHOTO AND VIDEO RELEASE",
			body: "I grant permission to the competition organizers to use photographs, videos, and other media containing my image taken during this event for promotional purposes without compensation.",
		},
		medical: {
			heading: "MEDICAL RELEASE",
			body: "I certify that I am physically fit and have not been advised against participation by a qualified medical professional. In case of medical emergency, I authorize event staff to obtain necessary medical treatment on my behalf.",
		},
		code_of_conduct: {
			heading: "CODE OF CONDUCT",
			body: "I agree to conduct myself in a sportsmanlike manner, respect all athletes, judges, volunteers, and spectators, and follow all competition rules and safety guidelines. Violations may result in disqualification.",
		},
	}

	const template = templates[type]

	// Build Lexical JSON structure
	const paragraphs = [
		{
			children: [
				{
					detail: 0,
					format: 1,
					mode: "normal",
					style: "",
					text: template.heading,
					type: "text",
					version: 1,
				},
			],
			direction: "ltr",
			format: "",
			indent: 0,
			type: "heading",
			version: 1,
			tag: "h2",
		},
		{
			children: [
				{
					detail: 0,
					format: 0,
					mode: "normal",
					style: "",
					text: template.body,
					type: "text",
					version: 1,
				},
			],
			direction: "ltr",
			format: "",
			indent: 0,
			type: "paragraph",
			version: 1,
		},
	]

	// Add custom text if provided
	if (customText.trim()) {
		paragraphs.push({
			children: [
				{
					detail: 0,
					format: 0,
					mode: "normal",
					style: "",
					text: customText.trim(),
					type: "text",
					version: 1,
				},
			],
			direction: "ltr",
			format: "",
			indent: 0,
			type: "paragraph",
			version: 1,
		})
	}

	return {
		root: {
			children: paragraphs,
			direction: "ltr",
			format: "",
			indent: 0,
			type: "root",
			version: 1,
		},
	}
}
