/**
 * Competition detail viewer helpers (server-only).
 *
 * Query logic shared by getUserCompetitionRegistrationsFn /
 * getPendingTeamInvitesFn and the consolidated competition page server fn.
 * Lives in src/server so it isn't an exported plain function inside a
 * server-fn module — those survive the client compile and would drag `@/db`
 * (and its `cloudflare:workers` import) into the browser bundle.
 */

import "server-only"

import { and, eq, exists, gt, inArray, isNull, ne, sql } from "drizzle-orm"
import { getDb } from "@/db"
import {
	competitionRegistrationsTable,
	REGISTRATION_STATUS,
} from "@/db/schemas/competitions"
import {
	INVITATION_STATUS,
	SYSTEM_ROLES_ENUM,
	teamInvitationTable,
	teamMembershipTable,
} from "@/db/schemas/teams"

/**
 * Get ALL of a user's registrations for a competition.
 * Takes the userId from the caller (which must derive it from the session —
 * never from client input).
 *
 * The direct-registrations and team-memberships queries are independent, so
 * they run on separate connections for true wire parallelism (a single
 * mysql2 connection serializes commands).
 */
export async function getUserCompetitionRegistrationsForUser({
	competitionId,
	userId,
}: {
	competitionId: string
	userId: string
}) {
	const registrationColumns = {
		id: competitionRegistrationsTable.id,
		eventId: competitionRegistrationsTable.eventId,
		userId: competitionRegistrationsTable.userId,
		divisionId: competitionRegistrationsTable.divisionId,
		registeredAt: competitionRegistrationsTable.registeredAt,
		status: competitionRegistrationsTable.status,
		teamName: competitionRegistrationsTable.teamName,
		captainUserId: competitionRegistrationsTable.captainUserId,
		athleteTeamId: competitionRegistrationsTable.athleteTeamId,
		teamMemberId: competitionRegistrationsTable.teamMemberId,
	}

	const db = getDb()
	const membershipsDb = getDb()

	// Get direct registrations (as captain/individual) and the user's active
	// team memberships in parallel — they don't depend on each other.
	const [directRegistrations, userTeamMemberships] = await Promise.all([
		db
			.select(registrationColumns)
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.eventId, competitionId),
					eq(competitionRegistrationsTable.userId, userId),
					ne(competitionRegistrationsTable.status, REGISTRATION_STATUS.REMOVED),
				),
			),
		membershipsDb
			.select({ teamId: teamMembershipTable.teamId })
			.from(teamMembershipTable)
			.where(
				and(
					eq(teamMembershipTable.userId, userId),
					eq(teamMembershipTable.isActive, true),
				),
			),
	])

	let teamRegistrations: typeof directRegistrations = []
	if (userTeamMemberships.length > 0) {
		const userTeamIds = userTeamMemberships.map((m) => m.teamId)

		teamRegistrations = await db
			.select(registrationColumns)
			.from(competitionRegistrationsTable)
			.where(
				and(
					eq(competitionRegistrationsTable.eventId, competitionId),
					ne(
						competitionRegistrationsTable.status,
						REGISTRATION_STATUS.REMOVED,
					),
					inArray(competitionRegistrationsTable.athleteTeamId, userTeamIds),
				),
			)
	}

	// Merge and deduplicate by division.
	// Direct registrations (user's own rows) take priority.
	// Team query may return teammate rows in the same division — skip those.
	const divisionMap = new Map<string | null, (typeof directRegistrations)[0]>()

	for (const reg of directRegistrations) {
		divisionMap.set(reg.divisionId, reg)
	}

	for (const reg of teamRegistrations) {
		if (!divisionMap.has(reg.divisionId)) {
			divisionMap.set(reg.divisionId, reg)
		} else if (
			reg.userId === userId &&
			divisionMap.get(reg.divisionId)!.userId !== userId
		) {
			// Prefer the user's own row over a teammate's row
			divisionMap.set(reg.divisionId, reg)
		}
	}

	return { registrations: Array.from(divisionMap.values()) }
}

/**
 * Find unclaimed teammate invitations for an email on a competition.
 * Filters teamInvitationTable by email first and correlates to the
 * competition's athlete teams with EXISTS — instead of fetching every
 * registration in the competition to feed an inArray (unbounded scan).
 */
export async function getPendingTeamInvitesForEmail({
	competitionId,
	email,
}: {
	competitionId: string
	email: string
}) {
	const db = getDb()

	const invitations = await db
		.select({
			id: teamInvitationTable.id,
			teamId: teamInvitationTable.teamId,
			email: teamInvitationTable.email,
			roleId: teamInvitationTable.roleId,
			isSystemRole: teamInvitationTable.isSystemRole,
			token: teamInvitationTable.token,
			expiresAt: teamInvitationTable.expiresAt,
			createdAt: teamInvitationTable.createdAt,
			metadata: teamInvitationTable.metadata,
		})
		.from(teamInvitationTable)
		.where(
			and(
				eq(teamInvitationTable.email, email),
				eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.MEMBER),
				eq(teamInvitationTable.isSystemRole, true),
				isNull(teamInvitationTable.acceptedAt),
				ne(teamInvitationTable.status, INVITATION_STATUS.CANCELLED),
				gt(teamInvitationTable.expiresAt, new Date()),
				exists(
					db
						.select({ one: sql`1` })
						.from(competitionRegistrationsTable)
						.where(
							and(
								eq(
									competitionRegistrationsTable.athleteTeamId,
									teamInvitationTable.teamId,
								),
								eq(competitionRegistrationsTable.eventId, competitionId),
								ne(
									competitionRegistrationsTable.status,
									REGISTRATION_STATUS.REMOVED,
								),
							),
						),
				),
			),
		)

	return { invitations }
}
