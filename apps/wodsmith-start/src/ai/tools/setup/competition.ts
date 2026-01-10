/**
 * @fileoverview Competition details management tools for the Setup Agent.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and } from "drizzle-orm"

import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import { createCompetition as createCompetitionLogic } from "@/server-fns/competition-server-logic"
import { generateSlug } from "@/utils/slugify"

/**
 * Create a new competition.
 * Creates the competition and auto-generates a competition_event team for athlete management.
 */
export const createCompetition = createTool({
	id: "create-competition",
	description:
		"Create a new competition. This creates the competition record and a team for managing competition athletes. After creating, use other tools to add divisions, events, and waivers. When duplicating from an existing competition, do NOT copy the groupId - create the new competition without a series unless the user explicitly requests one.",
	inputSchema: z.object({
		name: z.string().min(1).max(255).describe("Competition name"),
		slug: z
			.string()
			.min(1)
			.max(100)
			.optional()
			.describe(
				"URL-friendly slug (auto-generated from name if not provided). Must be globally unique.",
			),
		startDate: z
			.string()
			.describe("Competition start date (ISO 8601 format, e.g. '2026-03-07')"),
		endDate: z
			.string()
			.optional()
			.describe(
				"Competition end date (ISO 8601 format). Defaults to startDate for single-day events.",
			),
		description: z
			.string()
			.max(2000)
			.optional()
			.describe("Competition description"),
		registrationOpensAt: z
			.string()
			.optional()
			.describe("When registration opens (ISO 8601 format)"),
		registrationClosesAt: z
			.string()
			.optional()
			.describe("When registration closes (ISO 8601 format)"),
		groupId: z
			.string()
			.optional()
			.describe(
				"Competition group/series ID. ONLY pass this if the user explicitly asks to add to an existing series. Do NOT copy from source competitions when duplicating. Omit if not specified.",
			),
	}),
	execute: async (inputData, context) => {
		const {
			name,
			slug,
			startDate,
			endDate,
			description,
			registrationOpensAt,
			registrationClosesAt,
			groupId,
		} = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return {
				error:
					"No team context. Cannot create competition without an organizing team.",
			}
		}

		try {
			// Generate slug from name if not provided
			const competitionSlug = slug || generateSlug(name)

			// Parse dates
			const parsedStartDate = new Date(startDate)
			const parsedEndDate = endDate ? new Date(endDate) : parsedStartDate

			// Validate dates
			if (Number.isNaN(parsedStartDate.getTime())) {
				return {
					error:
						"Invalid startDate format. Use ISO 8601 format (e.g. '2026-03-07')",
				}
			}
			if (Number.isNaN(parsedEndDate.getTime())) {
				return {
					error:
						"Invalid endDate format. Use ISO 8601 format (e.g. '2026-03-07')",
				}
			}
			if (parsedEndDate < parsedStartDate) {
				return { error: "End date cannot be before start date" }
			}

			// Only pass groupId if it's a valid non-empty string
			const validGroupId =
				groupId && groupId.trim() !== "" ? groupId : undefined

			const result = await createCompetitionLogic({
				organizingTeamId: teamId,
				name,
				slug: competitionSlug,
				startDate: parsedStartDate,
				endDate: parsedEndDate,
				description,
				registrationOpensAt: registrationOpensAt
					? new Date(registrationOpensAt)
					: undefined,
				registrationClosesAt: registrationClosesAt
					? new Date(registrationClosesAt)
					: undefined,
				groupId: validGroupId,
			})

			return {
				success: true,
				competitionId: result.competitionId,
				competitionTeamId: result.competitionTeamId,
				name,
				slug: competitionSlug,
				startDate,
				endDate: endDate || startDate,
				message: `Competition "${name}" created successfully. Next steps: add divisions, events, and waivers.`,
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create competition"
			return { error: message }
		}
	},
})

/**
 * Update competition details.
 */
