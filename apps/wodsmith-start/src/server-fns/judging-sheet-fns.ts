/**
 * Judging Sheet Server Functions for TanStack Start
 * Handles CRUD operations for competition event judging sheets
 *
 * OBSERVABILITY:
 * - All judging sheet operations are logged with entity IDs
 * - Permission denials are tracked
 * - File uploads/deletes are logged for audit trails
 */

import { createServerFn } from "@tanstack/react-start"
import { and, asc, eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  competitionGroupsTable,
  competitionsTable,
} from "@/db/schemas/competitions"
import { eventJudgingSheetsTable } from "@/db/schemas/judging-sheets"
import { createEventJudgingSheetId } from "@/db/schemas/common"
import {
  programmingTracksTable,
  trackWorkoutsTable,
} from "@/db/schemas/programming"
import { TEAM_PERMISSIONS } from "@/db/schemas/teams"
import { ROLES_ENUM } from "@/db/schemas/users"
import { getEvlog } from "@/lib/evlog"
import {
  addRequestContextAttribute,
  logEntityCreated,
  logEntityDeleted,
  logEntityUpdated,
  logInfo,
  logWarning,
  updateRequestContext,
} from "@/lib/logging"
import { getSessionFromCookie } from "@/utils/auth"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if user has permission on a team (or is a site admin)
 */
async function hasTeamPermission(
  teamId: string,
  permission: string,
): Promise<boolean> {
  const session = await getSessionFromCookie()
  if (!session?.userId) return false

  // Site admins have all permissions
  if (session.user?.role === ROLES_ENUM.ADMIN) return true

  const team = session.teams?.find((t) => t.id === teamId)
  if (!team) return false

  return team.permissions.includes(permission)
}

/**
 * Require team permission or throw error
 */
async function requireTeamPermission(
  teamId: string,
  permission: string,
): Promise<void> {
  const hasPermission = await hasTeamPermission(teamId, permission)
  if (!hasPermission) {
    logWarning({
      message: "[JudgingSheet] Permission denied",
      attributes: {
        teamId,
        requiredPermission: permission,
      },
    })
    throw new Error(`Missing required permission: ${permission}`)
  }
}

// ============================================================================
// Input Schemas
// ============================================================================

const getEventJudgingSheetsInputSchema = z.object({
  trackWorkoutId: z.string().min(1, "Track workout ID is required"),
})

