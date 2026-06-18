/**
 * Route Documentation Server Functions (TanStack Start)
 *
 * Powers the in-app documentation drawer (contextual help mapped to
 * TanStack Router route IDs) and the /admin/docs lightweight CMS.
 *
 * - getRouteDocsForRouteFn: published docs for the current match chain
 *   (any signed-in user — drawer only mounts on organizer pages)
 * - Admin CRUD + version restore: site admins only (requireAdmin)
 *
 * This file uses top-level imports for server-only modules.
 */

import { createServerFn } from "@tanstack/react-start"
import { and, desc, eq, inArray, like, max } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import {
  createRouteDocId,
  ROUTE_DOC_TYPES,
  type RouteDoc,
  type RouteDocRoute,
  type RouteDocVersion,
  routeDocRoutesTable,
  routeDocsTable,
  routeDocVersionsTable,
} from "@/db/schema"
import { getSessionFromCookie, requireAdmin } from "@/utils/auth"
import { AppError } from "@/utils/errors"
import {
  ORGANIZER_ROUTE_PREFIX,
  orderDocsForMatches,
  type RouteDocForViewer,
} from "@/utils/route-docs"

// ============================================================================
// Input Schemas
// ============================================================================

const getDocsForRouteInputSchema = z.object({
  // Route ids from useMatches(), ordered root → leaf
  routeIds: z.array(z.string().min(1).max(255)).max(25),
})

const docFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1024).optional(),
  type: z.enum(ROUTE_DOC_TYPES),
  content: z.string().max(100_000).optional(),
  videoUrl: z.string().max(2048).url("Invalid video URL").optional(),
  linkUrl: z.string().max(2048).url("Invalid link URL").optional(),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10_000).default(1),
  routeIds: z
    .array(z.string().min(1).max(255))
    .max(100, "Too many routes selected")
    // Dedupe so repeated ids can't trip the (docId, routeId) unique index
    .transform((ids) => Array.from(new Set(ids))),
})

const createDocInputSchema = docFieldsSchema

const updateDocInputSchema = docFieldsSchema.extend({
  docId: z.string().min(1),
})

const docIdInputSchema = z.object({
  docId: z.string().min(1),
})

const routeIdInputSchema = z.object({
  routeId: z.string().min(1).max(255),
})

const restoreVersionInputSchema = z.object({
  docId: z.string().min(1),
  versionId: z.string().min(1),
})

const reorderDocsInputSchema = z.object({
  // Docs in their new display order, each with the sortOrder to persist.
  docs: z
    .array(
      z.object({
        docId: z.string().min(1),
        sortOrder: z.number().int().min(0).max(10_000),
      }),
    )
    .min(1)
    .max(500),
})

/**
 * Type-specific content requirements: each doc type must carry the field
 * it renders from. Throws UNPROCESSABLE_CONTENT for invalid combinations.
 */
function validateDocContent(input: {
  type: (typeof ROUTE_DOC_TYPES)[number]
  content?: string
  videoUrl?: string
  linkUrl?: string
}) {
  if (input.type === "markdown" && !input.content?.trim()) {
    throw new AppError("UNPROCESSABLE_CONTENT", "Markdown docs require content")
  }
  if (input.type === "video" && !input.videoUrl?.trim()) {
    throw new AppError(
      "UNPROCESSABLE_CONTENT",
      "Video docs require a video URL",
    )
  }
  if (input.type === "link" && !input.linkUrl?.trim()) {
    throw new AppError("UNPROCESSABLE_CONTENT", "Link docs require a link URL")
  }
}

// ============================================================================
// Viewer
// ============================================================================

/**
 * Get published docs for the current page's match chain.
 *
 * Accepts the route ids of all current matches (root → leaf) so docs
 * attached to layout routes surface on every child page. Results are
 * deduped and ordered leaf-most route first, then sortOrder.
 */
