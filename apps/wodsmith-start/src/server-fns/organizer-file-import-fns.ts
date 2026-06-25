/**
 * Server functions backing the organizer file-drop import agent.
 *
 * - `createImportRunFn`: create the durable import-run row (authorize before a
 *   byte is uploaded) and return the id the upload + agent name key off.
 * - `loadFileImportContextFn`: GET probe so the dock/drawer can render a
 *   paywall when the team lacks AI_FILE_IMPORT, instead of throwing.
 * - `applyOrganizerImportFn`: the ONLY place writes happen — triggered by an
 *   explicit organizer confirm, never the model. Re-validates, invites via the
 *   existing inviteUserToTeam helper, records created entities for Undo.
 * - `undoImportFn`: reverse a confirmed import (delete created invitations).
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
	AGENT_IMPORT_STATUS,
	agentImportRunsTable,
	type AppliedEntity,
	competitionsTable,
	teamInvitationTable,
} from "@/db/schema"
import { createAgentImportRunId } from "@/db/schemas/common"
import { logInfo } from "@/lib/logging"
import {
	routeKindSchema,
	volunteerProposalSchema,
} from "@/lib/organizer-file-import/schemas"
import {
	isApplicableVolunteer,
	isBlockedVolunteer,
} from "@/lib/organizer-file-import/validate"
import {
	loadFileImportScope,
	loadFileImportScopeByRun,
	requireFileImportRequestAccess,
	requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
import { readImportFile } from "@/server/organizer-file-import/context"
import { inviteUserToTeam } from "@/server/team-members"
import { getSessionFromCookie } from "@/utils/auth"
import { sendVolunteerDirectInviteEmail } from "@/utils/email"

const EMAIL_IN_TEXT_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi

// ============================================================================
// createImportRunFn
// ============================================================================

const createRunSchema = z.object({
	competitionId: z.string().min(1),
	routeKind: routeKindSchema,
	eventId: z.string().min(1).optional(),
})

export const createImportRunFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => createRunSchema.parse(data))
	.handler(async ({ data }): Promise<{ importRunId: string }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}
		const scope = await requireFileImportRequestAccess({
			competitionId: data.competitionId,
			routeKind: data.routeKind,
			eventId: data.eventId ?? null,
		})

		const db = getDb()
		const id = createAgentImportRunId()
		await db.insert(agentImportRunsTable).values({
			id,
			competitionId: scope.competitionId,
			organizingTeamId: scope.organizingTeamId,
			createdByUserId: session.user.id,
			routeKind: data.routeKind,
			eventId: data.eventId ?? null,
			status: AGENT_IMPORT_STATUS.CREATED,
		})

		logInfo({
			message: "[AgentImport] run created",
			attributes: {
				importRunId: id,
				competitionId: scope.competitionId,
				routeKind: data.routeKind,
			},
		})
		return { importRunId: id }
	})

// ============================================================================
// loadFileImportContextFn — paywall probe
// ============================================================================

const loadContextSchema = z.object({
	competitionId: z.string().min(1),
	routeKind: routeKindSchema,
	eventId: z.string().min(1).optional(),
})

export const loadFileImportContextFn = createServerFn({ method: "GET" })
	.inputValidator((data: unknown) => loadContextSchema.parse(data))
	.handler(async ({ data }): Promise<{ hasAccess: boolean }> => {
		const scope = await loadFileImportScope({
			competitionId: data.competitionId,
			routeKind: data.routeKind,
			eventId: data.eventId ?? null,
		})
		try {
			await requireFileImportTeamAccess({
				teamId: scope.organizingTeamId,
				scope,
			})
		} catch (err) {
			if (err instanceof Error && err.message.includes("AI File Import")) {
				return { hasAccess: false }
			}
			throw err
		}
		return { hasAccess: true }
	})

// ============================================================================
// applyOrganizerImportFn — the only write path
// ============================================================================

const applyImportSchema = z.object({
	importRunId: z.string().min(1),
	volunteerProposals: z.array(volunteerProposalSchema).default([]),
})

export interface ApplyImportRowResult {
	rowKey: string
	proposalId: string
	status: "applied" | "skipped" | "failed"
	entityId?: string
	reason?: string
}

export interface ApplyImportResult {
	applied: number
	skipped: number
	failed: number
	results: ApplyImportRowResult[]
}

export const applyOrganizerImportFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => applyImportSchema.parse(data))
	.handler(async ({ data }): Promise<ApplyImportResult> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}
		const scope = await loadFileImportScopeByRun(data.importRunId)
		if (scope.createdByUserId !== session.user.id) {
			throw new Error("NOT_AUTHORIZED: Import run belongs to another organizer")
		}
		await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })

		if (!scope.competitionTeamId) {
			throw new Error("This competition has no volunteer team to import into")
		}
		const competitionTeamId = scope.competitionTeamId

		const db = getDb()
		const run = await db.query.agentImportRunsTable.findFirst({
			where: eq(agentImportRunsTable.id, data.importRunId),
		})
		if (!run) {
			throw new Error("Import run not found")
		}
		const appliedEntities: AppliedEntity[] = [...(run?.appliedEntities ?? [])]
		// Idempotency: a (importRunId, rowKey) already applied is a no-op.
		const appliedRowKeys = new Set(appliedEntities.map((e) => e.rowKey))
		const seenInviteEmails = new Set<string>()

		const [competition] = await db
			.select({ name: competitionsTable.name })
			.from(competitionsTable)
			.where(eq(competitionsTable.id, scope.competitionId))
		const competitionName = competition?.name ?? "a competition"
		const { table } = await readImportFile(
			data.importRunId,
			scope,
			session.user.id,
		)
		const uploadedEmails = collectEmailsFromRows(table.rows)

		const results: ApplyImportRowResult[] = []
		let applied = 0
		let skipped = 0
		let failed = 0

		for (const proposal of data.volunteerProposals) {
			if (appliedRowKeys.has(proposal.rowKey)) {
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "skipped",
					reason: "already applied",
				})
				skipped++
				continue
			}

			// Re-validate deterministically — the model is never trusted to gate.
			if (!isApplicableVolunteer(proposal)) {
				const reason = isBlockedVolunteer(proposal)
					? "missing email"
					: proposal.matchKind !== "new"
						? "duplicate"
						: "not applicable"
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "skipped",
					reason,
				})
				skipped++
				continue
			}

			const email = proposal.email
			if (!email) {
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "skipped",
					reason: "missing email",
				})
				skipped++
				continue
			}
			const normalizedEmail = email.trim().toLowerCase()
			if (!uploadedEmails.has(normalizedEmail)) {
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "skipped",
					reason: "email not found in uploaded file",
				})
				skipped++
				continue
			}
			if (seenInviteEmails.has(normalizedEmail)) {
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "skipped",
					reason: "duplicate email in import",
				})
				skipped++
				continue
			}
			seenInviteEmails.add(normalizedEmail)

			try {
				const metadata: Record<string, unknown> = {
					volunteerRoleTypes:
						proposal.roleTypes.length > 0 ? proposal.roleTypes : ["general"],
					inviteSource: "direct",
					inviteEmail: email,
				}
				if (proposal.name) metadata.inviteName = proposal.name
				if (proposal.credentials) metadata.credentials = proposal.credentials
				if (proposal.shirtSize) metadata.shirtSize = proposal.shirtSize
				if (proposal.availability) metadata.availability = proposal.availability

				const res = await inviteUserToTeam({
					teamId: competitionTeamId,
					email,
					roleId: "volunteer",
					isSystemRole: true,
					metadata: JSON.stringify(metadata),
					skipPermissionCheck: true,
					forceInvitation: true,
					emailOverrideFn: async ({ email: to, token, inviterName }) => {
						await sendVolunteerDirectInviteEmail({
							email: to,
							invitationToken: token,
							competitionName,
							inviterName,
						})
					},
				})

				const entityId = res.invitationId ?? res.userId ?? ""
				appliedEntities.push({
					kind: "volunteer_invite",
					entityId,
					rowKey: proposal.rowKey,
				})
				appliedRowKeys.add(proposal.rowKey)
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "applied",
					entityId,
				})
				applied++
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				results.push({
					rowKey: proposal.rowKey,
					proposalId: proposal.proposalId,
					status: "failed",
					reason: message,
				})
				failed++
			}
		}

		const nextStatus =
			failed > 0
				? AGENT_IMPORT_STATUS.ERROR
				: applied > 0
					? AGENT_IMPORT_STATUS.APPLIED
					: AGENT_IMPORT_STATUS.PROPOSALS_READY

		await db
			.update(agentImportRunsTable)
			.set({
				appliedEntities,
				status: nextStatus,
				appliedAt: applied > 0 ? new Date() : run.appliedAt,
				appliedByUserId: applied > 0 ? session.user.id : run.appliedByUserId,
				errorMessage:
					failed > 0
						? `${failed} row${failed === 1 ? "" : "s"} failed during apply`
						: null,
			})
			.where(
				and(
					eq(agentImportRunsTable.id, data.importRunId),
					eq(agentImportRunsTable.createdByUserId, session.user.id),
				),
			)

		logInfo({
			message: "[AgentImport] proposals applied",
			attributes: {
				importRunId: data.importRunId,
				applied,
				skipped,
				failed,
			},
		})
		return { applied, skipped, failed, results }
	})

// ============================================================================
// undoImportFn — reverse a confirmed import (creates only)
// ============================================================================

const undoImportSchema = z.object({
	importRunId: z.string().min(1),
})

export const undoImportFn = createServerFn({ method: "POST" })
	.inputValidator((data: unknown) => undoImportSchema.parse(data))
	.handler(async ({ data }): Promise<{ removed: number }> => {
		const session = await getSessionFromCookie()
		if (!session) {
			throw new Error("NOT_AUTHORIZED: Not authenticated")
		}
		const scope = await loadFileImportScopeByRun(data.importRunId)
		if (scope.createdByUserId !== session.user.id) {
			throw new Error("NOT_AUTHORIZED: Import run belongs to another organizer")
		}
		await requireFileImportTeamAccess({ teamId: scope.organizingTeamId, scope })

		const db = getDb()
		const run = await db.query.agentImportRunsTable.findFirst({
			where: eq(agentImportRunsTable.id, data.importRunId),
		})
		const entities = run?.appliedEntities ?? []

		let removed = 0
		for (const entity of entities) {
			// Undo deletes invitations we created. It cannot un-send the email
			// that was already dispatched on confirm (the confirm copy says so).
			if (
				entity.kind === "volunteer_invite" &&
				entity.entityId.startsWith("tinv_")
			) {
				await db
					.delete(teamInvitationTable)
					.where(eq(teamInvitationTable.id, entity.entityId))
				removed++
			}
		}

		await db
			.update(agentImportRunsTable)
			.set({
				appliedEntities: [],
				status: AGENT_IMPORT_STATUS.REJECTED,
			})
			.where(
				and(
					eq(agentImportRunsTable.id, data.importRunId),
					eq(agentImportRunsTable.createdByUserId, session.user.id),
				),
			)

		logInfo({
			message: "[AgentImport] import undone",
			attributes: { importRunId: data.importRunId, removed },
		})
		return { removed }
	})

function collectEmailsFromRows(rows: Record<string, string>[]): Set<string> {
	const emails = new Set<string>()
	for (const row of rows) {
		for (const value of Object.values(row)) {
			for (const match of value.matchAll(EMAIL_IN_TEXT_PATTERN)) {
				emails.add(match[0].toLowerCase())
			}
		}
	}
	return emails
}