export const updateCompetitionDetails = createTool({
	id: "update-competition-details",
	description:
		"Update a competition's basic details like name, description, dates, and visibility settings.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID"),
		name: z.string().min(1).max(255).optional().describe("Competition name"),
		description: z
			.string()
			.max(2000)
			.optional()
			.describe("Competition description"),
		startDate: z
			.string()
			.datetime()
			.optional()
			.describe("Start date (ISO 8601 format)"),
		endDate: z
			.string()
			.datetime()
			.optional()
			.describe("End date (ISO 8601 format)"),
		registrationOpensAt: z
			.string()
			.datetime()
			.nullable()
			.optional()
			.describe("When registration opens (ISO 8601 format, null to remove)"),
		registrationClosesAt: z
			.string()
			.datetime()
			.nullable()
			.optional()
			.describe("When registration closes (ISO 8601 format, null to remove)"),
		visibility: z
			.enum(["public", "private"])
			.optional()
			.describe("public = listed, private = unlisted but accessible via URL"),
		status: z
			.enum(["draft", "published"])
			.optional()
			.describe(
				"draft = only organizers see it, published = visible based on visibility",
			),
		defaultRegistrationFeeCents: z
			.number()
			.min(0)
			.optional()
			.describe(
				"Default registration fee in cents (used if no division-specific fee)",
			),
	}),
	execute: async (inputData, context) => {
		const {
			competitionId,
			name,
			description,
			startDate,
			endDate,
			registrationOpensAt,
			registrationClosesAt,
			visibility,
			status,
			defaultRegistrationFeeCents,
		} = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify competition access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Build update object
		const updates: Record<string, unknown> = { updatedAt: new Date() }

		if (name !== undefined) updates.name = name
		if (description !== undefined) updates.description = description
		if (startDate !== undefined) updates.startDate = new Date(startDate)
		if (endDate !== undefined) updates.endDate = new Date(endDate)
		if (registrationOpensAt !== undefined)
			updates.registrationOpensAt = registrationOpensAt
				? new Date(registrationOpensAt)
				: null
		if (registrationClosesAt !== undefined)
			updates.registrationClosesAt = registrationClosesAt
				? new Date(registrationClosesAt)
				: null
		if (visibility !== undefined) updates.visibility = visibility
		if (status !== undefined) updates.status = status
		if (defaultRegistrationFeeCents !== undefined)
			updates.defaultRegistrationFeeCents = defaultRegistrationFeeCents

		// Update competition
		await db
			.update(competitionsTable)
			.set(updates)
			.where(eq(competitionsTable.id, competitionId))

		return {
			success: true,
			competitionId,
			updated: {
				name,
				description,
				startDate,
				endDate,
				registrationOpensAt,
				registrationClosesAt,
				visibility,
				status,
				defaultRegistrationFeeCents,
			},
		}
	},
})

/**
 * Validate competition setup for common issues.
 */
export const validateCompetition = createTool({
	id: "validate-competition",
	description:
		"Check a competition setup for common issues and missing configuration. Returns validation errors, warnings, and suggestions.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID to validate"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()
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
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return {
				isValid: false,
				issues: [
					{
						severity: "error" as const,
						category: "Access",
						message: "Competition not found or access denied",
					},
				],
			}
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
		const now = new Date()
		if (competition.startDate < now && competition.status === "draft") {
			issues.push({
				severity: "warning",
				category: "Schedule",
				message: "Competition start date is in the past but status is draft",
				suggestion: "Update dates or publish the competition if it's ready",
			})
		}

		if (competition.endDate < competition.startDate) {
			issues.push({
				severity: "error",
				category: "Schedule",
				message: "End date is before start date",
				suggestion: "Fix the competition dates",
			})
		}

		// Check registration window
		if (competition.registrationOpensAt && competition.registrationClosesAt) {
			if (competition.registrationClosesAt < competition.registrationOpensAt) {
				issues.push({
					severity: "error",
					category: "Registration",
					message: "Registration close date is before open date",
					suggestion: "Fix the registration window dates",
				})
			}
			if (competition.registrationClosesAt > competition.startDate) {
				issues.push({
					severity: "warning",
					category: "Registration",
					message: "Registration closes after competition starts",
					suggestion: "Consider closing registration before the event",
				})
			}
		}

		// Import and check divisions
		const { scalingLevelsTable } = await import("@/db/schemas/scaling")
		const { parseCompetitionSettings } = await import("@/types/competitions")

		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		if (!scalingGroupId) {
			issues.push({
				severity: "error",
				category: "Divisions",
				message: "No scaling group configured",
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
		const { programmingTracksTable, trackWorkoutsTable } = await import(
			"@/db/schemas/programming"
		)

		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		if (!track) {
			issues.push({
				severity: "error",
				category: "Events",
				message: "No programming track found",
				suggestion: "Create events for the competition",
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
					suggestion: "Create competition events for athletes to complete",
				})
			} else {
				const unpublishedEvents = events.filter(
					(e) => e.eventStatus === "draft",
				)
				if (
					unpublishedEvents.length > 0 &&
					competition.status === "published"
				) {
					issues.push({
						severity: "warning",
						category: "Events",
						message: `${unpublishedEvents.length} events are still in draft status`,
						suggestion: "Publish events when ready for athletes to see them",
					})
				}
			}
		}

		// Check venues
		const { competitionVenuesTable } = await import("@/db/schemas/competitions")
		const venues = await db.query.competitionVenuesTable.findMany({
			where: eq(competitionVenuesTable.competitionId, competitionId),
		})

		if (venues.length === 0 && track) {
			issues.push({
				severity: "info",
				category: "Venues",
				message: "No venues configured for heat scheduling",
				suggestion: "Add venues to enable heat scheduling",
			})
		}

		// Check waivers
		const { waiversTable } = await import("@/db/schemas/waivers")
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
			summary: {
				errors: issues.filter((i) => i.severity === "error").length,
				warnings: issues.filter((i) => i.severity === "warning").length,
				info: issues.filter((i) => i.severity === "info").length,
			},
		}
	},
})
