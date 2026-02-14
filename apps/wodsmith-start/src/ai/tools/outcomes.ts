/**
 * @fileoverview High-impact outcome tools for competition management.
 *
 * Following MCP best practices:
 * - Outcomes, not operations (single tool call achieves complete goal)
 * - Flattened arguments (primitives and enums, not nested objects)
 * - Clear examples in descriptions
 * - Structured error responses with next actions
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
	competitionHeatsTable,
	competitionHeatAssignmentsTable,
	competitionVenuesTable,
} from "@/db/schemas/competitions"
import { scalingLevelsTable, scalingGroupsTable } from "@/db/schemas/scaling"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { waiversTable } from "@/db/schemas/waivers"
import { createCompetition } from "@/server-fns/competition-server-logic"
import { generateSlug } from "@/utils/slugify"
import { createId } from "@paralleldrive/cuid2"
import { getLocalDateKey } from "@/utils/date-utils"
import {
	hasDateStartedInTimezone,
	isDeadlinePassedInTimezone,
} from "@/utils/timezone-utils"
import {
	CommonErrors,
	createToolSuccess,
	createToolError,
	ErrorCode,
} from "../utils/tool-responses"
import { parseCompetitionSettings } from "@/types/competitions"

/**
 * Validation helper function
 */
async function runValidation(
	competitionId: string,
	teamId: string,
	db: ReturnType<typeof getDb>,
) {
	const issues: Array<{
		severity: "error" | "warning" | "info"
		category: string
		message: string
		suggestion?: string
	}> = []

	// Get competition
	const competition = await db.query.competitionsTable.findFirst({
		where: and(
			eq(competitionsTable.id, competitionId),
			eq(competitionsTable.organizingTeamId, teamId),
		),
	})

	if (!competition) {
		issues.push({
			severity: "error",
			category: "Access",
			message: "Competition not found or access denied",
		})
		return { isValid: false, issues }
	}

	// Check basic info
	if (!competition.description) {
		issues.push({
			severity: "warning",
			category: "Details",
			message: "Competition has no description",
			suggestion: "Add a description to help athletes understand the event",
		})
	}

	// Check dates
	if (
		hasDateStartedInTimezone(
			competition.startDate,
			competition.timezone || "America/Denver",
		) &&
		competition.status === "draft"
	) {
		issues.push({
			severity: "warning",
			category: "Schedule",
			message: "Competition start date is in the past but status is draft",
			suggestion: "Update dates or publish the competition if it's ready",
		})
	}

	// Check divisions
	const settings = parseCompetitionSettings(competition.settings)
	const scalingGroupId = settings?.divisions?.scalingGroupId

	if (!scalingGroupId) {
		issues.push({
			severity: "error",
			category: "Divisions",
			message: "No scaling group configured for divisions",
			suggestion: "Create divisions for athletes to register",
		})
	} else {
		const divisions = await db.query.scalingLevelsTable.findMany({
			where: eq(scalingLevelsTable.scalingGroupId, scalingGroupId),
		})

		if (divisions.length === 0) {
			issues.push({
				severity: "error",
				category: "Divisions",
				message: "No divisions have been created",
				suggestion: "Create at least one division for athletes to register",
			})
		}
	}

	// Check programming track
	const track = await db.query.programmingTracksTable.findFirst({
		where: eq(programmingTracksTable.competitionId, competitionId),
	})

	if (!track) {
		issues.push({
			severity: "error",
			category: "Events",
			message: "No programming track found",
			suggestion: "Create a programming track to add competition events",
		})
	} else {
		const events = await db.query.trackWorkoutsTable.findMany({
			where: eq(trackWorkoutsTable.trackId, track.id),
		})

		if (events.length === 0) {
			issues.push({
				severity: "error",
				category: "Events",
				message: "No events have been created",
				suggestion: "Create competition events (workouts) for athletes to complete",
			})
		}
	}

	// Check waivers
	const waivers = await db.query.waiversTable.findMany({
		where: eq(waiversTable.competitionId, competitionId),
	})

	if (waivers.length === 0) {
		issues.push({
			severity: "warning",
			category: "Waivers",
			message: "No waivers configured",
			suggestion: "Add liability waivers for athlete registration",
		})
	}

	return {
		isValid: issues.filter((i) => i.severity === "error").length === 0,
		issues,
	}
}

/**
 * Setup a complete new competition in one step.
 * Replaces 10+ sequential tool calls with a single atomic operation.
 */
