/**
 * @fileoverview AI Tools for competition management.
 *
 * These tools allow the Competition Planner agent to:
 * - Query competition details, divisions, events, and registrations
 * - Analyze event balance across time domains and movements
 * - Validate competition setup for common issues
 *
 * Tools are permission-aware and respect multi-tenant team boundaries.
 *
 * @see {@link https://mastra.ai/docs/tools Mastra Tools Documentation}
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
	competitionVenuesTable,
} from "@/db/schemas/competitions"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import {
	trackWorkoutsTable,
	programmingTracksTable,
} from "@/db/schemas/programming"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { eq, and, count, sql } from "drizzle-orm"
import { parseCompetitionSettings } from "@/types/competitions"

/**
 * Get competition details including divisions, events, and registration count.
 */
export const getCompetitionDetails = createTool({
	id: "get-competition-details",
	description:
		"Get full details of a competition including divisions, events, venues, and registration count. Use this to understand the current state of a competition before making changes.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID to fetch"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Get competition (verify team ownership)
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Parse competition settings to get scaling group (divisions are defined via scaling groups)
		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		// Get divisions from scaling levels table (the source of truth for divisions)
		// LEFT JOIN to competitionDivisionsTable for any overrides (description, fee)
		let divisions: Array<{
			id: string
			label: string
			description: string | null
			feeCents: number | null
			position: number
		}> = []

		if (scalingGroupId) {
			divisions = await db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
					position: scalingLevelsTable.position,
					description: competitionDivisionsTable.description,
					feeCents: competitionDivisionsTable.feeCents,
				})
				.from(scalingLevelsTable)
				.leftJoin(
					competitionDivisionsTable,
					and(
						eq(competitionDivisionsTable.divisionId, scalingLevelsTable.id),
						eq(competitionDivisionsTable.competitionId, competitionId),
					),
				)
				.where(eq(scalingLevelsTable.scalingGroupId, scalingGroupId))
				.orderBy(scalingLevelsTable.position)
		}

		// Get registration counts per division
		const registrationCounts = await db
			.select({
				divisionId: competitionRegistrationsTable.divisionId,
				count: count(),
			})
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))
			.groupBy(competitionRegistrationsTable.divisionId)

		const countMap = new Map(
			registrationCounts.map((r) => [r.divisionId, Number(r.count)]),
		)

		// Get programming track for this competition
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		// Get events (track workouts) if track exists
		let events: Array<{
			id: string
			name: string
			scheme: string
			eventStatus: string | null
			sortOrder: number
		}> = []

		if (track) {
			// Use explicit join for proper type inference
			const trackWorkouts = await db
				.select({
					id: trackWorkoutsTable.id,
					eventStatus: trackWorkoutsTable.eventStatus,
					trackOrder: trackWorkoutsTable.trackOrder,
					workoutName: workoutsTable.name,
					workoutScheme: workoutsTable.scheme,
				})
				.from(trackWorkoutsTable)
				.innerJoin(
					workoutsTable,
					eq(trackWorkoutsTable.workoutId, workoutsTable.id),
				)
				.where(eq(trackWorkoutsTable.trackId, track.id))

			events = trackWorkouts.map((tw) => ({
				id: tw.id,
				name: tw.workoutName ?? "Unnamed Event",
				scheme: tw.workoutScheme ?? "time",
				eventStatus: tw.eventStatus,
				sortOrder: tw.trackOrder,
			}))
		}

		// Get venues
		const venues = await db.query.competitionVenuesTable.findMany({
			where: eq(competitionVenuesTable.competitionId, competitionId),
			orderBy: (v, { asc }) => [asc(v.sortOrder)],
		})

		// Get total registration count
		const [totalResult] = await db
			.select({ total: count() })
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))

		return {
			competition: {
				id: competition.id,
				name: competition.name,
				slug: competition.slug,
				description: competition.description,
				startDate: competition.startDate.toISOString(),
				endDate: competition.endDate.toISOString(),
				status: competition.status,
				visibility: competition.visibility,
			},
			divisions: divisions.map((d) => ({
				id: d.id,
				name: d.label,
				description: d.description,
				feeCents: d.feeCents,
				registrationCount: countMap.get(d.id) ?? 0,
			})),
			events,
			venues: venues.map((v) => ({
				id: v.id,
				name: v.name,
				laneCount: v.laneCount,
			})),
			totalRegistrations: totalResult?.total ?? 0,
		}
	},
})

/**
 * List competitions for the organizer's team.
 */
