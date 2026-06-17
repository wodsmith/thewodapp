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
import { z } from "zod"
import { getDb } from "@/db"
import { AGENT_IMPORT_STATUS, agentImportRunsTable } from "@/db/schema"
import { createAgentImportRunId } from "@/db/schemas/common"
import { logInfo } from "@/lib/logging"
import { routeKindSchema } from "@/lib/organizer-file-import/schemas"
import {
  loadFileImportScope,
  requireFileImportTeamAccess,
} from "@/server/organizer-file-import/access"
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
