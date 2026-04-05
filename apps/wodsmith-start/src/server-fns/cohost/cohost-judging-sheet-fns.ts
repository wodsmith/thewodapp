/**
 * Cohost Judging Sheet Server Functions
 * Mirrors judging-sheet-fns.ts CRUD operations with cohost auth.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"
import { createEventJudgingSheetId } from "@/db/schemas/common"
import { getEvlog } from "@/lib/evlog"
import {
  logEntityCreated,
  logEntityDeleted,
  logEntityUpdated,
  logInfo,
} from "@/lib/logging"
import { getSessionFromCookie } from "@/utils/auth"
import { requireCohostCompetitionOwnership, requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const createJudgingSheetInputSchema = cohostBaseSchema.extend({
  competitionId: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  url: z.string().min(1, "URL is required"),
  r2Key: z.string().min(1, "R2 key is required"),
  originalFilename: z.string().min(1, "Original filename is required"),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1, "MIME type is required"),
})

const updateJudgingSheetInputSchema = cohostBaseSchema.extend({
  judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
  title: z.string().min(1, "Title is required").max(255),
})

const deleteJudgingSheetInputSchema = cohostBaseSchema.extend({
  judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
})

const reorderJudgingSheetsInputSchema = cohostBaseSchema.extend({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
  updates: z
    .array(
      z.object({
        judgingSheetId: z.string().min(1),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, "At least one update required"),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Create a new judging sheet (cohost)
 */
export const cohostCreateJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    if (data.competitionId) {
      await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)
    }
    getEvlog()?.set({
      action: "cohost_create_judging_sheet",
      judgingSheet: {
        competitionId: data.competitionId,
        trackWorkoutId: data.trackWorkoutId,
      },
    })

    const session = await getSessionFromCookie()
    if (!session?.userId) {
      throw new Error("Not authenticated")
    }

    if (!data.competitionId && !data.groupId) {
      throw new Error("Either competitionId or groupId is required")
    }

    const entityId = data.competitionId ?? data.groupId!
    const db = getDb()

    // Get the next sort order
    const existingSheets = await db
      .select({ sortOrder: eventJudgingSheetsTable.sortOrder })
      .from(eventJudgingSheetsTable)
      .where(eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId))

    const nextSortOrder =
      existingSheets.length > 0
        ? Math.max(...existingSheets.map((s) => s.sortOrder)) + 1
        : 0

    // Create the judging sheet
    const id = createEventJudgingSheetId()
    await db.insert(eventJudgingSheetsTable).values({
      id,
      competitionId: entityId,
      trackWorkoutId: data.trackWorkoutId,
      title: data.title,
      url: data.url,
      r2Key: data.r2Key,
      originalFilename: data.originalFilename,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: session.userId,
      sortOrder: nextSortOrder,
    })

    const sheet = await db.query.eventJudgingSheetsTable.findFirst({
      where: eq(eventJudgingSheetsTable.id, id),
    })

    if (!sheet) {
      throw new Error("Failed to create judging sheet")
    }

    logEntityCreated({
      entity: "judgingSheet",
      id: sheet.id,
      parentEntity: data.groupId ? "seriesGroup" : "competition",
      parentId: entityId,
      attributes: {
        trackWorkoutId: data.trackWorkoutId,
        title: data.title,
        originalFilename: data.originalFilename,
        fileSize: data.fileSize,
        uploadedBy: session.userId,
        createdByCohost: true,
      },
    })

    return { sheet }
  })

/**
 * Update a judging sheet title (cohost)
 */
export const cohostUpdateJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_update_judging_sheet",
      judgingSheet: { id: data.judgingSheetId },
    })

    const db = getDb()

    // Update the title
    await db
      .update(eventJudgingSheetsTable)
      .set({
        title: data.title,
        updatedAt: new Date(),
      })
      .where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))

    const updated = await db.query.eventJudgingSheetsTable.findFirst({
      where: eq(eventJudgingSheetsTable.id, data.judgingSheetId),
    })

    if (!updated) {
      throw new Error("Failed to retrieve updated judging sheet")
    }

    logEntityUpdated({
      entity: "judgingSheet",
      id: data.judgingSheetId,
      fields: ["title"],
      attributes: {
        newTitle: data.title,
        updatedByCohost: true,
      },
    })

    return { sheet: updated }
  })

/**
 * Delete a judging sheet (cohost)
 * Note: This does not delete the file from R2, which would need to be handled separately
 */
export const cohostDeleteJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_delete_judging_sheet",
      judgingSheet: { id: data.judgingSheetId },
    })

    const db = getDb()

    await db
      .delete(eventJudgingSheetsTable)
      .where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))

    logEntityDeleted({
      entity: "judgingSheet",
      id: data.judgingSheetId,
      attributes: { deletedByCohost: true },
    })

    return { success: true }
  })

/**
 * Reorder judging sheets for an event (cohost)
 */
export const cohostReorderJudgingSheetsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    reorderJudgingSheetsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_reorder_judging_sheets",
      judgingSheet: { trackWorkoutId: data.trackWorkoutId },
    })

    const db = getDb()

    // Update sort orders in a transaction
    await db.transaction(async (tx) => {
      await Promise.all(
        data.updates.map((update) =>
          tx
            .update(eventJudgingSheetsTable)
            .set({
              sortOrder: update.sortOrder,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(eventJudgingSheetsTable.id, update.judgingSheetId),
                eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId),
              ),
            ),
        ),
      )
    })

    logInfo({
      message: "[Cohost JudgingSheet] Judging sheets reordered",
      attributes: {
        trackWorkoutId: data.trackWorkoutId,
        updateCount: data.updates.length,
      },
    })

    return { success: true }
  })