export const listCompetitions = createTool({
	id: "list-competitions",
	description:
		"List all competitions for the organizer's team. Returns basic info about each competition including status and registration counts.",
	inputSchema: z.object({
		status: z
			.enum(["draft", "published", "all"])
			.optional()
			.describe("Filter by competition status"),
		limit: z
			.number()
			.min(1)
			.max(50)
			.optional()
			.describe("Maximum number of competitions to return"),
	}),
	execute: async (inputData, context) => {
		const { status, limit = 20 } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return { error: "Team context required", competitions: [] }
		}

		const db = getDb()

		// Get competitions with registration counts using subquery
		const competitions = await db
			.select({
				id: competitionsTable.id,
				name: competitionsTable.name,
				slug: competitionsTable.slug,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				status: competitionsTable.status,
				registrationCount: sql<number>`(
          SELECT COUNT(*) FROM competition_registrations
          WHERE competition_registrations.eventId = competitions.id
        )`.as("registrationCount"),
			})
			.from(competitionsTable)
			.where(
				and(
					eq(competitionsTable.organizingTeamId, teamId),
					status && status !== "all"
						? eq(competitionsTable.status, status)
						: undefined,
				),
			)
			.orderBy(sql`${competitionsTable.startDate} DESC`)
			.limit(limit)

		return {
			competitions: competitions.map((c) => ({
				id: c.id,
				name: c.name,
				slug: c.slug,
				startDate: c.startDate.toISOString(),
				endDate: c.endDate.toISOString(),
				status: c.status,
				registrationCount: Number(c.registrationCount),
			})),
		}
	},
})

/**
 * Analyze event balance across time domains, movements, and equipment.
 */