export const getRouteDocsForRouteFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => getDocsForRouteInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ docs: RouteDocForViewer[] }> => {
    const session = await getSessionFromCookie()
    if (!session) {
      throw new AppError("NOT_AUTHORIZED", "Not authenticated")
    }

    if (data.routeIds.length === 0) {
      return { docs: [] }
    }

    const db = getDb()
    const rows = await db
      .select({
        doc: routeDocsTable,
        routeId: routeDocRoutesTable.routeId,
      })
      .from(routeDocRoutesTable)
      .innerJoin(
        routeDocsTable,
        eq(routeDocRoutesTable.docId, routeDocsTable.id),
      )
      .where(
        and(
          inArray(routeDocRoutesTable.routeId, data.routeIds),
          eq(routeDocsTable.isPublished, true),
        ),
      )

    // A doc may match several routes in the chain — collapse to one entry
    // carrying all matched route ids (used for depth ordering).
    const byId = new Map<string, RouteDocForViewer>()
    for (const row of rows) {
      const existing = byId.get(row.doc.id)
      if (existing) {
        existing.routeIds.push(row.routeId)
        continue
      }
      byId.set(row.doc.id, {
        id: row.doc.id,
        title: row.doc.title,
        description: row.doc.description,
        type: row.doc.type,
        content: row.doc.content,
        videoUrl: row.doc.videoUrl,
        linkUrl: row.doc.linkUrl,
        sortOrder: row.doc.sortOrder,
        routeIds: [row.routeId],
      })
    }

    return {
      docs: orderDocsForMatches(Array.from(byId.values()), data.routeIds),
    }
  })

/**
 * List every published organizer doc with its route mappings, for the
 * drawer's Browse view.
 *
 * Unlike the contextual viewer (which is scoped to the current match
 * chain), this returns the whole published organizer doc set so the user
 * can browse to help for adjacent pages without leaving the panel. Docs
 * carry full content so the Browse → article transition needs no second
 * fetch. Any signed-in user may read it; the drawer only mounts on
 * organizer pages.
 */
export const getOrganizerDocsIndexFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<{ docs: RouteDocForViewer[] }> => {
  const session = await getSessionFromCookie()
  if (!session) {
    throw new AppError("NOT_AUTHORIZED", "Not authenticated")
  }

  const db = getDb()
  const rows = await db
    .select({
      doc: routeDocsTable,
      routeId: routeDocRoutesTable.routeId,
    })
    .from(routeDocRoutesTable)
    .innerJoin(routeDocsTable, eq(routeDocRoutesTable.docId, routeDocsTable.id))
    .where(
      and(
        like(routeDocRoutesTable.routeId, `${ORGANIZER_ROUTE_PREFIX}%`),
        eq(routeDocsTable.isPublished, true),
      ),
    )

  // Collapse the join to one entry per doc carrying all its organizer
  // route ids (the Browse view groups docs by route).
  const byId = new Map<string, RouteDocForViewer>()
  for (const row of rows) {
    const existing = byId.get(row.doc.id)
    if (existing) {
      existing.routeIds.push(row.routeId)
      continue
    }
    byId.set(row.doc.id, {
      id: row.doc.id,
      title: row.doc.title,
      description: row.doc.description,
      type: row.doc.type,
      content: row.doc.content,
      videoUrl: row.doc.videoUrl,
      linkUrl: row.doc.linkUrl,
      sortOrder: row.doc.sortOrder,
      routeIds: [row.routeId],
    })
  }

  return { docs: Array.from(byId.values()) }
})

// ============================================================================
// Admin CRUD
// ============================================================================

export interface AdminRouteDoc extends RouteDoc {
  routes: RouteDocRoute[]
}

export interface AdminRouteDocDetail extends AdminRouteDoc {
  versions: RouteDocVersion[]
}

/**
 * List all docs with their route mappings (admin only).
 */
export const getAllRouteDocsAdminFn = createServerFn({
  method: "GET",
}).handler(async (): Promise<{ docs: AdminRouteDoc[] }> => {
  await requireAdmin()

  const db = getDb()
  const docs = await db.query.routeDocsTable.findMany({
    with: { routes: true },
    orderBy: [desc(routeDocsTable.updatedAt)],
  })

  return { docs }
})