const createJudgingSheetInputSchema = z.object({
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

const updateJudgingSheetInputSchema = z.object({
  judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
  title: z.string().min(1, "Title is required").max(255),
})

const deleteJudgingSheetInputSchema = z.object({
  judgingSheetId: z.string().min(1, "Judging sheet ID is required"),
})

const reorderJudgingSheetsInputSchema = z.object({
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
 * Get all judging sheets for a competition event
 * Public access (no auth required) - athletes need to download these
 */
export const getEventJudgingSheetsFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getEventJudgingSheetsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    const sheets = await db
      .select({
        id: eventJudgingSheetsTable.id,
        title: eventJudgingSheetsTable.title,
        url: eventJudgingSheetsTable.url,
        originalFilename: eventJudgingSheetsTable.originalFilename,
        fileSize: eventJudgingSheetsTable.fileSize,
        mimeType: eventJudgingSheetsTable.mimeType,
        sortOrder: eventJudgingSheetsTable.sortOrder,
        createdAt: eventJudgingSheetsTable.createdAt,
      })
      .from(eventJudgingSheetsTable)
      .where(eq(eventJudgingSheetsTable.trackWorkoutId, data.trackWorkoutId))
      .orderBy(asc(eventJudgingSheetsTable.sortOrder))

    return { sheets }
  })

/**
 * Create a new judging sheet
 * Requires MANAGE_COMPETITIONS permission
 */
export const createJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[JudgingSheet] Create denied - not authenticated",
        attributes: {
          competitionId: data.competitionId,
          trackWorkoutId: data.trackWorkoutId,
        },
      })
      throw new Error("Not authenticated")
    }

    // Update request context
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute(
      "competitionId",
      data.competitionId ?? data.groupId ?? "",
    )
    addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)
    getEvlog()?.set({ action: "create_judging_sheet", judgingSheet: { competitionId: data.competitionId, trackWorkoutId: data.trackWorkoutId } })

    if (!data.competitionId && !data.groupId) {
      throw new Error("Either competitionId or groupId is required")
    }

    let entityId: string

    if (data.groupId) {
      // Series template flow: validate via group
      const [group] = await db
        .select()
        .from(competitionGroupsTable)
        .where(eq(competitionGroupsTable.id, data.groupId))
        .limit(1)

      if (!group) {
        throw new Error("Series group not found")
      }

      await requireTeamPermission(
        group.organizingTeamId,
        TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
      )

      // Verify the track workout belongs to this group's template track
      const trackWorkoutResult = await db
        .select({
          trackWorkoutId: trackWorkoutsTable.id,
          ownerTeamId: programmingTracksTable.ownerTeamId,
        })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (
        trackWorkoutResult.length === 0 ||
        trackWorkoutResult[0].ownerTeamId !== group.organizingTeamId
      ) {
        throw new Error(
          "Event not found or does not belong to this series group",
        )
      }

      entityId = data.groupId
    } else {
      // Competition flow: existing logic
      const competition = await db.query.competitionsTable.findFirst({
        where: eq(competitionsTable.id, data.competitionId!),
      })

      if (!competition) {
        throw new Error("Competition not found")
      }

      await requireTeamPermission(
        competition.organizingTeamId,
        TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
      )

      // Verify the track workout belongs to this competition using a join
      const trackWorkoutResult = await db
        .select({
          trackWorkoutId: trackWorkoutsTable.id,
          competitionId: programmingTracksTable.competitionId,
        })
        .from(trackWorkoutsTable)
        .innerJoin(
          programmingTracksTable,
          eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
        )
        .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
        .limit(1)

      if (
        trackWorkoutResult.length === 0 ||
        trackWorkoutResult[0].competitionId !== data.competitionId
      ) {
        throw new Error(
          "Event not found or does not belong to this competition",
        )
      }

      entityId = data.competitionId!
    }

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

    addRequestContextAttribute("judgingSheetId", sheet.id)
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
      },
    })

    return { sheet }
  })

/**
 * Update a judging sheet title
 * Requires MANAGE_COMPETITIONS permission
 */
export const updateJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[JudgingSheet] Update denied - not authenticated",
        attributes: { judgingSheetId: data.judgingSheetId },
      })
      throw new Error("Not authenticated")
    }

    // Update request context
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("judgingSheetId", data.judgingSheetId)
    getEvlog()?.set({ action: "update_judging_sheet", judgingSheet: { id: data.judgingSheetId } })

    // Get the judging sheet and resolve the owning team via the track
    const sheetResult = await db
      .select({
        id: eventJudgingSheetsTable.id,
        competitionId: eventJudgingSheetsTable.competitionId,
        trackWorkoutId: eventJudgingSheetsTable.trackWorkoutId,
        ownerTeamId: programmingTracksTable.ownerTeamId,
      })
      .from(eventJudgingSheetsTable)
      .innerJoin(
        trackWorkoutsTable,
        eq(eventJudgingSheetsTable.trackWorkoutId, trackWorkoutsTable.id),
      )
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))
      .limit(1)

    if (sheetResult.length === 0) {
      throw new Error("Judging sheet not found")
    }

    const sheet = sheetResult[0]

    if (!sheet.ownerTeamId) {
      throw new Error("Event has no owning team")
    }

    // Check permission on the owning team
    await requireTeamPermission(
      sheet.ownerTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

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
        competitionId: sheet.competitionId,
        newTitle: data.title,
      },
    })

    return { sheet: updated }
  })

