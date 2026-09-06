import { bigint, boolean, index, int, json, mysqlTable, primaryKey, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"

export interface TrainingBlockSnapshot {
  id: string
  kind: "check" | "load" | "time" | "reps" | "note"
  title: string
  prescription: string
  scalingGuidance: string
  coachGuidance: string
}

export interface TrainingContentSnapshot {
  title: string
  coachNote: string
  isRestDay: boolean
  blocks: TrainingBlockSnapshot[]
}

export const trainingSessionsTable = mysqlTable("training_sessions", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  teamId: varchar({ length: 255 }).notNull(),
  trackId: varchar({ length: 255 }).notNull(),
  trainingDate: varchar({ length: 10 }).notNull(),
  timezone: varchar({ length: 100 }).notNull(),
  revision: int().notNull().default(1),
  publishedVersion: int().notNull().default(0),
  draft: json().$type<TrainingContentSnapshot>(),
  published: json().$type<TrainingContentSnapshot>(),
}, (t) => [
  uniqueIndex("training_session_occurrence_uq").on(t.teamId, t.trackId, t.trainingDate),
])

export const trainingResultsTable = mysqlTable("training_results", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  sessionId: varchar({ length: 64 }).notNull(),
  blockId: varchar({ length: 64 }).notNull(),
  userId: varchar({ length: 255 }).notNull(),
  publishedVersion: int().notNull(),
  block: json().$type<TrainingBlockSnapshot>().notNull(),
  scoreValue: bigint({ mode: "number" }),
  displayScore: varchar({ length: 100 }).notNull(),
  scaling: varchar({ length: 10 }).$type<"rx" | "scaled" | "custom">().notNull(),
  modification: text().notNull(),
  notes: text().notNull(),
  audience: varchar({ length: 10 }).$type<"gym" | "private">().notNull(),
  unit: varchar({ length: 2 }).$type<"lb" | "kg">().notNull(),
  completed: boolean().notNull(),
}, (t) => [
  uniqueIndex("training_result_version_uq").on(t.sessionId, t.blockId, t.userId, t.publishedVersion),
  index("training_result_user_idx").on(t.userId, t.updatedAt),
])

export const trainingCheersTable = mysqlTable("training_cheers", {
  resultId: varchar({ length: 64 }).notNull(),
  userId: varchar({ length: 255 }).notNull(),
}, (t) => [primaryKey({ columns: [t.resultId, t.userId] })])