/**
 * Next sort order slot for a route group (admin only).
 *
 * Returns max(sortOrder) + 1 among docs already mapped to the route, so a
 * newly created doc lands at the end of that route's group. Returns 1 when
 * the route has no docs yet.
 */
export const getNextSortOrderForRouteFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => routeIdInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ sortOrder: number }> => {
    await requireAdmin()

    const db = getDb()
    const [row] = await db
      .select({ maxSortOrder: max(routeDocsTable.sortOrder) })
      .from(routeDocsTable)
      .innerJoin(
        routeDocRoutesTable,
        eq(routeDocRoutesTable.docId, routeDocsTable.id),
      )
      .where(eq(routeDocRoutesTable.routeId, data.routeId))

    // PlanetScale can return MAX() as a string — coerce before adding.
    const current = Number(row?.maxSortOrder ?? 0)
    return { sortOrder: current + 1 }
  })

/**
 * Get a single doc with routes and version history (admin only).
 */
export const getRouteDocAdminFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => docIdInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ doc: AdminRouteDocDetail }> => {
    await requireAdmin()

    const db = getDb()
    const doc = await db.query.routeDocsTable.findFirst({
      where: eq(routeDocsTable.id, data.docId),
      with: {
        routes: true,
        versions: {
          orderBy: [desc(routeDocVersionsTable.version)],
        },
      },
    })

    if (!doc) {
      throw new AppError("NOT_FOUND", "Documentation entry not found")
    }

    return { doc }
  })

/**
 * Create a doc and its route mappings (admin only).
 */
export const createRouteDocFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createDocInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ docId: string }> => {
    await requireAdmin()
    validateDocContent(data)

    const db = getDb()
    const docId = createRouteDocId()

    await db.transaction(async (tx) => {
      await tx.insert(routeDocsTable).values({
        id: docId,
        title: data.title,
        description: data.description || null,
        type: data.type,
        content: data.content || null,
        videoUrl: data.videoUrl || null,
        linkUrl: data.linkUrl || null,
        isPublished: data.isPublished,
        sortOrder: data.sortOrder,
      })

      if (data.routeIds.length > 0) {
        await tx.insert(routeDocRoutesTable).values(
          data.routeIds.map((routeId) => ({
            docId,
            routeId,
          })),
        )
      }
    })

    return { docId }
  })

/**
 * Whether an update changes content fields worth snapshotting.
 * Publish toggles and route remapping don't create versions.
 */
function hasContentChanges(
  existing: RouteDoc,
  input: z.infer<typeof docFieldsSchema>,
): boolean {
  return (
    existing.title !== input.title ||
    (existing.description ?? null) !== (input.description || null) ||
    existing.type !== input.type ||
    (existing.content ?? null) !== (input.content || null) ||
    (existing.videoUrl ?? null) !== (input.videoUrl || null) ||
    (existing.linkUrl ?? null) !== (input.linkUrl || null)
  )
}

/**
 * Update a doc, snapshotting the previous content as a version when
 * content fields change. Route mappings are replaced wholesale (admin only).
 */