/**
 * Delete a judging sheet
 * Requires MANAGE_COMPETITIONS permission
 * Note: This does not delete the file from R2, which would need to be handled separately
 */
export const deleteJudgingSheetFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteJudgingSheetInputSchema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[JudgingSheet] Delete denied - not authenticated",
        attributes: { judgingSheetId: data.judgingSheetId },
      })
      throw new Error("Not authenticated")
    }

    // Update request context
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("judgingSheetId", data.judgingSheetId)
    getEvlog()?.set({ action: "delete_judging_sheet", judgingSheet: { id: data.judgingSheetId } })

    // Get the judging sheet and resolve the owning team via the track
    const sheetResult = await db
      .select({
        id: eventJudgingSheetsTable.id,
        competitionId: eventJudgingSheetsTable.competitionId,
        trackWorkoutId: eventJudgingSheetsTable.trackWorkoutId,
        title: eventJudgingSheetsTable.title,
        r2Key: eventJudgingSheetsTable.r2Key,
        ownerTeamId: programmingTracksTable.ownerTeamId,
      })
      .from(eventJudgingSheetsTable)
      .innerJoin(
        trackWorkoutsTable,
        eq(eventJudgingSheetsTable.trackWorkoutId, trackWorkoutsTable.id),
      )
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))
      .limit(1)

    if (sheetResult.length === 0) {
      throw new Error("Judging sheet not found")
    }

    const sheet = sheetResult[0]

    if (!sheet.ownerTeamId) {
      throw new Error("Event has no owning team")
    }

    // Check permission on the owning team
    await requireTeamPermission(
      sheet.ownerTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

    // Delete the judging sheet record
    await db
      .delete(eventJudgingSheetsTable)
      .where(eq(eventJudgingSheetsTable.id, data.judgingSheetId))

    logEntityDeleted({
      entity: "judgingSheet",
      id: data.judgingSheetId,
      attributes: {
        competitionId: sheet.competitionId,
        trackWorkoutId: sheet.trackWorkoutId,
        title: sheet.title,
        r2Key: sheet.r2Key,
      },
    })

    return { success: true }
  })

/**
 * Reorder judging sheets for an event
 * Requires MANAGE_COMPETITIONS permission
 */
export const reorderJudgingSheetsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    reorderJudgingSheetsInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const db = getDb()

    // Verify authentication
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[JudgingSheet] Reorder denied - not authenticated",
        attributes: { trackWorkoutId: data.trackWorkoutId },
      })
      throw new Error("Not authenticated")
    }

    // Update request context
    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("trackWorkoutId", data.trackWorkoutId)
    getEvlog()?.set({ action: "reorder_judging_sheets", judgingSheet: { trackWorkoutId: data.trackWorkoutId } })

    // Get the track workout to find the owning team via the programming track
    const trackWorkoutResult = await db
      .select({
        trackWorkoutId: trackWorkoutsTable.id,
        competitionId: programmingTracksTable.competitionId,
        ownerTeamId: programmingTracksTable.ownerTeamId,
      })
      .from(trackWorkoutsTable)
      .innerJoin(
        programmingTracksTable,
        eq(trackWorkoutsTable.trackId, programmingTracksTable.id),
      )
      .where(eq(trackWorkoutsTable.id, data.trackWorkoutId))
      .limit(1)

    if (trackWorkoutResult.length === 0) {
      throw new Error("Event not found")
    }

    const competition = trackWorkoutResult[0]

    if (!competition.ownerTeamId) {
      throw new Error("Event has no owning team")
    }

    // Check permission on the owning team
    await requireTeamPermission(
      competition.ownerTeamId,
      TEAM_PERMISSIONS.MANAGE_COMPETITIONS,
    )

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
      message: "[JudgingSheet] Judging sheets reordered",
      attributes: {
        trackWorkoutId: data.trackWorkoutId,
        competitionId: competition.competitionId,
        updateCount: data.updates.length,
      },
    })

    return { success: true }
  })