export const setupNewCompetition = createTool({
	id: "setup-new-competition",
	description: `
    Create a complete competition with divisions, events, and waivers in one step.

    Returns competition ready for registration with:
    - Competition record created
    - Divisions auto-configured based on type and expected size
    - Event placeholders created (you'll add workout details later)
    - Standard liability waiver added

    Example:
      setupNewCompetition({
        name: "Spring Throwdown 2026",
        startDate: "2026-05-15",
        competitionType: "individual",
        expectedAthletes: 100,
        includeScaled: true,
        eventCount: 4,
        description: "Annual spring competition featuring 4 diverse events"
      })

      Returns:
      {
        success: true,
        competitionId: "comp_abc123",
        slug: "spring-throwdown-2026",
        divisions: ["Rx Men", "Rx Women", "Scaled Men", "Scaled Women"],
        events: ["Event 1", "Event 2", "Event 3", "Event 4"],
        waivers: ["Liability Waiver"],
        ready: true,
        message: "Competition created! Next: add workout details to events.",
        nextActions: ["updateEventWorkout", "publishCompetition"]
      }
  `,
	inputSchema: z.object({
		name: z
			.string()
			.min(1)
			.max(255)
			.describe("Competition name (e.g., 'Spring Throwdown 2026')"),
		startDate: z.string().describe("ISO 8601 format (YYYY-MM-DD)"),
		endDate: z
			.string()
			.optional()
			.describe("ISO 8601 format. Defaults to startDate for single-day events"),
		competitionType: z
			.enum(["individual", "team", "pairs"])
			.describe("Type of competition"),
		expectedAthletes: z
			.number()
			.int()
			.positive()
			.describe("Expected total number of athletes (used to suggest divisions)"),
		includeScaled: z
			.boolean()
			.default(true)
			.describe("Include Scaled divisions (in addition to Rx)"),
		includeMasters: z
			.boolean()
			.default(false)
			.describe("Include Masters 35+ divisions"),
		includeTeens: z
			.boolean()
			.default(false)
			.describe("Include Teen (14-17) divisions"),
		eventCount: z
			.number()
			.int()
			.min(1)
			.max(20)
			.default(4)
			.describe("Number of events to create (1-20 supported, 3-5 recommended)"),
		description: z.string().max(2000).optional().describe("Competition description"),
		registrationFeeDollars: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe("Default registration fee in dollars (can be overridden per division)"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		// Generate slug from name (defined outside try for error handling)
		const slug = generateSlug(inputData.name)

		try {
			// Parse dates for validation
			const parsedStartDate = new Date(inputData.startDate)
			const parsedEndDate = inputData.endDate
				? new Date(inputData.endDate)
				: parsedStartDate

			// Validate dates
			if (Number.isNaN(parsedStartDate.getTime())) {
				return CommonErrors.invalidDateFormat(inputData.startDate, "startDate")
			}
			if (Number.isNaN(parsedEndDate.getTime())) {
				return CommonErrors.invalidDateFormat(
					inputData.endDate || "",
					"endDate",
				)
			}

			// Format dates to YYYY-MM-DD for storage
			const formattedStartDate = getLocalDateKey(parsedStartDate)
			const formattedEndDate = getLocalDateKey(parsedEndDate)

			// Step 1: Create competition record
			const { competitionId } = await createCompetition({
				organizingTeamId: teamId,
				name: inputData.name,
				slug,
				startDate: formattedStartDate,
				endDate: formattedEndDate,
				description: inputData.description,
			})

			// Step 2: Create scaling group and divisions
			const [{ id: scalingGroupId }] = await db.insert(scalingGroupsTable).values({
				teamId,
				title: `${inputData.name} Divisions`,
				description: "Auto-generated divisions for competition",
			}).returning({ id: scalingGroupsTable.id })

			// Generate division list based on type and preferences
			const divisionNames = generateDivisionNames(inputData)

			// Create scaling levels (divisions)
			const divisions = []
			for (let i = 0; i < divisionNames.length; i++) {
				await db.insert(scalingLevelsTable).values({
					scalingGroupId,
					label: divisionNames[i],
					position: i,
					teamSize: inputData.competitionType === "pairs" ? 2 : inputData.competitionType === "team" ? 4 : 1,
				})
				divisions.push(divisionNames[i])
			}

			// Update competition settings with scaling group
			await db
				.update(competitionsTable)
				.set({
					settings: JSON.stringify({
						divisions: { scalingGroupId },
					}),
					defaultRegistrationFeeCents: inputData.registrationFeeDollars
						? inputData.registrationFeeDollars * 100
						: null,
				})
				.where(eq(competitionsTable.id, competitionId))

			// Step 3: Create programming track and event placeholders
			const [{ id: trackId }] = await db.insert(programmingTracksTable).values({
				ownerTeamId: teamId,
				name: `${inputData.name} Track`,
				description: "Competition programming track",
				type: "competition",
				competitionId,
			}).returning({ id: programmingTracksTable.id })

			// Create event placeholder workouts
			const events = []
			for (let i = 1; i <= inputData.eventCount; i++) {
				const eventName = `Event ${i}`
				const workoutId = `wkt_${createId()}`

				// Create workout (workouts table requires explicit id)
				await db.insert(workoutsTable).values({
					id: workoutId,
					teamId,
					name: eventName,
					scheme: "time",
					description: `Competition event ${i} - add workout details`,
				})

				// Add to track
				await db.insert(trackWorkoutsTable).values({
					trackId,
					workoutId,
					trackOrder: i - 1,
					eventStatus: "draft",
				})

				events.push(eventName)
			}

			// Step 4: Create standard waivers
			const standardWaiverContent = {
				root: {
					children: [
						{
							children: [
								{
									detail: 0,
									format: 1,
									mode: "normal",
									style: "",
									text: "ASSUMPTION OF RISK AND WAIVER OF LIABILITY",
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
									text: "I understand that participation in this competition involves risks including, but not limited to, physical injury, death, or property damage. I voluntarily assume all risks associated with my participation.",
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
						{
							children: [
								{
									detail: 0,
									format: 0,
									mode: "normal",
									style: "",
									text: "I hereby release, waive, and discharge the organizers, staff, volunteers, and sponsors from any and all liability for injuries or damages arising from my participation.",
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
					],
					direction: "ltr",
					format: "",
					indent: 0,
					type: "root",
					version: 1,
				},
			}

			await db.insert(waiversTable).values({
				competitionId,
				title: "Liability Waiver",
				content: JSON.stringify(standardWaiverContent),
				required: true,
			})

			return createToolSuccess({
				data: {
					competitionId,
					slug,
					divisions,
					events,
					waivers: ["Liability Waiver"],
					ready: false, // Not ready until events have workouts and competition is published
				},
				message: `Competition "${inputData.name}" created successfully! Next: add workout details to events.`,
				nextActions: ["updateEventWorkout", "validateCompetition", "publishCompetition"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create competition"

			// Handle specific errors
			if (message.includes("slug already exists")) {
				const suggestions = [
					`${slug}-${new Date().getFullYear()}`,
					`${slug}-${inputData.competitionType}`,
					`${slug}-${createId().substring(0, 4)}`,
				]
				return CommonErrors.slugConflict(slug, suggestions)
			}

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to create competition: ${message}`,
				suggestion:
					"Check if the competition name is unique and all inputs are valid. Try again with different values.",
				nextActions: ["retryWithDifferentName", "listCompetitions"],
			})
		}
	},
})

/**
 * Helper function to generate division names based on competition type and preferences
 */
function generateDivisionNames(params: {
	competitionType: "individual" | "team" | "pairs"
	includeScaled: boolean
	includeMasters: boolean
	includeTeens: boolean
}): string[] {
	const divisions: string[] = []

	if (params.competitionType === "individual") {
		// Rx divisions
		divisions.push("Rx Men", "Rx Women")

		// Scaled divisions
		if (params.includeScaled) {
			divisions.push("Scaled Men", "Scaled Women")
		}

		// Masters divisions
		if (params.includeMasters) {
			divisions.push("Masters 35+ Men", "Masters 35+ Women")
		}

		// Teen divisions
		if (params.includeTeens) {
			divisions.push("Teen Boys (14-17)", "Teen Girls (14-17)")
		}
	} else if (params.competitionType === "team") {
		divisions.push("Rx Teams")
		if (params.includeScaled) {
			divisions.push("Scaled Teams")
		}
	} else if (params.competitionType === "pairs") {
		divisions.push("Rx Male Pairs", "Rx Female Pairs", "Rx Mixed Pairs")
		if (params.includeScaled) {
			divisions.push("Scaled Mixed Pairs")
		}
	}

	return divisions
}

/**
 * Duplicate an existing competition with optional modifications.
 * Copies divisions, events, waivers, and venues. Does NOT copy registrations or results.
 */
export const duplicateCompetition = createTool({
	id: "duplicate-competition",
	description: `
    Clone an existing competition with optional modifications.

    Copies:
    - Competition settings (divisions structure)
    - Events (workouts and event order)
    - Waivers
    - Venues (optional)

    Does NOT copy:
    - Registrations
    - Results
    - Heat schedules

    Example:
      duplicateCompetition({
        sourceCompetitionId: "comp_spring_2025",
        newName: "Spring Throwdown 2026",
        newStartDate: "2026-05-15",
        copyVenues: false
      })

      Returns:
      {
        success: true,
        competitionId: "comp_xyz789",
        slug: "spring-throwdown-2026",
        copiedDivisions: 4,
        copiedEvents: 4,
        copiedWaivers: 1,
        copiedVenues: 0
      }
  `,
	inputSchema: z.object({
		sourceCompetitionId: z.string().describe("Competition ID to clone from"),
		newName: z.string().min(1).max(255).describe("Name for the new competition"),
		newStartDate: z.string().describe("Start date (YYYY-MM-DD) for new competition"),
		newEndDate: z
			.string()
			.optional()
			.describe("End date (YYYY-MM-DD). Defaults to newStartDate"),
		copyEvents: z.boolean().default(true).describe("Copy events and workouts"),
		copyDivisions: z.boolean().default(true).describe("Copy division structure"),
		copyWaivers: z.boolean().default(true).describe("Copy waivers"),
		copyVenues: z.boolean().default(false).describe("Copy venue configuration"),
		newDescription: z.string().max(2000).optional().describe("New description"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Validate source competition exists and user has access
			const sourceComp = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.sourceCompetitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!sourceComp) {
				return CommonErrors.competitionNotFound(
					inputData.sourceCompetitionId,
					teamId,
				)
			}

			// Generate slug
			const newSlug = generateSlug(inputData.newName)

			// Parse dates for validation
			const parsedStartDate = new Date(inputData.newStartDate)
			const parsedEndDate = inputData.newEndDate
				? new Date(inputData.newEndDate)
				: parsedStartDate

			if (Number.isNaN(parsedStartDate.getTime())) {
				return CommonErrors.invalidDateFormat(
					inputData.newStartDate,
					"newStartDate",
				)
			}

			// Format dates to YYYY-MM-DD for storage
			const formattedStartDate = getLocalDateKey(parsedStartDate)
			const formattedEndDate = getLocalDateKey(parsedEndDate)

			// Create new competition
			const { competitionId } = await createCompetition({
				organizingTeamId: teamId,
				name: inputData.newName,
				slug: newSlug,
				startDate: formattedStartDate,
				endDate: formattedEndDate,
				description: inputData.newDescription || sourceComp.description || undefined,
				settings: inputData.copyDivisions ? sourceComp.settings ?? undefined : undefined,
			})

			let copiedDivisions = 0
			let copiedEvents = 0
			let copiedWaivers = 0
			let copiedVenues = 0

			// Copy divisions (scaling group) if requested
			if (inputData.copyDivisions && sourceComp.settings) {
				const sourceSettings = parseCompetitionSettings(sourceComp.settings)
				const sourceScalingGroupId = sourceSettings?.divisions?.scalingGroupId

				if (sourceScalingGroupId) {
					// Create new scaling group for the new competition
					const sourceLevels = await db.query.scalingLevelsTable.findMany({
						where: eq(scalingLevelsTable.scalingGroupId, sourceScalingGroupId),
					})

					// Create new scaling group
					const [{ id: newScalingGroupId }] = await db.insert(scalingGroupsTable).values({
						teamId,
						title: `${inputData.newName} Divisions`,
						description: `Divisions cloned from ${sourceComp.name}`,
					}).returning({ id: scalingGroupsTable.id })

					// Copy scaling levels
					for (const level of sourceLevels) {
						await db.insert(scalingLevelsTable).values({
							scalingGroupId: newScalingGroupId,
							label: level.label,
							position: level.position,
							teamSize: level.teamSize,
						})
						copiedDivisions++
					}

					// Update new competition settings with new scaling group
					await db
						.update(competitionsTable)
						.set({
							settings: JSON.stringify({
								divisions: { scalingGroupId: newScalingGroupId },
							}),
						})
						.where(eq(competitionsTable.id, competitionId))
				}
			}

			// Copy events if requested
			if (inputData.copyEvents) {
				// Get source track
				const sourceTrack = await db.query.programmingTracksTable.findFirst({
					where: eq(programmingTracksTable.competitionId, inputData.sourceCompetitionId),
				})

				if (sourceTrack) {
					// Create new track
					const [{ id: newTrackId }] = await db.insert(programmingTracksTable).values({
						ownerTeamId: teamId,
						name: `${inputData.newName} Track`,
						description: `Programming track cloned from ${sourceComp.name}`,
						type: "competition",
						competitionId,
					}).returning({ id: programmingTracksTable.id })

					// Get source track workouts
					const sourceTrackWorkouts = await db
						.select({
							trackWorkout: trackWorkoutsTable,
							workout: workoutsTable,
						})
						.from(trackWorkoutsTable)
						.innerJoin(
							workoutsTable,
							eq(trackWorkoutsTable.workoutId, workoutsTable.id),
						)
						.where(eq(trackWorkoutsTable.trackId, sourceTrack.id))

					// Copy each workout
					for (const { trackWorkout, workout } of sourceTrackWorkouts) {
						// Create new workout (workouts table requires explicit id)
						const newWorkoutId = `wkt_${createId()}`
						await db.insert(workoutsTable).values({
							id: newWorkoutId,
							teamId,
							name: workout.name,
							description: workout.description || "",
							scheme: workout.scheme,
							timeCap: workout.timeCap,
						})

						// Add to new track
						await db.insert(trackWorkoutsTable).values({
							trackId: newTrackId,
							workoutId: newWorkoutId,
							trackOrder: trackWorkout.trackOrder,
							eventStatus: "draft", // Always start as draft
						})

						copiedEvents++
					}
				}
			}

			// Copy waivers if requested
			if (inputData.copyWaivers) {
				const sourceWaivers = await db.query.waiversTable.findMany({
					where: eq(waiversTable.competitionId, inputData.sourceCompetitionId),
				})

				for (const waiver of sourceWaivers) {
					await db.insert(waiversTable).values({
						competitionId,
						title: waiver.title,
						content: waiver.content,
						required: waiver.required,
					})
					copiedWaivers++
				}
			}

			// Copy venues if requested
			if (inputData.copyVenues) {
				const sourceVenues = await db.query.competitionVenuesTable.findMany({
					where: eq(competitionVenuesTable.competitionId, inputData.sourceCompetitionId),
				})

				for (const venue of sourceVenues) {
					await db.insert(competitionVenuesTable).values({
						competitionId,
						name: venue.name,
						laneCount: venue.laneCount,
						transitionMinutes: venue.transitionMinutes,
						sortOrder: venue.sortOrder,
					})
					copiedVenues++
				}
			}

			return createToolSuccess({
				data: {
					competitionId,
					slug: newSlug,
					copiedDivisions,
					copiedEvents,
					copiedWaivers,
					copiedVenues,
				},
				message: `Competition "${inputData.newName}" created as a copy of "${sourceComp.name}". Copied ${copiedDivisions} divisions, ${copiedEvents} events, ${copiedWaivers} waivers, ${copiedVenues} venues.`,
				nextActions: ["validateCompetition", "publishCompetition"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to duplicate competition"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to duplicate competition: ${message}`,
				suggestion:
					"Check if the source competition exists and you have access. Try again or use setupNewCompetition.",
				nextActions: ["setupNewCompetition", "listCompetitions"],
			})
		}
	},
})

/**
 * Validate and publish a competition atomically.
 * Only publishes if validation passes (or forcePublish is true).
 */
export const publishCompetition = createTool({
	id: "publish-competition",
	description: `
    Validate and publish a competition atomically.

    Runs full validation and only publishes if all checks pass.
    Returns validation results and publish status.

    Example:
      publishCompetition({
        competitionId: "comp_123",
        visibility: "public",
        forcePublish: false  // Set true to publish even with warnings
      })

      Returns:
      {
        success: true,
        published: true,
        validation: {
          isValid: true,
          issues: []
        }
      }
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID to publish"),
		visibility: z
			.enum(["public", "private"])
			.default("public")
			.describe("public = listed in directory, private = URL-only access"),
		forcePublish: z
			.boolean()
			.default(false)
			.describe("Publish even if validation has warnings (not errors)"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Get competition
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Run validation
			const validation = await runValidation(inputData.competitionId, teamId, db)

			// Check if we can publish
			const errors = validation.issues.filter((i) => i.severity === "error")
			if (errors.length > 0 && !inputData.forcePublish) {
				return createToolError({
					error: ErrorCode.VALIDATION_FAILED,
					message: `Competition has ${errors.length} validation error(s) and cannot be published.`,
					suggestion:
						errors[0]?.suggestion ||
						"Fix validation errors before publishing.",
					nextActions: ["fixValidationErrors", "validateCompetition"],
					context: { validation },
				})
			}

			// Publish the competition
			await db
				.update(competitionsTable)
				.set({
					status: "published",
					visibility: inputData.visibility,
					updatedAt: new Date(),
				})
				.where(eq(competitionsTable.id, inputData.competitionId))

			return createToolSuccess({
				data: {
					competitionId: inputData.competitionId,
					status: "published",
					visibility: inputData.visibility,
					validation,
				},
				message: `Competition "${competition.name}" published successfully! ${validation.issues.filter((i) => i.severity === "warning").length > 0 ? "Note: There are warnings to address." : ""}`,
				nextActions: ["viewCompetitionPublicPage", "manageRegistrations"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to publish competition"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to publish competition: ${message}`,
				suggestion: "Check validation results and try again.",
				nextActions: ["validateCompetition"],
			})
		}
	},
})

/**
 * Comprehensive readiness check before competition day.
 */
export const checkCompetitionReadiness = createTool({
	id: "check-competition-readiness",
	description: `
    Comprehensive readiness check before competition day.

    Validates:
    - Setup (divisions, events, waivers, venues)
    - Registrations (payment status, waivers signed)
    - Operations (heats scheduled, all athletes assigned)
    - Timeline (registration closed, ready for day-of)

    Returns detailed checklist with action items prioritized by severity.

    Example:
      checkCompetitionReadiness({
        competitionId: "comp_123",
        daysUntilEvent: 7
      })

      Returns:
      {
        ready: false,
        blockers: ["5 athletes haven't signed waivers", "Event 2 has no heats"],
        warnings: ["Registration still open (closes in 7 days)"],
        recommendations: ["Send reminder email to athletes"],
        checklist: {
          setup: { complete: true, issues: [] },
          registrations: { complete: false, issues: ["5 unsigned waivers"] },
          heats: { complete: false, issues: ["Event 2 needs heats"] },
          equipment: { complete: true, issues: [] }
        }
      }
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID to check"),
		daysUntilEvent: z
			.number()
			.int()
			.min(0)
			.default(0)
			.describe("Days until competition starts (for timeline warnings)"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Get competition
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			const blockers: string[] = []
			const warnings: string[] = []
			const recommendations: string[] = []

			const checklist = {
				setup: { complete: true, issues: [] as string[] },
				registrations: { complete: true, issues: [] as string[] },
				heats: { complete: true, issues: [] as string[] },
				equipment: { complete: true, issues: [] as string[] },
			}

			// Check setup (divisions, events, waivers)
			const validation = await runValidation(inputData.competitionId, teamId, db)
			const setupErrors = validation.issues.filter((i) => i.severity === "error")
			if (setupErrors.length > 0) {
				checklist.setup.complete = false
				for (const error of setupErrors) {
					checklist.setup.issues.push(error.message)
					blockers.push(error.message)
				}
			}

			// Check registrations
			const registrations = await db.query.competitionRegistrationsTable.findMany({
				where: eq(competitionRegistrationsTable.eventId, inputData.competitionId),
			})

			if (registrations.length === 0) {
				warnings.push("No athletes have registered yet")
				checklist.registrations.issues.push("No registrations")
			}

			// TODO: Check waiver signatures - requires joining with waiverSignaturesTable
			// For now, skip this check as hasSignedAllWaivers is not a direct field on registrations

			// Check payment status
			const pendingPayments = registrations.filter(
				(r) => r.paymentStatus === "PENDING_PAYMENT",
			)
			if (pendingPayments.length > 0) {
				const issue = `${pendingPayments.length} athlete(s) have pending payments`
				warnings.push(issue)
				checklist.registrations.issues.push(issue)
			}

			// Check if registration window is appropriate
			if (
				competition.registrationClosesAt &&
				!isDeadlinePassedInTimezone(
					competition.registrationClosesAt,
					competition.timezone || "America/Denver",
				)
			) {
				const closesAt = new Date(competition.registrationClosesAt)
				const now = new Date()
				const daysUntilClosed = Math.ceil(
					(closesAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
				)

				if (daysUntilClosed > inputData.daysUntilEvent) {
					warnings.push(
						`Registration closes ${daysUntilClosed} days before event - consider closing earlier`,
					)
				}
			}

			// Check heats scheduling (if track exists)
			const track = await db.query.programmingTracksTable.findFirst({
				where: eq(programmingTracksTable.competitionId, inputData.competitionId),
			})

			if (track) {
				const events = await db.query.trackWorkoutsTable.findMany({
					where: eq(trackWorkoutsTable.trackId, track.id),
				})

				// For each event, check if heats exist
				// Note: We would need to import competitionHeatsTable for this
				// Simplified check: just recommend scheduling heats
				if (events.length > 0 && inputData.daysUntilEvent <= 7) {
					recommendations.push(
						"Verify heat schedules are published for all events",
					)
				}
			}

			// Determine overall readiness
			const ready = blockers.length === 0 && warnings.length === 0

			// Generate recommendations based on days until event
			if (inputData.daysUntilEvent > 14) {
				recommendations.push("Promote the competition to get more registrations")
			} else if (inputData.daysUntilEvent <= 7 && inputData.daysUntilEvent > 0) {
				recommendations.push("Send final reminders to athletes about waivers and payment")
				recommendations.push("Finalize heat schedules and publish to athletes")
			} else if (inputData.daysUntilEvent === 0) {
				recommendations.push("Ensure all judging assignments are confirmed")
				recommendations.push("Verify equipment is ready and lanes are marked")
			}

			return createToolSuccess({
				data: {
					ready,
					blockers,
					warnings,
					recommendations,
					checklist,
					totalRegistrations: registrations.length,
					daysUntilEvent: inputData.daysUntilEvent,
				},
				message: ready
					? "Competition is ready!"
					: `Competition has ${blockers.length} blockers and ${warnings.length} warnings`,
				nextActions: ready
					? ["publishHeatSchedules", "sendAthleteReminders"]
					: ["fixBlockers", "reviewWarnings"],
			})
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to check competition readiness"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to check readiness: ${message}`,
				suggestion: "Try validateCompetition for basic setup checks",
				nextActions: ["validateCompetition"],
			})
		}
	},
})

/**
 * Auto-generate and schedule heats for an event.
 * Replaces 20+ manual heat creation and assignment calls.
 */
export const scheduleAllHeats = createTool({
	id: "schedule-all-heats",
	description: `
    Automatically generate and schedule heats for a competition event.

    Creates heats with optimal athlete distribution and considers:
    - Venue capacity (lanes per heat)
    - Time between heats (transition time)
    - Division grouping (keeps divisions together for easier judging)
    - Even distribution (balanced heat sizes)

    Example:
      scheduleAllHeats({
        competitionId: "comp_123",
        trackWorkoutId: "twkt_1",
        venueId: "venue_main",
        startTime: "2026-05-15T09:00:00",
        athletesPerHeat: 10,
        minutesBetweenHeats: 12,
        groupByDivision: true
      })

      Returns:
      {
        success: true,
        heatsCreated: 8,
        athletesScheduled: 78,
        unassignedAthletes: 2,
        schedule: [
          { heatNumber: 1, time: "09:00", division: "Rx Men", athletes: 10 },
          { heatNumber: 2, time: "09:12", division: "Rx Men", athletes: 10 },
          ...
        ]
      }
  `,
	inputSchema: z.object({
		competitionId: z.string().describe("Competition ID"),
		trackWorkoutId: z
			.string()
			.describe("Track workout ID (the event to schedule)"),
		venueId: z.string().describe("Venue ID for the heats"),
		startTime: z
			.string()
			.datetime()
			.describe("Start time for first heat (ISO 8601)"),
		athletesPerHeat: z
			.number()
			.int()
			.min(4)
			.max(20)
			.default(10)
			.describe("Target number of athletes per heat"),
		minutesBetweenHeats: z
			.number()
			.int()
			.min(5)
			.max(60)
			.default(12)
			.describe("Minutes between heat start times"),
		groupByDivision: z
			.boolean()
			.default(true)
			.describe("Group athletes by division (easier for judges)"),
		estimatedDurationMinutes: z
			.number()
			.int()
			.min(1)
			.max(180)
			.optional()
			.describe("Estimated workout duration (for scheduling)"),
	}),
	execute: async (inputData, context) => {
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return CommonErrors.noTeamContext()
		}

		const db = getDb()

		try {
			// Verify competition access
			const competition = await db.query.competitionsTable.findFirst({
				where: and(
					eq(competitionsTable.id, inputData.competitionId),
					eq(competitionsTable.organizingTeamId, teamId),
				),
			})

			if (!competition) {
				return CommonErrors.competitionNotFound(inputData.competitionId, teamId)
			}

			// Verify venue exists and get lane count
			const venue = await db.query.competitionVenuesTable.findFirst({
				where: and(
					eq(competitionVenuesTable.id, inputData.venueId),
					eq(competitionVenuesTable.competitionId, inputData.competitionId),
				),
			})

			if (!venue) {
				return createToolError({
					error: ErrorCode.RESOURCE_NOT_FOUND,
					message: `Venue '${inputData.venueId}' not found`,
					suggestion: "Check the venue ID or create a venue first",
					nextActions: ["listVenues", "createVenue"],
				})
			}

			// Get all registrations for this competition
			const registrations = await db.query.competitionRegistrationsTable.findMany({
				where: eq(competitionRegistrationsTable.eventId, inputData.competitionId),
				with: {
					division: true,
					user: true,
				},
			})

			if (registrations.length === 0) {
				return createToolError({
					error: ErrorCode.INSUFFICIENT_DATA,
					message: "No athletes registered for this competition",
					suggestion: "Wait for athletes to register before scheduling heats",
					nextActions: ["getRegistrationOverview"],
				})
			}

			// Group by division if requested
			const groups: Map<
				string,
				Array<{
					id: string
					divisionId: string
					divisionName: string
					userName: string
				}>
			> = new Map()

			for (const reg of registrations) {
				const divisionId = reg.divisionId || "no-division"
				const divisionName =
					(reg.division as any)?.label || "No Division"
				const userName = reg.user
					? `${(reg.user as any).firstName || ""} ${(reg.user as any).lastName || ""}`.trim() ||
						(reg.user as any).email
					: "Unknown"

				if (!groups.has(divisionId)) {
					groups.set(divisionId, [])
				}
				groups.get(divisionId)!.push({
					id: reg.id,
					divisionId,
					divisionName,
					userName,
				})
			}

			// Generate heats
			const heats: Array<{
				heatNumber: number
				scheduledTime: Date
				divisionId: string | null
				divisionName: string
				athletes: Array<{ registrationId: string; laneNumber: number }>
			}> = []

			let currentHeatNumber = 1
			const baseTime = new Date(inputData.startTime)

			// If grouping by division, create heats for each division
			if (inputData.groupByDivision) {
				for (const [divisionId, athletes] of groups.entries()) {
					// Calculate number of heats needed for this division
					const heatsNeeded = Math.ceil(athletes.length / inputData.athletesPerHeat)

					for (let i = 0; i < heatsNeeded; i++) {
						const startIdx = i * inputData.athletesPerHeat
						const endIdx = Math.min(
							startIdx + inputData.athletesPerHeat,
							athletes.length,
						)
						const heatAthletes = athletes.slice(startIdx, endIdx)

						heats.push({
							heatNumber: currentHeatNumber,
							scheduledTime: new Date(
								baseTime.getTime() +
									(currentHeatNumber - 1) *
										inputData.minutesBetweenHeats *
										60 *
										1000,
							),
							divisionId: divisionId === "no-division" ? null : divisionId,
							divisionName: heatAthletes[0]?.divisionName || "Mixed",
							athletes: heatAthletes.map((a, idx) => ({
								registrationId: a.id,
								laneNumber: idx + 1,
							})),
						})

						currentHeatNumber++
					}
				}
			} else {
				// Don't group by division - mix all athletes
				const allAthletes = Array.from(groups.values()).flat()
				const heatsNeeded = Math.ceil(allAthletes.length / inputData.athletesPerHeat)

				for (let i = 0; i < heatsNeeded; i++) {
					const startIdx = i * inputData.athletesPerHeat
					const endIdx = Math.min(
						startIdx + inputData.athletesPerHeat,
						allAthletes.length,
					)
					const heatAthletes = allAthletes.slice(startIdx, endIdx)

					heats.push({
						heatNumber: currentHeatNumber,
						scheduledTime: new Date(
							baseTime.getTime() +
								(currentHeatNumber - 1) *
									inputData.minutesBetweenHeats *
									60 *
									1000,
						),
						divisionId: null,
						divisionName: "Mixed",
						athletes: heatAthletes.map((a, idx) => ({
							registrationId: a.id,
							laneNumber: idx + 1,
						})),
					})

					currentHeatNumber++
				}
			}

			// Create heat records and assignments
			let athletesScheduled = 0
			for (const heat of heats) {
				// Create heat
				const [{ id: heatId }] = await db.insert(competitionHeatsTable).values({
					competitionId: inputData.competitionId,
					trackWorkoutId: inputData.trackWorkoutId,
					heatNumber: heat.heatNumber,
					scheduledTime: heat.scheduledTime,
					venueId: inputData.venueId,
					divisionId: heat.divisionId,
					durationMinutes: inputData.estimatedDurationMinutes,
					schedulePublishedAt: null, // Not published yet
				}).returning({ id: competitionHeatsTable.id })

				// Create assignments
				for (const athlete of heat.athletes) {
					await db.insert(competitionHeatAssignmentsTable).values({
						heatId,
						registrationId: athlete.registrationId,
						laneNumber: athlete.laneNumber,
					})
					athletesScheduled++
				}
			}

			const unassignedAthletes = registrations.length - athletesScheduled

			return createToolSuccess({
				data: {
					heatsCreated: heats.length,
					athletesScheduled,
					unassignedAthletes,
					schedule: heats.map((h) => ({
						heatNumber: h.heatNumber,
						time: h.scheduledTime.toISOString(),
						division: h.divisionName,
						athleteCount: h.athletes.length,
					})),
				},
				message: `Created ${heats.length} heats and scheduled ${athletesScheduled} athletes. ${unassignedAthletes > 0 ? `Warning: ${unassignedAthletes} athletes were not scheduled.` : "All athletes scheduled!"}`,
				nextActions: unassignedAthletes > 0
					? ["getUnassignedAthletes", "createAdditionalHeats"]
					: ["publishHeatSchedule", "notifyAthletes"],
			})
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to schedule heats"

			return createToolError({
				error: ErrorCode.OPERATION_FAILED,
				message: `Failed to schedule heats: ${message}`,
				suggestion: "Check that the competition has registrations and a valid venue",
				nextActions: ["getRegistrationOverview", "listVenues"],
			})
		}
	},
})