export const updateRouteDocFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => updateDocInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()
    validateDocContent(data)

    const db = getDb()
    await db.transaction(async (tx) => {
      // Lock the doc row so concurrent edits serialize — the snapshot and
      // its version number are computed under the lock, preventing races
      // on the (docId, version) unique index.
      const [existing] = await tx
        .select()
        .from(routeDocsTable)
        .where(eq(routeDocsTable.id, data.docId))
        .for("update")

      if (!existing) {
        throw new AppError("NOT_FOUND", "Documentation entry not found")
      }

      if (hasContentChanges(existing, data)) {
        const [latest] = await tx
          .select({ version: routeDocVersionsTable.version })
          .from(routeDocVersionsTable)
          .where(eq(routeDocVersionsTable.docId, data.docId))
          .orderBy(desc(routeDocVersionsTable.version))
          .limit(1)

        await tx.insert(routeDocVersionsTable).values({
          docId: existing.id,
          version: (latest?.version ?? 0) + 1,
          title: existing.title,
          description: existing.description,
          type: existing.type,
          content: existing.content,
          videoUrl: existing.videoUrl,
          linkUrl: existing.linkUrl,
        })
      }

      await tx
        .update(routeDocsTable)
        .set({
          title: data.title,
          description: data.description || null,
          type: data.type,
          content: data.content || null,
          videoUrl: data.videoUrl || null,
          linkUrl: data.linkUrl || null,
          isPublished: data.isPublished,
          sortOrder: data.sortOrder,
        })
        .where(eq(routeDocsTable.id, data.docId))

      // Replace route mappings wholesale — simpler than diffing and the
      // row counts are tiny.
      await tx
        .delete(routeDocRoutesTable)
        .where(eq(routeDocRoutesTable.docId, data.docId))
      if (data.routeIds.length > 0) {
        await tx.insert(routeDocRoutesTable).values(
          data.routeIds.map((routeId) => ({
            docId: data.docId,
            routeId,
          })),
        )
      }
    })

    return { success: true }
  })

/**
 * Restore a previous version's content onto the doc, snapshotting the
 * current state first so the restore itself is reversible (admin only).
 */
export const restoreRouteDocVersionFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => restoreVersionInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const db = getDb()
    await db.transaction(async (tx) => {
      // Lock the doc row so the restore snapshot's version number can't
      // race a concurrent edit on the (docId, version) unique index.
      const [existing] = await tx
        .select()
        .from(routeDocsTable)
        .where(eq(routeDocsTable.id, data.docId))
        .for("update")

      if (!existing) {
        throw new AppError("NOT_FOUND", "Documentation entry not found")
      }

      const [version] = await tx
        .select()
        .from(routeDocVersionsTable)
        .where(
          and(
            eq(routeDocVersionsTable.docId, data.docId),
            eq(routeDocVersionsTable.id, data.versionId),
          ),
        )
        .limit(1)
      if (!version) {
        throw new AppError("NOT_FOUND", "Version not found")
      }

      const [latest] = await tx
        .select({ version: routeDocVersionsTable.version })
        .from(routeDocVersionsTable)
        .where(eq(routeDocVersionsTable.docId, data.docId))
        .orderBy(desc(routeDocVersionsTable.version))
        .limit(1)

      await tx.insert(routeDocVersionsTable).values({
        docId: existing.id,
        version: (latest?.version ?? 0) + 1,
        title: existing.title,
        description: existing.description,
        type: existing.type,
        content: existing.content,
        videoUrl: existing.videoUrl,
        linkUrl: existing.linkUrl,
      })

      await tx
        .update(routeDocsTable)
        .set({
          title: version.title,
          description: version.description,
          type: version.type,
          content: version.content,
          videoUrl: version.videoUrl,
          linkUrl: version.linkUrl,
        })
        .where(eq(routeDocsTable.id, data.docId))
    })

    return { success: true }
  })

/**
 * Persist a new sort order for a set of docs (admin only).
 *
 * sortOrder is a content-independent field, so reordering never snapshots
 * a version. Used by the admin list page to drag-reorder docs within a
 * route group; the drawer reads docs ordered by sortOrder.
 */
export const reorderRouteDocsFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => reorderDocsInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const db = getDb()
    await db.transaction(async (tx) => {
      for (const { docId, sortOrder } of data.docs) {
        await tx
          .update(routeDocsTable)
          .set({ sortOrder })
          .where(eq(routeDocsTable.id, docId))
      }
    })

    return { success: true }
  })

/**
 * Delete a doc with its mappings and version history (admin only).
 */
export const deleteRouteDocFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => docIdInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin()

    const db = getDb()
    await db.transaction(async (tx) => {
      await tx
        .delete(routeDocRoutesTable)
        .where(eq(routeDocRoutesTable.docId, data.docId))
      await tx
        .delete(routeDocVersionsTable)
        .where(eq(routeDocVersionsTable.docId, data.docId))
      await tx.delete(routeDocsTable).where(eq(routeDocsTable.id, data.docId))
    })

    return { success: true }
  })
