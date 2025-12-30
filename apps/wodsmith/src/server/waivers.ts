import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { getDb } from "@/db"
import { competitionsTable } from "@/db/schemas/competitions"
import {
	type Waiver,
	type WaiverSignature,
	waiverSignaturesTable,
	waiversTable,
} from "@/db/schemas/waivers"
import { autochunk } from "@/utils/batch-query"

/**
 * Get all waivers for a competition, ordered by position
 */
export async function getCompetitionWaivers(
	competitionId: string,
): Promise<Waiver[]> {
	const db = getDb()

	const waivers = await db.query.waiversTable.findMany({
		where: eq(waiversTable.competitionId, competitionId),
		orderBy: (table, { asc }) => [asc(table.position)],
	})

	return waivers
}

/**
 * Get a single waiver by ID
 */
export async function getWaiver(waiverId: string): Promise<Waiver | null> {
	const db = getDb()

	const waiver = await db.query.waiversTable.findFirst({
		where: eq(waiversTable.id, waiverId),
	})

	return waiver ?? null
}

/**
 * Get all waiver signatures for a registration
 * Used to check if an athlete has signed all required waivers
 */
export async function getWaiverSignaturesForRegistration(
	registrationId: string,
): Promise<WaiverSignature[]> {
	const db = getDb()

	const signatures = await db.query.waiverSignaturesTable.findMany({
		where: eq(waiverSignaturesTable.registrationId, registrationId),
		with: {
			waiver: true,
		},
	})

	return signatures
}

/**
 * Get all waiver signatures for a user in a specific competition
 * Used to check if a user (captain or teammate) has signed all required waivers
 */
export async function getWaiverSignaturesForUser(
	userId: string,
	competitionId: string,
): Promise<WaiverSignature[]> {
	const db = getDb()

	// Get all waivers for the competition
	const waivers = await getCompetitionWaivers(competitionId)
	const waiverIds = waivers.map((w) => w.id)

	if (waiverIds.length === 0) {
		return []
	}

	// Get signatures for this user for any of those waivers
	// Use autochunk to handle potential large arrays (D1 has 100 param limit)
	const signatures = await autochunk(
		{ items: waiverIds, otherParametersCount: 1 }, // 1 for userId param
		async (chunk) =>
			db.query.waiverSignaturesTable.findMany({
				where: and(
					eq(waiverSignaturesTable.userId, userId),
					inArray(waiverSignaturesTable.waiverId, chunk),
				),
				with: {
					waiver: true,
				},
			}),
	)

	return signatures
}

/**
 * Validate that a competition belongs to the given team (organizing team)
 * Throws an error if the competition doesn't exist or doesn't belong to the team
 */
export async function validateCompetitionOwnership(
	competitionId: string,
	teamId: string,
): Promise<void> {
	const db = getDb()

	const competition = await db.query.competitionsTable.findFirst({
		where: eq(competitionsTable.id, competitionId),
	})

	if (!competition) {
		throw new Error("Competition not found")
	}

	if (competition.organizingTeamId !== teamId) {
		throw new Error("Competition does not belong to this team")
	}
}
