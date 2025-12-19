"use server"

import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import type { LaneShiftPattern } from "@/db/schemas/volunteers"
import { requireVerifiedEmail } from "@/utils/auth"
import { RATE_LIMITS, withRateLimit } from "@/utils/with-rate-limit"

/**
 * Update competition rotation configuration settings
 */
export async function updateCompetitionRotationSettings(input: {
	competitionId: string
	defaultHeatsPerRotation?: number
	defaultLaneShiftPattern?: LaneShiftPattern
}) {
	return withRateLimit(async () => {
		const session = await requireVerifiedEmail()
		if (!session) throw new Error("Unauthorized")

		const db = getDb()

		// Verify user has permission to manage this competition
		const competition = await db.query.competitionsTable.findFirst({
			where: eq(competitionsTable.id, input.competitionId),
		})
		if (!competition) throw new Error("Competition not found")

		// Import permission check
		const { requireTeamPermission } = await import("@/utils/team-auth")
		await requireTeamPermission(
			competition.organizingTeamId,
			TEAM_PERMISSIONS.MANAGE_PROGRAMMING,
		)

		// Validate heats per rotation range
		if (
			input.defaultHeatsPerRotation !== undefined &&
			(input.defaultHeatsPerRotation < 1 || input.defaultHeatsPerRotation > 10)
		) {
			throw new Error("Heats per rotation must be between 1 and 10")
		}

		// Update competition
		await db
			.update(competitionsTable)
			.set({
				defaultHeatsPerRotation: input.defaultHeatsPerRotation,
				defaultLaneShiftPattern: input.defaultLaneShiftPattern,
				updatedAt: new Date(),
			})
			.where(eq(competitionsTable.id, input.competitionId))

		return { success: true }
	}, RATE_LIMITS.SETTINGS)
}
