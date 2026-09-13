import {
  index,
  int,
  json,
  mysqlTable,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

// Draft identity is the athlete. Source workspaces live in the document only.
export const trainingPlanDraftsTable = mysqlTable(
  "training_plan_drafts",
  {
    ...commonColumns,
    id: varchar({ length: 64 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    revision: int().notNull().default(1),
    status: varchar({ length: 16 })
      .$type<"draft" | "committed">()
      .notNull()
      .default("draft"),
    document: json().$type<unknown>().notNull(),
  },
  (t) => [index("training_plan_owner_idx").on(t.userId, t.updatedAt)],
)

export interface TrainingPlanCommitReceipt {
  trainingPlanId: string
  revision: number
  previewDigest: string
  sessions: { id: string; trainingDate: string; revision: number }[]
}

// Committed drafts remain readable; receipts recover lost commit responses.
export const trainingPlanReceiptsTable = mysqlTable(
  "training_plan_receipts",
  {
    ...commonColumns,
    id: varchar({ length: 64 }).primaryKey(),
    userId: varchar({ length: 255 }).notNull(),
    operation: varchar({ length: 32 }).notNull(),
    keyHash: varchar({ length: 64 }).notNull(),
    payloadHash: varchar({ length: 64 }).notNull(),
    receipt: json().$type<TrainingPlanCommitReceipt>().notNull(),
  },
  (t) => [
    uniqueIndex("training_plan_receipt_key_uq").on(
      t.userId,
      t.operation,
      t.keyHash,
    ),
  ],
)
