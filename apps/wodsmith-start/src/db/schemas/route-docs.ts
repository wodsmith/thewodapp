import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createRouteDocId,
  createRouteDocRouteId,
  createRouteDocVersionId,
} from "./common"

/**
 * Content types supported by route documentation entries.
 *
 * - markdown: article content stored inline (rendered in the docs drawer)
 * - video: hosted video (R2 upload) or platform URL (YouTube/Vimeo)
 * - link: external article (e.g. docs.wodsmith.com page)
 */
export const ROUTE_DOC_TYPES = ["markdown", "video", "link"] as const
export type RouteDocType = (typeof ROUTE_DOC_TYPES)[number]

/**
 * Route Docs table
 *
 * Lightweight CMS entries that power the in-app documentation drawer.
 * Each doc is contextual help (article, video, or external link) that
 * surfaces on specific app routes via the route_doc_routes mapping table.
 *
 * Content is flexible per type:
 * - markdown docs store their body in `content`
 * - video docs store an R2 public URL or platform URL in `videoUrl`
 * - link docs store the destination in `linkUrl`
 */
export const routeDocsTable = mysqlTable(
  "route_docs",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createRouteDocId())
      .notNull(),
    title: varchar({ length: 255 }).notNull(),
    // Short summary shown in the drawer list and admin table
    description: varchar({ length: 1024 }),
    type: mysqlEnum("type", ROUTE_DOC_TYPES).notNull().default("markdown"),
    // Markdown body (markdown type only)
    content: text(),
    // R2 public URL or YouTube/Vimeo URL (video type only)
    videoUrl: varchar({ length: 2048 }),
    // External article URL (link type only)
    linkUrl: varchar({ length: 2048 }),
    // Only published docs are visible in the drawer
    isPublished: boolean().default(false).notNull(),
    // Display order within a route (lower first)
    sortOrder: int().notNull().default(1),
  },
  (table) => [index("route_docs_published_idx").on(table.isPublished)],
)

/**
 * Route Doc Routes table
 *
 * Maps docs to TanStack Router route IDs (e.g.
 * `/compete/organizer/$competitionId/schedule`). Route IDs are stable
 * static patterns — dynamic segments stay as `$param` — so a single
 * mapping covers every concrete URL for that page. A doc may be mapped
 * to multiple routes, and docs mapped to layout routes apply to all
 * child pages.
 */
export const routeDocRoutesTable = mysqlTable(
  "route_doc_routes",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createRouteDocRouteId())
      .notNull(),
    docId: varchar({ length: 255 }).notNull(),
    // TanStack Router route id (matches useMatches() routeId at runtime)
    routeId: varchar({ length: 255 }).notNull(),
  },
  (table) => [
    index("route_doc_routes_route_idx").on(table.routeId),
    uniqueIndex("route_doc_routes_doc_route_unique").on(
      table.docId,
      table.routeId,
    ),
  ],
)

/**
 * Route Doc Versions table
 *
 * Snapshot history for docs — every content-changing save records the
 * previous state so admins can review and restore earlier versions
 * (git-style version control without external storage).
 */
export const routeDocVersionsTable = mysqlTable(
  "route_doc_versions",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createRouteDocVersionId())
      .notNull(),
    docId: varchar({ length: 255 }).notNull(),
    version: int().notNull(),
    title: varchar({ length: 255 }).notNull(),
    description: varchar({ length: 1024 }),
    type: mysqlEnum("type", ROUTE_DOC_TYPES).notNull(),
    content: text(),
    videoUrl: varchar({ length: 2048 }),
    linkUrl: varchar({ length: 2048 }),
  },
  (table) => [
    index("route_doc_versions_doc_idx").on(table.docId),
    uniqueIndex("route_doc_versions_doc_version_unique").on(
      table.docId,
      table.version,
    ),
  ],
)

// Relations
export const routeDocsRelations = relations(routeDocsTable, ({ many }) => ({
  routes: many(routeDocRoutesTable),
  versions: many(routeDocVersionsTable),
}))

export const routeDocRoutesRelations = relations(
  routeDocRoutesTable,
  ({ one }) => ({
    doc: one(routeDocsTable, {
      fields: [routeDocRoutesTable.docId],
      references: [routeDocsTable.id],
    }),
  }),
)

export const routeDocVersionsRelations = relations(
  routeDocVersionsTable,
  ({ one }) => ({
    doc: one(routeDocsTable, {
      fields: [routeDocVersionsTable.docId],
      references: [routeDocsTable.id],
    }),
  }),
)

// Type exports
export type RouteDoc = InferSelectModel<typeof routeDocsTable>
export type NewRouteDoc = typeof routeDocsTable.$inferInsert
export type RouteDocRoute = InferSelectModel<typeof routeDocRoutesTable>
export type RouteDocVersion = InferSelectModel<typeof routeDocVersionsTable>
