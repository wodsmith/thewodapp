import { datetime, index, json, mysqlTable, varchar } from "drizzle-orm/mysql-core"

/** Committed in the same transaction as the owned mutation. */
export const trainingMutationReceiptsTable = mysqlTable(
  "training_mutation_receipts",
  {
    id: varchar({ length: 64 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    operation: varchar({ length: 80 }).notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    result: json().$type<Record<string, unknown>>().notNull(),
    createdAt: datetime({ mode: "date", fsp: 3 }).notNull(),
  },
  (t) => [index("training_mutation_receipt_user_idx").on(t.userId)],
)
