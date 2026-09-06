import { datetime, int, json, mysqlTable, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

/** Server-owned authorization/provenance; never written through browser state sync. */
export const workoutImportSessionsTable = mysqlTable("workout_import_sessions", {
  ...commonColumns,
  id: varchar({length: 255}).primaryKey(),
  userId: varchar({length: 255}).notNull(),
  teamId: varchar({length: 255}).notNull(),
  trackId: varchar({length: 255}),
  revision: int().notNull().default(0),
  proposal: json().$type<unknown>(),
  expiresAt: datetime().notNull(),
  savedWorkoutId: varchar({length: 255}),
})

/** One receipt per import makes simultaneous or differently keyed retries safe. */
export const workoutImportReceiptsTable = mysqlTable("workout_import_receipts", {
  ...commonColumns,
  importId: varchar({length: 255}).primaryKey(),
  userId: varchar({length: 255}).notNull(),
  teamId: varchar({length: 255}).notNull(),
  revision: int().notNull(),
  idempotencyKey: varchar({length: 255}).notNull(),
  contentHash: varchar({length: 64}).notNull(),
  workoutId: varchar({length: 255}).notNull(),
  trackWorkoutId: varchar({length: 255}),
})
