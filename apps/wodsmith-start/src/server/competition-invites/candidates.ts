/**
 * Invite Source Candidates Query
 *
 * `getCandidatesForSourceComp` returns the set of athletes from a single
 * source competition that are eligible to surface on the championship
 * organizer's Candidates page for a given source-side division.
 *
 * Why this lives here instead of going through `getCompetitionLeaderboard`:
 *
 * The leaderboard's job is to rank athletes who have *scored* on
 * *published* events, with optional gating by heat assignment when no
 * explicit event-division mapping exists. Those gates make sense for the
 * public/event display, but they are the wrong contract for invite-source
 * candidates: a championship organizer wants to invite from every
 * registered division regardless of whether scores or heats exist yet.
 *
 * Earlier we tried bolting a `bypassHeatBasedDivisionFilter` flag onto
 * the leaderboard. That fixed the symptom but coupled two separate
 * concerns through a growing list of conditional flags. This module owns
 * its own query so the two paths can evolve independently — see
 * `docs/bugs/0001-invite-candidates-missing-divisions.md`.
 */
// @lat: [[competition-invites#Candidates query]]

import "server-only"

import { and, asc, eq, ne } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import { scalingLevelsTable } from "@/db/schemas/scaling"
import { userTable } from "@/db/schemas/users"

// ============================================================================
// Types
// ============================================================================

export interface CandidateEntry {
	/** Registration row that produced this candidate. */
	registrationId: string
	/** Captain user id for the registration. */
	userId: string
	/** Display name — "First Last", or email when names are missing. */
	athleteName: string
	/** Athlete email; null only when the user row has no email on file. */
	athleteEmail: string | null
	/** Source-side division id (scaling level) on the source comp. */
	divisionId: string
	/** Source-side division label (e.g. "Co-Ed - RX"). */
	divisionLabel: string
	/** Source-comp registeredAt — used for stable ordering. */
	registeredAt: Date
}

export interface GetCandidatesForSourceCompInput {
	competitionId: string
	divisionId: string
}

export interface GetCandidatesForSourceCompResult {
	entries: CandidateEntry[]
}

// ============================================================================
// Query
// ============================================================================

/**
 * Return active registrations for `(competitionId, divisionId)` shaped as
 * candidate entries. No score-based ranking is applied; entries are
 * ordered by `registeredAt` for stable display.
 *
 * Future enhancement: layer optional score-based ranking on top of this
 * query when the source comp has scored events. The ordering tradeoff is
 * called out in `docs/bugs/0001-invite-candidates-missing-divisions.md`.
 */
export async function getCandidatesForSourceComp(
	input: GetCandidatesForSourceCompInput,
): Promise<GetCandidatesForSourceCompResult> {
	const db = getDb()

	const rows = await db
		.select({
			registrationId: competitionRegistrationsTable.id,
			userId: competitionRegistrationsTable.userId,
			divisionId: competitionRegistrationsTable.divisionId,
			divisionLabel: scalingLevelsTable.label,
			registeredAt: competitionRegistrationsTable.registeredAt,
			firstName: userTable.firstName,
			lastName: userTable.lastName,
			email: userTable.email,
		})
		.from(competitionRegistrationsTable)
		.innerJoin(
			userTable,
			eq(competitionRegistrationsTable.userId, userTable.id),
		)
		.leftJoin(
			scalingLevelsTable,
			eq(competitionRegistrationsTable.divisionId, scalingLevelsTable.id),
		)
		.where(
			and(
				eq(competitionRegistrationsTable.eventId, input.competitionId),
				eq(competitionRegistrationsTable.divisionId, input.divisionId),
				ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
			),
		)
		.orderBy(asc(competitionRegistrationsTable.registeredAt))

	const entries: CandidateEntry[] = rows.map((r) => {
		const fullName =
			`${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() ||
			r.email ||
			"Unknown"
		return {
			registrationId: r.registrationId,
			userId: r.userId,
			athleteName: fullName,
			athleteEmail: r.email ?? null,
			divisionId: r.divisionId ?? input.divisionId,
			divisionLabel: r.divisionLabel ?? "",
			registeredAt: r.registeredAt,
		}
	})

	return { entries }
}
