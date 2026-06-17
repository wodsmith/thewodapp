/**
 * Server functions backing the organizer file-drop import agent.
 *
 * - `createImportRunFn`: create the durable run row + authorize before upload.
 * - `loadFileImportContextFn`: paywall check for the dock/review surface.
 *
 * The apply/undo functions (the only write path) live alongside these and are
 * added in Phase 6. The model NEVER writes — writes happen here on an explicit
 * organizer confirm.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  AGENT_IMPORT_STATUS,
  type AppliedEntity,
  agentImportRunsTable,
  parseAppliedEntities,
  SYSTEM_ROLES_ENUM,
  teamInvitationTable,
} from "@/db/schema"
import { createAgentImportRunId } from "@/db/schemas/common"
import { logError, logInfo } from "@/lib/logging"
import {
  type ApplyImportResult,
  type ApplyRowResult,
  applyImportInputSchema,
  routeKindSchema,
  undoImportInputSchema,
  type VolunteerProposal,
} from "@/lib/organizer-file-import/schemas"
import {
  type FileImportRunScope,
  loadFileImportScope,
  loadFileImportScopeByRun,
  requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
import { inviteVolunteerFn } from "@/server-fns/volunteer-fns"
import { getSessionFromCookie } from "@/utils/auth"

const createRunSchema = z.object({
  competitionId: z.string().min(1),
  routeKind: routeKindSchema,
  eventId: z.string().min(1).optional(),
})

/**
 * Create an import run for a freshly dropped file. Authorizes the organizer and
 * records the run BEFORE upload, so the upload route + agent can key off its id.
 */
