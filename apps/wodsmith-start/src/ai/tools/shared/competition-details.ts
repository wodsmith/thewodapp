/**
 * @fileoverview Shared AI tools for reading competition details.
 *
 * These tools are shared across all sub-agents (Setup, Operations,
 * Registration, Finance) to provide read access to competition data.
 */

import { createTool } from "@mastra/core/tools"
import { z } from "zod"
import { eq, and, count, sql } from "drizzle-orm"

import { getDb } from "@/db"
import {
	competitionsTable,
	competitionRegistrationsTable,
	competitionVenuesTable,
	competitionHeatsTable,
} from "@/db/schemas/competitions"
import { competitionDivisionsTable } from "@/db/schemas/commerce"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import {
	trackWorkoutsTable,
	programmingTracksTable,
} from "@/db/schemas/programming"
import { workouts as workoutsTable } from "@/db/schemas/workouts"
import { waiversTable } from "@/db/schemas/waivers"
import { parseCompetitionSettings } from "@/types/competitions"

/**
 * Get comprehensive competition details including divisions, events, venues,
 * registration counts, and waivers.
 */
export const getCompetitionDetails = createTool({
	id: "get-competition-details",
	description:
		"Get full details of a competition including divisions, events, venues, waivers, and registration count. Use this to understand the current state of a competition before making changes or recommendations.",
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

		// Parse competition settings to get scaling group
		const settings = parseCompetitionSettings(competition.settings)
		const scalingGroupId = settings?.divisions?.scalingGroupId

		// Get divisions from scaling levels table
		let divisions: Array<{
			id: string
			label: string
			description: string | null
			feeCents: number | null
			position: number
			teamSize: number
		}> = []

		if (scalingGroupId) {
			divisions = await db
				.select({
					id: scalingLevelsTable.id,
					label: scalingLevelsTable.label,
					position: scalingLevelsTable.position,
					teamSize: scalingLevelsTable.teamSize,
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
			heatStatus: string | null
			sortOrder: number
			timeCap: number | null
			pointsMultiplier: number | null
		}> = []

		if (track) {
			const trackWorkouts = await db
				.select({
					id: trackWorkoutsTable.id,
					eventStatus: trackWorkoutsTable.eventStatus,
					heatStatus: trackWorkoutsTable.heatStatus,
					trackOrder: trackWorkoutsTable.trackOrder,
					pointsMultiplier: trackWorkoutsTable.pointsMultiplier,
					workoutName: workoutsTable.name,
					workoutScheme: workoutsTable.scheme,
					workoutTimeCap: workoutsTable.timeCap,
				})
				.from(trackWorkoutsTable)
				.innerJoin(
					workoutsTable,
					eq(trackWorkoutsTable.workoutId, workoutsTable.id),
				)
				.where(eq(trackWorkoutsTable.trackId, track.id))
				.orderBy(trackWorkoutsTable.trackOrder)

			events = trackWorkouts.map((tw) => ({
				id: tw.id,
				name: tw.workoutName ?? "Unnamed Event",
				scheme: tw.workoutScheme ?? "time",
				eventStatus: tw.eventStatus,
				heatStatus: tw.heatStatus,
				sortOrder: tw.trackOrder,
				timeCap: tw.workoutTimeCap,
				pointsMultiplier: tw.pointsMultiplier,
			}))
		}

		// Get venues
		const venues = await db.query.competitionVenuesTable.findMany({
			where: eq(competitionVenuesTable.competitionId, competitionId),
			orderBy: (v, { asc }) => [asc(v.sortOrder)],
		})

		// Get waivers
		const waivers = await db.query.waiversTable.findMany({
			where: eq(waiversTable.competitionId, competitionId),
			orderBy: (w, { asc }) => [asc(w.position)],
		})

		// Get total registration count
		const [totalResult] = await db
			.select({ total: count() })
			.from(competitionRegistrationsTable)
			.where(eq(competitionRegistrationsTable.eventId, competitionId))

		// Get heat count per event
		const heatCounts = track
			? await db
					.select({
						trackWorkoutId: competitionHeatsTable.trackWorkoutId,
						count: count(),
					})
					.from(competitionHeatsTable)
					.where(eq(competitionHeatsTable.competitionId, competitionId))
					.groupBy(competitionHeatsTable.trackWorkoutId)
			: []

		const heatCountMap = new Map(
			heatCounts.map((h) => [h.trackWorkoutId, Number(h.count)]),
		)

		return {
			competition: {
				id: competition.id,
				name: competition.name,
				slug: competition.slug,
				description: competition.description,
				startDate: competition.startDate.toISOString(),
				endDate: competition.endDate.toISOString(),
				registrationOpensAt: competition.registrationOpensAt?.toISOString(),
				registrationClosesAt: competition.registrationClosesAt?.toISOString(),
				status: competition.status,
				visibility: competition.visibility,
				defaultRegistrationFeeCents: competition.defaultRegistrationFeeCents,
			},
			divisions: divisions.map((d) => ({
				id: d.id,
				name: d.label,
				description: d.description,
				feeCents: d.feeCents,
				teamSize: d.teamSize,
				registrationCount: countMap.get(d.id) ?? 0,
			})),
			events: events.map((e) => ({
				...e,
				heatCount: heatCountMap.get(e.id) ?? 0,
			})),
			venues: venues.map((v) => ({
				id: v.id,
				name: v.name,
				laneCount: v.laneCount,
				transitionMinutes: v.transitionMinutes,
			})),
			waivers: waivers.map((w) => ({
				id: w.id,
				title: w.title,
				required: w.required,
				position: w.position,
			})),
			totalRegistrations: totalResult?.total ?? 0,
			trackId: track?.id,
		}
	},
})

/**
 * List competitions for the organizer's team.
 */
export const listCompetitions = createTool({
	id: "list-competitions",
	description:
		"List all competitions for the organizer's team. Returns basic info about each competition including status and registration counts. Use this to find competition IDs for other operations.",
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
			.describe("Maximum number of competitions to return (default 20)"),
	}),
	execute: async (inputData, context) => {
		const { status, limit = 20 } = inputData
		const teamId = context?.requestContext?.get("team-id") as string | undefined

		if (!teamId) {
			return { error: "Team context required", competitions: [] }
		}

		const db = getDb()

		const competitions = await db
			.select({
				id: competitionsTable.id,
				name: competitionsTable.name,
				slug: competitionsTable.slug,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				status: competitionsTable.status,
				visibility: competitionsTable.visibility,
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
				visibility: c.visibility,
				registrationCount: Number(c.registrationCount),
			})),
		}
	},
})