export const analyzeEventBalance = createTool({
	id: "analyze-event-balance",
	description:
		"Analyze the balance of events in a competition across time domains, movement patterns, and equipment. Returns gaps and recommendations for a well-rounded competition.",
	inputSchema: z.object({
		competitionId: z.string().describe("The competition ID to analyze"),
	}),
	execute: async (inputData, context) => {
		const { competitionId } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		const db = getDb()

		// Verify access
		const competition = await db.query.competitionsTable.findFirst({
			where: and(
				eq(competitionsTable.id, competitionId),
				teamId ? eq(competitionsTable.organizingTeamId, teamId) : undefined,
			),
		})

		if (!competition) {
			return { error: "Competition not found or access denied" }
		}

		// Get programming track
		const track = await db.query.programmingTracksTable.findFirst({
			where: eq(programmingTracksTable.competitionId, competitionId),
		})

		if (!track) {
			return {
				eventCount: 0,
				analysis: {
					timeDomains: { short: 0, medium: 0, long: 0 },
					schemes: {},
				},
				gaps: ["No programming track found - create events first"],
				recommendations: ["Start by adding a programming track and events"],
			}
		}

		// Get events with workout details using explicit join
		const trackWorkouts = await db
			.select({
				id: trackWorkoutsTable.id,
				scheme: workoutsTable.scheme,
				timeCap: workoutsTable.timeCap,
			})
			.from(trackWorkoutsTable)
			.innerJoin(
				workoutsTable,
				eq(trackWorkoutsTable.workoutId, workoutsTable.id),
			)
			.where(eq(trackWorkoutsTable.trackId, track.id))

		// Analyze time domains (based on time cap or scheme)
		const timeDomains = { short: 0, medium: 0, long: 0 }
		const schemes: Record<string, number> = {}

		for (const tw of trackWorkouts) {
			// Count schemes
			const scheme = tw.scheme
			schemes[scheme] = (schemes[scheme] ?? 0) + 1

			// Estimate time domain
			const timeCap = tw.timeCap
			if (timeCap) {
				if (timeCap < 5) timeDomains.short++
				else if (timeCap <= 15) timeDomains.medium++
				else timeDomains.long++
			} else if (scheme === "load") {
				timeDomains.short++
			} else {
				timeDomains.medium++
			}
		}

		// Generate gaps and recommendations
		const gaps: string[] = []
		const recommendations: string[] = []
		const eventCount = trackWorkouts.length

		if (eventCount === 0) {
			gaps.push("No events have been created yet")
			recommendations.push(
				"Start by creating 3-5 events covering different time domains",
			)
		} else {
			if (timeDomains.short === 0 && eventCount >= 3) {
				gaps.push("Missing short time domain events (<5 min)")
				recommendations.push(
					"Add a sprint workout like a max lift or short couplet",
				)
			}
			if (timeDomains.medium === 0 && eventCount >= 3) {
				gaps.push("Missing medium time domain events (5-15 min)")
				recommendations.push(
					"Add a medium-length workout testing multiple modalities",
				)
			}
			if (timeDomains.long === 0 && eventCount >= 3) {
				gaps.push("Missing long time domain events (>15 min)")
				recommendations.push("Add a longer chipper or AMRAP to test endurance")
			}
			if (!schemes["load"] && eventCount >= 4) {
				gaps.push("No max load events")
				recommendations.push(
					"Consider adding a 1RM or complex to test strength",
				)
			}
			if (eventCount < 3) {
				recommendations.push(
					`Consider adding ${3 - eventCount} more events for a well-rounded competition`,
				)
			}
		}

		return {
			eventCount,
			analysis: { timeDomains, schemes },
			gaps,
			recommendations,
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

		// Check divisions
		const divisions = await db.query.competitionDivisionsTable.findMany({
			where: eq(competitionDivisionsTable.competitionId, competitionId),
		})

		if (divisions.length === 0) {
			issues.push({
				severity: "error",
				category: "Divisions",
				message: "No divisions have been created",
				suggestion: "Create at least one division for athletes to register",
			})
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
			// Check events
			const events = await db.query.trackWorkoutsTable.findMany({
				where: eq(trackWorkoutsTable.trackId, track.id),
			})

			if (events.length === 0) {
				issues.push({
					severity: "error",
					category: "Events",
					message: "No events have been created",
					suggestion:
						"Create competition events (workouts) for athletes to complete",
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
		const venues = await db.query.competitionVenuesTable.findMany({
			where: eq(competitionVenuesTable.competitionId, competitionId),
		})

		if (venues.length === 0 && track) {
			issues.push({
				severity: "info",
				category: "Venues",
				message: "No venues configured for heat scheduling",
				suggestion: "Add venues (floors/areas) to enable heat scheduling",
			})
		}

		return {
			isValid: issues.filter((i) => i.severity === "error").length === 0,
			issues,
		}
	},
})

/**
 * Suggest division structure based on competition type and size.
 */
export const suggestDivisions = createTool({
	id: "suggest-divisions",
	description:
		"Suggest appropriate division structure based on competition type and expected attendance. Returns division recommendations with estimated athlete distribution.",
	inputSchema: z.object({
		competitionType: z
			.enum(["individual", "team", "pairs"])
			.describe("Type of competition"),
		expectedAthletes: z.number().describe("Expected total number of athletes"),
		includeScaled: z
			.boolean()
			.default(true)
			.describe("Include Scaled divisions"),
		includeMasters: z
			.boolean()
			.default(false)
			.describe("Include Masters age divisions"),
		includeTeens: z.boolean().default(false).describe("Include Teen divisions"),
	}),
	execute: async (inputData) => {
		const {
			competitionType,
			expectedAthletes,
			includeScaled,
			includeMasters,
			includeTeens,
		} = inputData

		const suggestions: Array<{
			name: string
			description: string
			estimatedAthletes: number
		}> = []
		const notes: string[] = []

		if (competitionType === "individual") {
			const rxPct = includeScaled ? 0.25 : 0.5
			suggestions.push({
				name: "Rx Men",
				description:
					"Advanced male athletes - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * rxPct),
			})
			suggestions.push({
				name: "Rx Women",
				description:
					"Advanced female athletes - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * rxPct),
			})

			if (includeScaled) {
				suggestions.push({
					name: "Scaled Men",
					description:
						"Intermediate male athletes - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.25),
				})
				suggestions.push({
					name: "Scaled Women",
					description:
						"Intermediate female athletes - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.25),
				})
			}

			if (includeMasters) {
				notes.push(
					"Consider Masters 35+, 40+, 45+, 50+, 55+, 60+ based on expected turnout",
				)
				suggestions.push({
					name: "Masters 35+ Men",
					description: "Male athletes 35 years and older",
					estimatedAthletes: Math.round(expectedAthletes * 0.1),
				})
				suggestions.push({
					name: "Masters 35+ Women",
					description: "Female athletes 35 years and older",
					estimatedAthletes: Math.round(expectedAthletes * 0.1),
				})
			}

			if (includeTeens) {
				suggestions.push({
					name: "Teen Boys (14-17)",
					description: "Male athletes aged 14-17",
					estimatedAthletes: Math.round(expectedAthletes * 0.05),
				})
				suggestions.push({
					name: "Teen Girls (14-17)",
					description: "Female athletes aged 14-17",
					estimatedAthletes: Math.round(expectedAthletes * 0.05),
				})
			}
		} else if (competitionType === "team") {
			suggestions.push({
				name: "Rx Teams",
				description: "Advanced teams - prescribed weights and movements",
				estimatedAthletes: Math.round(expectedAthletes * 0.6),
			})
			if (includeScaled) {
				suggestions.push({
					name: "Scaled Teams",
					description: "Intermediate teams - modified weights/movements",
					estimatedAthletes: Math.round(expectedAthletes * 0.4),
				})
			}
			notes.push(
				"Specify team size (e.g., 2M/2F, 3M/3F) in division description",
			)
		} else if (competitionType === "pairs") {
			suggestions.push({
				name: "Rx Male Pairs",
				description: "Two male athletes - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
			})
			suggestions.push({
				name: "Rx Female Pairs",
				description: "Two female athletes - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
			})
			suggestions.push({
				name: "Rx Mixed Pairs",
				description: "One male, one female athlete - prescribed weights",
				estimatedAthletes: Math.round(expectedAthletes * 0.2),
			})
			if (includeScaled) {
				suggestions.push({
					name: "Scaled Mixed Pairs",
					description: "One male, one female athlete - modified weights",
					estimatedAthletes: Math.round(expectedAthletes * 0.4),
				})
			}
		}

		if (expectedAthletes > 150) {
			notes.push(
				"Large competition - consider adding more age group divisions to improve athlete experience",
			)
		}
		if (expectedAthletes < 30) {
			notes.push(
				"Small competition - consider combining divisions to ensure competitive heats",
			)
		}

		return { suggestions, notes }
	},
})
