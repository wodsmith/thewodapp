import "server-only"

import { env } from "cloudflare:workers"
import { and, eq, gt, isNull } from "drizzle-orm"
import { getDb } from "@/db"
import { agentImportRunsTable, competitionsTable } from "@/db/schema"
import {
	INVITATION_STATUS,
	SYSTEM_ROLES_ENUM,
	teamInvitationTable,
	teamMembershipTable,
} from "@/db/schemas/teams"
import { userTable } from "@/db/schemas/users"
import type { VolunteerMembershipMetadata } from "@/db/schemas/volunteers"
import {
	boundTableForModel,
	type ParsedTable,
	parseImportFile,
} from "@/lib/organizer-file-import/parse"
import type { ExistingVolunteer } from "@/lib/organizer-file-import/validate"
import type { FileImportScope } from "./access"

/** Flat page facts the model sees instead of raw DB rows. */
export interface FileImportPageContext {
	competitionId: string
	competitionName: string
	routeKind: string
	eventId: string | null
}

// @lat: [[architecture#AI Agents#Organizer file-drop import]]
export async function loadPageContext(input: {
	competitionId: string
	routeKind: string
	eventId: string | null
}): Promise<FileImportPageContext> {
	const db = getDb()
	const [competition] = await db
		.select({ name: competitionsTable.name })
		.from(competitionsTable)
		.where(eq(competitionsTable.id, input.competitionId))
	return {
		competitionId: input.competitionId,
		competitionName: competition?.name ?? "this competition",
		routeKind: input.routeKind,
		eventId: input.eventId,
	}
}

/**
 * Existing volunteers (volunteer system-role memberships + pending sign-ups)
 * for a competition's volunteer team, flattened for dedup matching. Mirrors the
 * membership join in judge-scheduler/context.ts#loadJudgeRoster but returns the
 * whole roster (not only judges) with the email/name needed to match imports.
 */
// @lat: [[architecture#AI Agents#Organizer file-drop import]]
export async function loadExistingVolunteers(
	competitionTeamId: string | null,
): Promise<ExistingVolunteer[]> {
	if (!competitionTeamId) return []
	const db = getDb()

	// Accepted volunteers are memberships; pending ones are invitations. Dedup
	// must consider both — inviteVolunteerFn checks both before inviting.
	const [memberships, invitations] = await Promise.all([
		db
			.select({
				id: teamMembershipTable.id,
				metadata: teamMembershipTable.metadata,
				firstName: userTable.firstName,
				lastName: userTable.lastName,
				email: userTable.email,
			})
			.from(teamMembershipTable)
			.leftJoin(userTable, eq(teamMembershipTable.userId, userTable.id))
			.where(
				and(
					eq(teamMembershipTable.teamId, competitionTeamId),
					eq(teamMembershipTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamMembershipTable.isSystemRole, true),
				),
			),
		db
			.select({
				id: teamInvitationTable.id,
				email: teamInvitationTable.email,
				metadata: teamInvitationTable.metadata,
			})
			.from(teamInvitationTable)
			.where(
				and(
					eq(teamInvitationTable.teamId, competitionTeamId),
					eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
					eq(teamInvitationTable.isSystemRole, true),
					eq(teamInvitationTable.status, INVITATION_STATUS.PENDING),
					isNull(teamInvitationTable.acceptedAt),
					gt(teamInvitationTable.expiresAt, new Date()),
				),
			),
	])

	// Members first so an accepted-member match wins over a stale invitation.
	const members: ExistingVolunteer[] = memberships.map((m) => {
		const meta = parseVolunteerMetadata(m.metadata)
		const email = m.email ?? meta?.signupEmail ?? null
		const name = formatName(m.firstName, m.lastName) ?? meta?.signupName ?? null
		return {
			membershipId: m.id,
			email,
			name,
			isInvite: false,
		}
	})

	const invited: ExistingVolunteer[] = invitations.map((inv) => {
		const meta = parseVolunteerMetadata(inv.metadata)
		return {
			membershipId: inv.id,
			email: inv.email ?? null,
			name: meta?.signupName ?? null,
			isInvite: true,
		}
	})

	return [...members, ...invited]
}

/**
 * Read the uploaded file for a run from private R2 storage and parse it to a
 * bounded table — server-side only, so PII never reaches the model unparsed.
 */
// @lat: [[architecture#AI Agents#Organizer file-drop import]]
export async function readImportFile(
	importRunId: string,
	scope: FileImportScope,
	userId: string,
): Promise<{
	table: ParsedTable
	truncated: boolean
}> {
	const db = getDb()
	const run = await db.query.agentImportRunsTable.findFirst({
		where: and(
			eq(agentImportRunsTable.id, importRunId),
			eq(agentImportRunsTable.competitionId, scope.competitionId),
			eq(agentImportRunsTable.organizingTeamId, scope.organizingTeamId),
			eq(agentImportRunsTable.routeKind, scope.routeKind),
			eq(agentImportRunsTable.createdByUserId, userId),
			scope.eventId
				? eq(agentImportRunsTable.eventId, scope.eventId)
				: isNull(agentImportRunsTable.eventId),
		),
	})
	if (!run?.r2Key) {
		throw new Error("Import file has not been uploaded yet")
	}
	const object = await env.R2_BUCKET.get(run.r2Key)
	if (!object) {
		throw new Error("Import file not found in storage")
	}
	const bytes = await object.arrayBuffer()
	const parsed = await parseImportFile({
		bytes,
		mimeType: run.mimeType,
		filename: run.originalFilename,
	})
	return boundTableForModel(parsed)
}

// @lat: [[architecture#AI Agents#Organizer file-drop import]]
function parseVolunteerMetadata(
	raw: string | null,
): VolunteerMembershipMetadata | null {
	if (!raw) return null
	try {
		return JSON.parse(raw) as VolunteerMembershipMetadata
	} catch {
		return null
	}
}

// @lat: [[architecture#AI Agents#Organizer file-drop import]]
function formatName(
	firstName: string | null | undefined,
	lastName: string | null | undefined,
): string | null {
	const full = [firstName, lastName].filter(Boolean).join(" ").trim()
	return full || null
}