export const createImportRunFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createRunSchema.parse(data))
  .handler(async ({ data }): Promise<{ importRunId: string }> => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new Error("NOT_AUTHORIZED: Not authenticated")
    }

    const scope = await loadFileImportScope(data)
    await requireFileImportTeamAccess({
      teamId: scope.organizingTeamId,
      scope,
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

/**
 * Paywall check for the file-drop dock / review surface. Returns
 * `{ hasAccess: false }` (rather than throwing) when the organizing team lacks
 * the AI_FILE_IMPORT entitlement, so the UI can render an upgrade prompt.
 */
export const loadFileImportContextFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ competitionId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ hasAccess: boolean }> => {
    const scope = await loadFileImportScope({
      competitionId: data.competitionId,
      routeKind: "volunteers",
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

/**
 * Apply confirmed import proposals. THIS is the only write path — it runs on an
 * explicit organizer confirm, never from the model. Re-validates access, applies
 * each volunteer proposal via the existing invite flow, records what it wrote on
 * the run row (for the receipt + Undo), and returns per-row results.
 *
 * MVP scope: volunteer creates (new invites). Duplicates are skipped, rows
 * without an email fail, and event proposals are deferred (skipped with a note)
 * until the event write path lands.
 */
export const applyOrganizerImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyImportInputSchema.parse(data))
  .handler(async ({ data }): Promise<ApplyImportResult> => {
    const scope = await loadFileImportScopeByRun(data.importRunId)
    await requireFileImportTeamAccess({
      teamId: scope.organizingTeamId,
      scope,
    })

    const db = getDb()
    const results: ApplyRowResult[] = []
    const appliedEntities = parseAppliedEntities(scope.run.appliedEntities)
    const alreadyApplied = new Set(appliedEntities.map((e) => e.rowKey))

    for (const proposal of data.volunteerProposals) {
      if (alreadyApplied.has(proposal.rowKey)) {
        results.push(
          skipped(proposal.rowKey, "volunteer_invite", "Already imported"),
        )
        continue
      }
      const outcome = await applyVolunteerProposal(proposal, scope)
      results.push(outcome.result)
      if (outcome.entity) {
        appliedEntities.push(outcome.entity)
        alreadyApplied.add(proposal.rowKey)
      }
    }

    for (const proposal of data.eventProposals) {
      results.push(
        skipped(
          proposal.rowKey,
          "event_create",
          "Event import will be available soon — review only for now.",
        ),
      )
    }

    const appliedCount = results.filter((r) => r.status === "applied").length
    const skippedCount = results.filter((r) => r.status === "skipped").length
    const failedCount = results.filter((r) => r.status === "failed").length

    const session = await getSessionFromCookie()
    await db
      .update(agentImportRunsTable)
      .set({
        status: AGENT_IMPORT_STATUS.APPLIED,
        appliedEntities: JSON.stringify(appliedEntities),
        appliedByUserId: session?.user.id ?? scope.createdByUserId,
        appliedAt: new Date(),
      })
      .where(eq(agentImportRunsTable.id, data.importRunId))

    logInfo({
      message: "[AgentImport] applied",
      attributes: {
        importRunId: data.importRunId,
        appliedCount,
        skippedCount,
        failedCount,
      },
    })

    return { appliedCount, skippedCount, failedCount, results }
  })

/**
 * Reverse a confirmed import: delete the invitations it created (only if still
 * pending — an accepted invite became a real membership the organizer manages
 * elsewhere). Clears the recorded entities and marks the run rejected.
 */
export const undoImportFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => undoImportInputSchema.parse(data))
  .handler(
    async ({
      data,
    }): Promise<{ undoneCount: number; skippedCount: number }> => {
      const scope = await loadFileImportScopeByRun(data.importRunId)
      await requireFileImportTeamAccess({
        teamId: scope.organizingTeamId,
        scope,
      })

      const db = getDb()
      const entities = parseAppliedEntities(scope.run.appliedEntities)
      let undoneCount = 0
      let skippedCount = 0

      for (const entity of entities) {
        if (entity.kind !== "volunteer_invite") {
          skippedCount++
          continue
        }
        const invite = await db.query.teamInvitationTable.findFirst({
          where: eq(teamInvitationTable.id, entity.entityId),
          columns: { id: true, acceptedAt: true },
        })
        if (!invite || invite.acceptedAt) {
          // Already accepted (now a membership) or already gone — leave it.
          skippedCount++
          continue
        }
        await db
          .delete(teamInvitationTable)
          .where(eq(teamInvitationTable.id, entity.entityId))
        undoneCount++
      }

      await db
        .update(agentImportRunsTable)
        .set({
          status: AGENT_IMPORT_STATUS.REJECTED,
          appliedEntities: JSON.stringify([]),
        })
        .where(eq(agentImportRunsTable.id, data.importRunId))

      logInfo({
        message: "[AgentImport] undone",
        attributes: {
          importRunId: data.importRunId,
          undoneCount,
          skippedCount,
        },
      })

      return { undoneCount, skippedCount }
    },
  )

interface VolunteerApplyOutcome {
  result: ApplyRowResult
  entity?: AppliedEntity
}

async function applyVolunteerProposal(
  proposal: VolunteerProposal,
  scope: FileImportRunScope,
): Promise<VolunteerApplyOutcome> {
  if (proposal.action !== "create") {
    return {
      result: skipped(
        proposal.rowKey,
        "volunteer_invite",
        proposal.matchKind === "new"
          ? "Skipped (no action)"
          : "Already a volunteer — skipped",
      ),
    }
  }
  if (!proposal.email) {
    return {
      result: failed(
        proposal.rowKey,
        "volunteer_invite",
        "No email — cannot send an invitation",
      ),
    }
  }
  if (!scope.competitionTeamId) {
    return {
      result: failed(
        proposal.rowKey,
        "volunteer_invite",
        "Competition has no volunteer team",
      ),
    }
  }

  const roleTypes =
    proposal.roleTypes.length > 0
      ? proposal.roleTypes
      : scope.routeKind === "judges"
        ? (["judge"] as const)
        : (["general"] as const)

  try {
    await inviteVolunteerFn({
      data: {
        name: proposal.name ?? undefined,
        email: proposal.email,
        competitionTeamId: scope.competitionTeamId,
        organizingTeamId: scope.organizingTeamId,
        competitionId: scope.competitionId,
        roleTypes: [...roleTypes],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // inviteVolunteerFn throws on an existing invite/membership — treat as skip.
    const isDuplicate = message.toLowerCase().includes("already")
    if (isDuplicate) {
      return {
        result: skipped(
          proposal.rowKey,
          "volunteer_invite",
          "Duplicate — skipped",
        ),
      }
    }
    logError({
      message: "[AgentImport] volunteer invite failed",
      error: err,
      attributes: { rowKey: proposal.rowKey },
    })
    return { result: failed(proposal.rowKey, "volunteer_invite", message) }
  }

  // Capture the created invitation id so Undo can remove it.
  const db = getDb()
  const created = await db.query.teamInvitationTable.findFirst({
    where: and(
      eq(teamInvitationTable.teamId, scope.competitionTeamId),
      eq(teamInvitationTable.email, proposal.email.toLowerCase()),
      eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
      eq(teamInvitationTable.isSystemRole, true),
    ),
    orderBy: desc(teamInvitationTable.createdAt),
    columns: { id: true },
  })

  return {
    result: {
      rowKey: proposal.rowKey,
      status: "applied",
      kind: "volunteer_invite",
      entityId: created?.id ?? null,
      message: `Invited ${proposal.email}`,
    },
    entity: created
      ? {
          kind: "volunteer_invite",
          entityId: created.id,
          rowKey: proposal.rowKey,
        }
      : undefined,
  }
}

function skipped(
  rowKey: string,
  kind: string,
  message: string,
): ApplyRowResult {
  return { rowKey, status: "skipped", kind, entityId: null, message }
}

function failed(rowKey: string, kind: string, message: string): ApplyRowResult {
  return { rowKey, status: "failed", kind, entityId: null, message }
}
