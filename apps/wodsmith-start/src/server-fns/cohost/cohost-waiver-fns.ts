/**
 * Cohost Waiver Server Functions
 * Mirrors organizer waiver functions for cohost access.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import type { Waiver } from "@/db/schemas/waivers"
import {
  createWaiverId,
  waiverSignaturesTable,
  waiversTable,
} from "@/db/schemas/waivers"
import {
  requireCohostCompetitionOwnership,
  requireCohostPermission,
} from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const getCompetitionWaiversInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().min(1, "Competition ID is required"),
})

const createWaiverInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
  title: z.string().min(1, "Title is required").max(255, "Title is too long"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content is too long"),
  required: z.boolean().default(true),
})

const updateWaiverInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
  title: z
    .string()
    .min(1, "Title is required")
    .max(255, "Title is too long")
    .optional(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(50000, "Content is too long")
    .optional(),
  required: z.boolean().optional(),
})

const deleteWaiverInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  waiverId: z.string().startsWith("waiv_", "Invalid waiver ID"),
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
})

const reorderWaiversInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().startsWith("comp_", "Invalid competition ID"),
  waivers: z
    .array(
      z.object({
        id: z.string().startsWith("waiv_", "Invalid waiver ID"),
        position: z.number().int().min(0),
      }),
    )
    .min(1, "At least one waiver is required"),
})

const getCompetitionWaiverSignaturesInputSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
  competitionId: z.string().min(1),
})

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all waivers for a competition (cohost view), ordered by position
 */
export const cohostGetCompetitionWaiversFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    getCompetitionWaiversInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<{ waivers: Waiver[] }> => {
    await requireCohostPermission(data.competitionTeamId, "waivers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    const waivers = await db.query.waiversTable.findMany({
      where: eq(waiversTable.competitionId, data.competitionId),
      orderBy: (table, { asc }) => [asc(table.position)],
    })

    return { waivers }
  })

/**
 * Get all waiver signatures for a competition (cohost view)
 */
export const cohostGetCompetitionWaiverSignaturesFn = createServerFn({
  method: "GET",
})
  .inputValidator((data: unknown) =>
    getCompetitionWaiverSignaturesInputSchema.parse(data),
  )
  .handler(
    async ({
      data,
    }): Promise<{
      signatures: Array<{
        id: string
        waiverId: string
        userId: string
        signedAt: Date
      }>
    }> => {
      await requireCohostPermission(data.competitionTeamId, "waivers")
      await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

      const db = getDb()

      const waivers = await db.query.waiversTable.findMany({
        where: eq(waiversTable.competitionId, data.competitionId),
      })

      if (waivers.length === 0) {
        return { signatures: [] }
      }

      const waiverIds = waivers.map((w) => w.id)

      const signatures = await db.query.waiverSignaturesTable.findMany({
        columns: {
          id: true,
          waiverId: true,
          userId: true,
          signedAt: true,
        },
        where: inArray(waiverSignaturesTable.waiverId, waiverIds),
      })

      return { signatures }
    },
  )

/**
 * Create a new waiver for a competition (cohost)
 */
export const cohostCreateWaiverFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createWaiverInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true; waiver: Waiver }> => {
    await requireCohostPermission(data.competitionTeamId, "waivers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Get current max position
    const existingWaivers = await db.query.waiversTable.findMany({
      where: eq(waiversTable.competitionId, data.competitionId),
      orderBy: (table, { desc }) => [desc(table.position)],
    })

    const maxPosition =
      existingWaivers.length > 0 ? (existingWaivers[0]?.position ?? -1) : -1

    const id = createWaiverId()
    await db.insert(waiversTable).values({
      id,
      competitionId: data.competitionId,
      title: data.title,
      content: data.content,
      required: data.required,
      position: maxPosition + 1,
    })

    const waiver = await db.query.waiversTable.findFirst({
      where: eq(waiversTable.id, id),
    })

    if (!waiver) {
      throw new Error("Failed to create waiver")
    }

    return { success: true, waiver }
  })

/**
 * Update an existing waiver (cohost)
 */
export const cohostUpdateWaiverFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateWaiverInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true; waiver: Waiver }> => {
    await requireCohostPermission(data.competitionTeamId, "waivers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    // Validate waiver belongs to the specified competition
    const existingWaiver = await db.query.waiversTable.findFirst({
      where: and(
        eq(waiversTable.id, data.waiverId),
        eq(waiversTable.competitionId, data.competitionId),
      ),
    })

    if (!existingWaiver) {
      throw new Error("Waiver not found or does not belong to this competition")
    }

    const updateData: Partial<typeof waiversTable.$inferInsert> = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) updateData.title = data.title
    if (data.content !== undefined) updateData.content = data.content
    if (data.required !== undefined) updateData.required = data.required

    await db
      .update(waiversTable)
      .set(updateData)
      .where(
        and(
          eq(waiversTable.id, data.waiverId),
          eq(waiversTable.competitionId, data.competitionId),
        ),
      )

    const waiver = await db.query.waiversTable.findFirst({
      where: and(
        eq(waiversTable.id, data.waiverId),
        eq(waiversTable.competitionId, data.competitionId),
      ),
    })

    if (!waiver) {
      throw new Error("Failed to update waiver")
    }

    return { success: true, waiver }
  })

/**
 * Delete a waiver (cohost)
 */
export const cohostDeleteWaiverFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteWaiverInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    await requireCohostPermission(data.competitionTeamId, "waivers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    await db
      .delete(waiversTable)
      .where(
        and(
          eq(waiversTable.id, data.waiverId),
          eq(waiversTable.competitionId, data.competitionId),
        ),
      )

    return { success: true }
  })

/**
 * Reorder waivers (cohost)
 */
export const cohostReorderWaiversFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reorderWaiversInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    await requireCohostPermission(data.competitionTeamId, "waivers")
    await requireCohostCompetitionOwnership(data.competitionTeamId, data.competitionId)

    const db = getDb()

    for (const waiver of data.waivers) {
      await db
        .update(waiversTable)
        .set({ position: waiver.position, updatedAt: new Date() })
        .where(
          and(
            eq(waiversTable.id, waiver.id),
            eq(waiversTable.competitionId, data.competitionId),
          ),
        )
    }

    return { success: true }
  })
