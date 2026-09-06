import { datetime, index, int, json, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

// @lat: [[crossfit-import#CrossFit Daily Import#Publication]]
export const externalWorkoutImportsTable = mysqlTable("external_workout_imports", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  provider: varchar({ length: 32 }).notNull(),
  trackId: varchar({ length: 255 }).notNull(),
  sourceDate: varchar({ length: 10 }).notNull(),
  sourceUrl: varchar({ length: 255 }).notNull(),
  sourceId: varchar({ length: 64 }),
  sourceModified: varchar({ length: 64 }),
  sourceHash: varchar({ length: 64 }),
  sourceMarkdown: text(),
  normalized: json().$type<unknown>(),
  parserVersion: varchar({ length: 32 }),
  model: varchar({ length: 128 }),
  workflowId: varchar({ length: 128 }).notNull(),
  status: varchar({ length: 32 }).$type<"pending" | "needs_review" | "failed" | "published">().notNull(),
  kind: varchar({ length: 16 }).$type<"rest" | "workout">(),
  error: text(),
  publishedAt: datetime(),
}, (t) => [
  uniqueIndex("external_import_source_uq").on(t.provider, t.trackId, t.sourceDate),
  index("external_import_status_idx").on(t.status, t.sourceDate),
])

export const externalWorkoutImportItemsTable = mysqlTable("external_workout_import_items", {
  id: varchar({ length: 64 }).primaryKey(),
  importId: varchar({ length: 64 }).notNull(),
  componentIndex: int().notNull(),
  workoutId: varchar({ length: 255 }).notNull(),
  trackWorkoutId: varchar({ length: 255 }).notNull(),
}, (t) => [
  uniqueIndex("external_import_component_uq").on(t.importId, t.componentIndex),
  uniqueIndex("external_import_track_workout_uq").on(t.trackWorkoutId),
])
