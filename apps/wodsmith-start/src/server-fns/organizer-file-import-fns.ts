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
import { WORKOUT_SCHEME_VALUES } from "@/db/schemas/workouts"
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
  type EventApplyDecision,
  type EventBeforeSnapshot,
  planEventApply,
  planVolunteerApply,
  type VolunteerApplyDecision,
} from "@/lib/organizer-file-import/validate"
import {
  type FileImportRunScope,
  loadFileImportScope,
  loadFileImportScopeByRun,
  requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
import { loadExistingEvents } from "@/server/organizer-file-import/context"
import {
  createWorkoutAndAddToCompetitionFn,
  removeWorkoutFromCompetitionFn,
  saveCompetitionEventFn,
} from "@/server-fns/competition-workouts-fns"
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
 * Scope: volunteer creates, event creates, and event updates. Duplicates are
 * skipped, rows without an email / a valid scheme fail. Each write is recorded
 * on the run for idempotent re-apply and the Undo receipt.
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

    // Decide everything up front (pure), then only do IO for the invites.
    const decisions = planVolunteerApply(data.volunteerProposals, {
      alreadyAppliedRowKeys: alreadyApplied,
      hasCompetitionTeam: !!scope.competitionTeamId,
      defaultRoleTypes:
        scope.routeKind === "judges"
          ? (["judge"] as VolunteerProposal["roleTypes"])
          : (["general"] as VolunteerProposal["roleTypes"]),
    })

    for (const decision of decisions) {
      if (decision.outcome === "skip") {
        results.push(
          skipped(decision.rowKey, "volunteer_invite", decision.reason),
        )
        continue
      }
      if (decision.outcome === "fail") {
        results.push(
          failed(decision.rowKey, "volunteer_invite", decision.reason),
        )
        continue
      }
      const outcome = await executeVolunteerInvite(decision, scope)
      results.push(outcome.result)
      if (outcome.entity) appliedEntities.push(outcome.entity)
    }

    if (data.eventProposals.length > 0) {
      const existingEvents = await loadExistingEvents(scope.competitionId)
      const eventDecisions = planEventApply(data.eventProposals, {
        alreadyAppliedRowKeys: alreadyApplied,
        existingEvents,
        allowedSchemes: WORKOUT_SCHEME_VALUES,
      })
      for (const decision of eventDecisions) {
        if (decision.outcome === "skip") {
          results.push(
            skipped(decision.rowKey, "event_create", decision.reason),
          )
          continue
        }
        if (decision.outcome === "fail") {
          results.push(failed(decision.rowKey, "event_create", decision.reason))
          continue
        }
        const outcome =
          decision.outcome === "update"
            ? await executeEventUpdate(decision, scope)
            : await executeEventCreate(decision, scope)
        results.push(outcome.result)
        if (outcome.entity) appliedEntities.push(outcome.entity)
      }
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
 * Reverse a confirmed import: delete created invitations (only if still
 * pending — an accepted invite became a real membership), remove created
 * events, and restore updated events from their before-snapshot. Clears the
 * recorded entities and marks the run rejected.
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
        if (entity.kind === "volunteer_invite") {
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
          continue
        }
        if (entity.kind === "event_create") {
          try {
            await removeWorkoutFromCompetitionFn({
              data: {
                trackWorkoutId: entity.entityId,
                teamId: scope.organizingTeamId,
              },
            })
            undoneCount++
          } catch (err) {
            logError({
              message: "[AgentImport] undo event delete failed",
              error: err,
              attributes: { trackWorkoutId: entity.entityId },
            })
            skippedCount++
          }
          continue
        }
        if (entity.kind === "event_update") {
          // Restore prior field values from the before-snapshot.
          const before = entity.before as
            | Partial<EventBeforeSnapshot>
            | undefined
          if (before?.workoutId && before.name && before.scheme) {
            try {
              await saveCompetitionEventFn({
                data: {
                  trackWorkoutId: entity.entityId,
                  workoutId: before.workoutId,
                  teamId: scope.organizingTeamId,
                  name: before.name,
                  scheme: before.scheme,
                  description: before.description ?? undefined,
                  scoreType: before.scoreType ?? undefined,
                },
              })
              undoneCount++
            } catch (err) {
              logError({
                message: "[AgentImport] undo event restore failed",
                error: err,
                attributes: { trackWorkoutId: entity.entityId },
              })
              skippedCount++
            }
          } else {
            skippedCount++
          }
          continue
        }
        skippedCount++
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

async function executeVolunteerInvite(
  decision: Extract<VolunteerApplyDecision, { outcome: "invite" }>,
  scope: FileImportRunScope,
): Promise<VolunteerApplyOutcome> {
  // The planner only emits "invite" when a competition team exists; re-narrow
  // for the type system (and as a defensive guard).
  const competitionTeamId = scope.competitionTeamId
  if (!competitionTeamId) {
    return {
      result: failed(
        decision.rowKey,
        "volunteer_invite",
        "Competition has no volunteer team",
      ),
    }
  }

  try {
    await inviteVolunteerFn({
      data: {
        name: decision.name ?? undefined,
        email: decision.email,
        competitionTeamId,
        organizingTeamId: scope.organizingTeamId,
        competitionId: scope.competitionId,
        roleTypes: [...decision.roleTypes],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // inviteVolunteerFn throws on an existing invite/membership — treat as skip.
    const isDuplicate = message.toLowerCase().includes("already")
    if (isDuplicate) {
      return {
        result: skipped(
          decision.rowKey,
          "volunteer_invite",
          "Duplicate — skipped",
        ),
      }
    }
    logError({
      message: "[AgentImport] volunteer invite failed",
      error: err,
      attributes: { rowKey: decision.rowKey },
    })
    return { result: failed(decision.rowKey, "volunteer_invite", message) }
  }

  // Capture the created invitation id so Undo can remove it.
  const db = getDb()
  const created = await db.query.teamInvitationTable.findFirst({
    where: and(
      eq(teamInvitationTable.teamId, competitionTeamId),
      eq(teamInvitationTable.email, decision.email.toLowerCase()),
      eq(teamInvitationTable.roleId, SYSTEM_ROLES_ENUM.VOLUNTEER),
      eq(teamInvitationTable.isSystemRole, true),
    ),
    orderBy: desc(teamInvitationTable.createdAt),
    columns: { id: true },
  })

  return {
    result: {
      rowKey: decision.rowKey,
      status: "applied",
      kind: "volunteer_invite",
      entityId: created?.id ?? null,
      message: `Invited ${decision.email}`,
    },
    entity: created
      ? {
          kind: "volunteer_invite",
          entityId: created.id,
          rowKey: decision.rowKey,
        }
      : undefined,
  }
}

async function executeEventCreate(
  decision: Extract<EventApplyDecision, { outcome: "create" }>,
  scope: FileImportRunScope,
): Promise<VolunteerApplyOutcome> {
  try {
    const { trackWorkoutId } = await createWorkoutAndAddToCompetitionFn({
      data: {
        competitionId: scope.competitionId,
        teamId: scope.organizingTeamId,
        name: decision.name,
        scheme: decision.scheme,
        description: decision.description ?? undefined,
      },
    })
    return {
      result: {
        rowKey: decision.rowKey,
        status: "applied",
        kind: "event_create",
        entityId: trackWorkoutId,
        message: `Created "${decision.name}"`,
      },
      entity: {
        kind: "event_create",
        entityId: trackWorkoutId,
        rowKey: decision.rowKey,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError({
      message: "[AgentImport] event create failed",
      error: err,
      attributes: { rowKey: decision.rowKey },
    })
    return { result: failed(decision.rowKey, "event_create", message) }
  }
}

async function executeEventUpdate(
  decision: Extract<EventApplyDecision, { outcome: "update" }>,
  scope: FileImportRunScope,
): Promise<VolunteerApplyOutcome> {
  try {
    await saveCompetitionEventFn({
      data: {
        trackWorkoutId: decision.trackWorkoutId,
        workoutId: decision.workoutId,
        teamId: scope.organizingTeamId,
        name: decision.name,
        scheme: decision.scheme,
        description: decision.description ?? undefined,
        scoreType: decision.scoreType ?? undefined,
      },
    })
    return {
      result: {
        rowKey: decision.rowKey,
        status: "applied",
        kind: "event_update",
        entityId: decision.trackWorkoutId,
        message: `Updated "${decision.name}"`,
      },
      entity: {
        kind: "event_update",
        entityId: decision.trackWorkoutId,
        rowKey: decision.rowKey,
        // Spread into a plain object so it satisfies AppliedEntity.before.
        before: { ...decision.before },
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logError({
      message: "[AgentImport] event update failed",
      error: err,
      attributes: { rowKey: decision.rowKey },
    })
    return { result: failed(decision.rowKey, "event_update", message) }
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
