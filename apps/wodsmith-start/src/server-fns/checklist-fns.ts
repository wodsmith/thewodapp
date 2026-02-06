/**
 * Setup Checklist Server Functions
 *
 * Fetches all data needed to determine completion status of
 * competition setup checklist items in a single server call.
 */

import { createServerFn } from "@tanstack/react-start"
import { count, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import {
	programmingTracksTable,
	trackWorkoutsTable,
} from "@/db/schemas/programming"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { waiversTable } from "@/db/schemas/waivers"

const getChecklistStatusInputSchema = z.object({
	competitionId: z.string().min(1, "Competition ID is required"),
	organizingTeamId: z.string().min(1, "Organizing team ID is required"),
})

export interface ChecklistStatus {
	hasCompetitionDetails: boolean
	hasDivisions: boolean
	hasEvents: boolean
	hasScoringConfig: boolean
	hasRegistrationConfig: boolean
	hasWaivers: boolean
	isPublished: boolean
}

/**
 * Get the completion status of all setup checklist items for a competition.
 * Returns booleans for each checklist step.
 */
export const getChecklistStatusFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => getChecklistStatusInputSchema.parse(data))
	.handler(async ({ data }): Promise<ChecklistStatus> => {
		const db = getDb()

		// Fetch competition details
		const competition = await db
			.select({
				name: competitionsTable.name,
				description: competitionsTable.description,
				startDate: competitionsTable.startDate,
				endDate: competitionsTable.endDate,
				bannerImageUrl: competitionsTable.bannerImageUrl,
				settings: competitionsTable.settings,
				registrationOpensAt: competitionsTable.registrationOpensAt,
				registrationClosesAt: competitionsTable.registrationClosesAt,
				defaultRegistrationFeeCents:
					competitionsTable.defaultRegistrationFeeCents,
				status: competitionsTable.status,
			})
			.from(competitionsTable)
			.where(eq(competitionsTable.id, data.competitionId))
			.limit(1)

		if (!competition[0]) {
			throw new Error("Competition not found")
		}

		const comp = competition[0]

		// Get programming track for this competition
		const track = await db
			.select({
				id: programmingTracksTable.id,
				scalingGroupId: programmingTracksTable.scalingGroupId,
			})
			.from(programmingTracksTable)
			.where(eq(programmingTracksTable.competitionId, data.competitionId))
			.limit(1)

		// Count divisions (scaling levels in the competition's scaling group)
		let divisionCount = 0
		if (track[0]?.scalingGroupId) {
			const divisions = await db
				.select({ count: count() })
				.from(scalingLevelsTable)
				.where(eq(scalingLevelsTable.scalingGroupId, track[0].scalingGroupId))
			divisionCount = divisions[0]?.count ?? 0
		}

		// Count events (track workouts under the competition's programming track)
		let eventCount = 0
		if (track[0]) {
			const events = await db
				.select({ count: count() })
				.from(trackWorkoutsTable)
				.where(eq(trackWorkoutsTable.trackId, track[0].id))
			eventCount = events[0]?.count ?? 0
		}

		// Count waivers
		const waiverResult = await db
			.select({ count: count() })
			.from(waiversTable)
			.where(eq(waiversTable.competitionId, data.competitionId))
		const waiverCount = waiverResult[0]?.count ?? 0

		// Parse scoring config from settings JSON
		let hasScoringConfig = false
		if (comp.settings) {
			try {
				const settings = JSON.parse(comp.settings) as Record<string, unknown>
				hasScoringConfig = !!settings.scoringConfig
			} catch {
				// Invalid JSON
			}
		}

		// Competition details are "complete" when name exists and dates are set
		// (name is required, so check for optional enrichments)
		const hasCompetitionDetails = !!(
			comp.name &&
			comp.startDate &&
			comp.endDate
		)

		// Registration config is set when open/close dates are configured
		const hasRegistrationConfig = !!(
			comp.registrationOpensAt && comp.registrationClosesAt
		)

		return {
			hasCompetitionDetails,
			hasDivisions: divisionCount > 0,
			hasEvents: eventCount > 0,
			hasScoringConfig,
			hasRegistrationConfig,
			hasWaivers: waiverCount > 0,
			isPublished: comp.status === "published",
		}
	})
