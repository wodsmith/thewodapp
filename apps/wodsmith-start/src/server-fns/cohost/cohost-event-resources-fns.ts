/**
 * Cohost Event Resources Server Functions
 * Mirrors event-resources-fns.ts CRUD operations with cohost auth.
 * Uses requireCohostPermission instead of requireTeamPermission.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { createEventResourceId } from "@/db/schemas/common"
import { eventResourcesTable } from "@/db/schemas/event-resources"
import { getEvlog } from "@/lib/evlog"
import { requireCohostPermission } from "@/utils/cohost-auth"

// ============================================================================
// Input Schemas
// ============================================================================

const cohostBaseSchema = z.object({
  competitionTeamId: z.string().startsWith("team_", "Invalid team ID"),
})

const createEventResourceInputSchema = cohostBaseSchema.extend({
  eventId: z.string().min(1, "Event ID is required"),
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(5000).optional(),
  url: z
    .string()
    .url("Must be a valid URL")
    .max(2048)
    .optional()
    .or(z.literal("")),
  sortOrder: z.number().int().min(1).optional(),
})

const updateEventResourceInputSchema = cohostBaseSchema.extend({
  resourceId: z.string().min(1, "Resource ID is required"),
  title: z.string().min(1, "Title is required").max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  url: z
    .string()
    .url("Must be a valid URL")
    .max(2048)
    .nullable()
    .optional()
    .or(z.literal("")),
  sortOrder: z.number().int().min(1).optional(),
})

const deleteEventResourceInputSchema = cohostBaseSchema.extend({
  resourceId: z.string().min(1, "Resource ID is required"),
})

const reorderEventResourcesInputSchema = cohostBaseSchema.extend({
  eventId: z.string().min(1, "Event ID is required"),
  updates: z
    .array(
      z.object({
        resourceId: z.string().min(1),
        sortOrder: z.number().int().min(1),
      }),
    )
    .min(1, "At least one update required"),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the next available sort order for an event's resources
 */
async function getNextResourceSortOrder(eventId: string): Promise<number> {
  const db = getDb()

  const resources = await db
    .select({ sortOrder: eventResourcesTable.sortOrder })
    .from(eventResourcesTable)
    .where(eq(eventResourcesTable.eventId, eventId))

  if (resources.length === 0) {
    return 1
  }

  const maxOrder = Math.max(...resources.map((r) => r.sortOrder))
  return maxOrder + 1
}

// ============================================================================
// Server Functions
// ============================================================================

/**
 * Get all resources for an event (cohost)
 * Uses cohost auth instead of team permission
 */
export const cohostGetEventResourcesFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    cohostBaseSchema
      .extend({ eventId: z.string().min(1, "Event ID is required") })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")

    const db = getDb()

    const resources = await db
      .select()
      .from(eventResourcesTable)
      .where(eq(eventResourcesTable.eventId, data.eventId))
      .orderBy(eventResourcesTable.sortOrder)

    return { resources }
  })

/**
 * Create a new event resource (cohost)
 */
export const cohostCreateEventResourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createEventResourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_create_event_resource",
      eventResource: { eventId: data.eventId },
    })

    const db = getDb()

    // Get next sort order if not provided
    const sortOrder =
      data.sortOrder ?? (await getNextResourceSortOrder(data.eventId))

    // Normalize empty string URL to null
    const url = data.url === "" ? null : data.url

    // Generate ID first, insert, then select back
    const id = createEventResourceId()
    await db.insert(eventResourcesTable).values({
      id,
      eventId: data.eventId,
      title: data.title,
      description: data.description ?? null,
      url: url ?? null,
      sortOrder,
    })

    const resource = await db.query.eventResourcesTable.findFirst({
      where: eq(eventResourcesTable.id, id),
    })

    if (!resource) {
      throw new Error("Failed to create resource")
    }

    return { resource }
  })

/**
 * Update an existing event resource (cohost)
 */
export const cohostUpdateEventResourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateEventResourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_update_event_resource",
      eventResource: { id: data.resourceId },
    })

    const db = getDb()

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.title !== undefined) {
      updateData.title = data.title
    }
    if (data.description !== undefined) {
      updateData.description = data.description
    }
    if (data.url !== undefined) {
      // Normalize empty string to null
      updateData.url = data.url === "" ? null : data.url
    }
    if (data.sortOrder !== undefined) {
      updateData.sortOrder = data.sortOrder
    }

    await db
      .update(eventResourcesTable)
      .set(updateData)
      .where(eq(eventResourcesTable.id, data.resourceId))

    // Fetch and return the updated resource
    const [updatedResource] = await db
      .select()
      .from(eventResourcesTable)
      .where(eq(eventResourcesTable.id, data.resourceId))
      .limit(1)

    return { resource: updatedResource }
  })

/**
 * Delete an event resource (cohost)
 */
export const cohostDeleteEventResourceFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => deleteEventResourceInputSchema.parse(data))
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_delete_event_resource",
      eventResource: { id: data.resourceId },
    })

    const db = getDb()

    await db
      .delete(eventResourcesTable)
      .where(eq(eventResourcesTable.id, data.resourceId))

    return { success: true }
  })

/**
 * Reorder event resources (cohost)
 * Updates sort order for multiple resources in a single operation
 */
export const cohostReorderEventResourcesFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    reorderEventResourcesInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    await requireCohostPermission(data.competitionTeamId, "events")
    getEvlog()?.set({
      action: "cohost_reorder_event_resources",
      eventResource: { eventId: data.eventId },
    })

    const db = getDb()

    // Validate all resources belong to this event
    const resourceIds = data.updates.map((u) => u.resourceId)
    const existingResources = await db
      .select({ id: eventResourcesTable.id })
      .from(eventResourcesTable)
      .where(
        and(
          eq(eventResourcesTable.eventId, data.eventId),
          inArray(eventResourcesTable.id, resourceIds),
        ),
      )

    const existingIds = new Set(existingResources.map((r) => r.id))

    for (const update of data.updates) {
      if (!existingIds.has(update.resourceId)) {
        throw new Error(
          `Resource ${update.resourceId} does not belong to this event`,
        )
      }
    }

    // Perform updates
    let updateCount = 0
    for (const update of data.updates) {
      await db
        .update(eventResourcesTable)
        .set({ sortOrder: update.sortOrder, updatedAt: new Date() })
        .where(eq(eventResourcesTable.id, update.resourceId))
      updateCount++
    }

    return { updateCount }
  })
