import "server-only"

import { and, eq } from "drizzle-orm"
import { FEATURES } from "@/config/features"
import { getDb } from "@/db"
import {
	type AgentImportRouteKind,
	agentImportRunsTable,
	competitionsTable,
	programmingTracksTable,
	ROLES_ENUM,
	SYSTEM_ROLES_ENUM,
	teamMembershipTable,
	teamRoleTable,
	trackWorkoutsTable,
	userTable,
} from "@/db/schema"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { hasFeature } from "@/server/entitlements"

export interface FileImportScope {
	competitionId: string
	organizingTeamId: string
	competitionTeamId: string | null
	routeKind: AgentImportRouteKind
	eventId: string | null
}

export interface FileImportRunScope extends FileImportScope {
	importRunId: string
	createdByUserId: string
	r2Key: string | null
	originalFilename: string | null
	mimeType: string | null
	status: string
}

/**
 * Resolve the competition (+ optional event) a drop targets and prove the
 * event, when present, belongs to the competition. Mirrors
 * judge-scheduler/access.ts#loadAiSchedulingScope.
 */
export async function loadFileImportScope(input: {
	competitionId: string
	routeKind: AgentImportRouteKind
	eventId?: string | null
}): Promise<FileImportScope> {
	const db = getDb()

	const [competition] = await db
		.select({
			id: competitionsTable.id,
			organizingTeamId: competitionsTable.organizingTeamId,
			competitionTeamId: competitionsTable.competitionTeamId,
		})
		.from(competitionsTable)
		.where(eq(competitionsTable.id, input.competitionId))

	if (!competition) {
		throw new Error("Competition not found")
	}

	const eventId = input.eventId ?? null
	if (eventId) {
		const [row] = await db
			.select({ trackWorkoutId: trackWorkoutsTable.id })
			.from(trackWorkoutsTable)
			.innerJoin(
				programmingTracksTable,
				eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
			)
			.where(
				and(
					eq(trackWorkoutsTable.id, eventId),
					eq(programmingTracksTable.competitionId, input.competitionId),
				),
			)
		if (!row) {
			throw new Error("Event does not belong to this competition")
		}
	}

	return {
		competitionId: competition.id,
		organizingTeamId: competition.organizingTeamId,
		competitionTeamId: competition.competitionTeamId,
		routeKind: input.routeKind,
		eventId,
	}
}

/** Resolve scope from a persisted import-run row (upload route + apply/undo). */
export async function loadFileImportScopeByRun(
	importRunId: string,
): Promise<FileImportRunScope> {
	const db = getDb()
	const run = await db.query.agentImportRunsTable.findFirst({
		where: eq(agentImportRunsTable.id, importRunId),
	})
	if (!run) {
		throw new Error("Import run not found")
	}
	const scope = await loadFileImportScope({
		competitionId: run.competitionId,
		routeKind: run.routeKind,
		eventId: run.eventId,
	})
	return {
		...scope,
		importRunId: run.id,
		createdByUserId: run.createdByUserId,
		r2Key: run.r2Key,
		originalFilename: run.originalFilename,
		mimeType: run.mimeType,
		status: run.status,
	}
}

/**
 * Authorize the current request for the organizer team that owns the
 * competition: ownership + MANAGE_COMPETITIONS + the AI_FILE_IMPORT entitlement.
 */
export async function requireFileImportTeamAccess({
	teamId,
	scope,
}: {
	teamId: string
	scope: FileImportScope
}): Promise<void> {
	if (scope.organizingTeamId !== teamId) {
		throw new Error("Competition does not belong to this team")
	}

	const { requireTeamPermission } = await import("@/utils/team-auth")
	await requireTeamPermission(teamId, TEAM_PERMISSIONS.MANAGE_COMPETITIONS)

	const entitled = await hasFeature(teamId, FEATURES.AI_FILE_IMPORT)
	if (!entitled) {
		throw new Error("Your plan does not include AI File Import")
	}
}

/** Request-context entrypoint: resolve scope then require team access. */
export async function requireFileImportRequestAccess(input: {
	competitionId: string
	routeKind: AgentImportRouteKind
	eventId?: string | null
}): Promise<FileImportScope> {
	const scope = await loadFileImportScope(input)
	await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })
	return scope
}

/**
 * Durable Object agent authorization.
 *
 * Agent callables run outside TanStack Start's request AsyncLocalStorage, so
 * they re-check permissions directly from persistent data using the user id
 * baked into the agent name (already validated by the Worker WS route).
 * Mirrors judge-scheduler/access.ts#requireAiSchedulingAgentAccess.
 */
export async function requireFileImportAgentAccess(
	input: {
		competitionId: string
		routeKind: AgentImportRouteKind
		eventId?: string | null
	},
	userId: string,
): Promise<FileImportScope> {
	const scope = await loadFileImportScope(input)
	const db = getDb()
	const user = await db.query.userTable.findFirst({
		where: eq(userTable.id, userId),
		columns: { id: true, role: true },
	})
	if (!user) {
		throw new Error("NOT_AUTHORIZED: Not authenticated")
	}

	if (user.role !== ROLES_ENUM.ADMIN) {
		const hasPermission = await userHasManageCompetitionsPermission({
			userId,
			teamId: scope.organizingTeamId,
		})
		if (!hasPermission) {
			throw new Error(
				"FORBIDDEN: You don't have the required permission in this team",
			)
		}
	}

	const entitled = await hasFeature(
		scope.organizingTeamId,
		FEATURES.AI_FILE_IMPORT,
	)
	if (!entitled) {
		throw new Error("Your plan does not include AI File Import")
	}

	return scope
}

async function userHasManageCompetitionsPermission({
	userId,
	teamId,
}: {
	userId: string
	teamId: string
}): Promise<boolean> {
	const db = getDb()
	const membership = await db.query.teamMembershipTable.findFirst({
		where: and(
			eq(teamMembershipTable.userId, userId),
			eq(teamMembershipTable.teamId, teamId),
			eq(teamMembershipTable.isActive, true),
		),
		columns: {
			roleId: true,
			isSystemRole: true,
		},
	})

	if (!membership) return false

	if (membership.isSystemRole) {
		return (
			membership.roleId === SYSTEM_ROLES_ENUM.OWNER ||
			membership.roleId === SYSTEM_ROLES_ENUM.ADMIN
		)
	}

	const role = await db.query.teamRoleTable.findFirst({
		where: and(
			eq(teamRoleTable.id, membership.roleId),
			eq(teamRoleTable.teamId, teamId),
		),
		columns: { permissions: true },
	})

	return (
		role?.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS) ?? false
	)
}
