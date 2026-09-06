import { bigint, boolean, index, int, json, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core"
import { commonColumns } from "./common"
import type { TrainingBlockSnapshot } from "./training"

export interface PersonalItemSnapshot {
  id: string
  kind: "source" | "personal" | "library"
  block?: TrainingBlockSnapshot
  sourceSessionId?: string
  sourceBlockId?: string
  sourcePublishedVersion?: number
  sourceTrainingDate?: string
  trackId?: string
  trackName?: string
  remixedFrom?: { sourceSessionId: string; sourceBlockId: string; sourcePublishedVersion: number }
  workoutId?: string
  workout?: { name: string; description: string; scheme: string; scoreType?: string | null; timeCap?: number | null; roundsToScore?: number | null; repsPerRound?: number | null; tiebreakScheme?: string | null; scalingGroupId?: string | null }
}
export interface PersonalLibraryItemSnapshot {
  id: string
  kind: "library"
  workoutId: string
  workout: NonNullable<PersonalItemSnapshot["workout"]>
}

export const trainingPreferencesTable = mysqlTable("training_preferences", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  userId: varchar({ length: 255 }).notNull(),
  teamId: varchar({ length: 255 }).notNull(),
  defaultTrackId: varchar({ length: 255 }).notNull(),
}, (t) => [uniqueIndex("training_preference_user_team_uq").on(t.userId, t.teamId)])

export const personalTrainingSessionsTable = mysqlTable("personal_training_sessions", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  userId: varchar({ length: 255 }).notNull(),
  teamId: varchar({ length: 255 }).notNull(),
  trainingDate: varchar({ length: 10 }).notNull(),
  revision: int().notNull().default(1),
  items: json().$type<PersonalItemSnapshot[]>().notNull(),
}, (t) => [uniqueIndex("personal_training_day_uq").on(t.userId, t.teamId, t.trainingDate)])

export const personalTrainingResultsTable = mysqlTable("personal_training_results", {
  ...commonColumns,
  id: varchar({ length: 64 }).primaryKey(),
  personalSessionId: varchar({ length: 64 }).notNull(),
  itemId: varchar({ length: 64 }).notNull(),
  userId: varchar({ length: 255 }).notNull(),
  block: json().$type<TrainingBlockSnapshot>(),
  libraryItem: json().$type<PersonalLibraryItemSnapshot>(),
  scoreValue: bigint({ mode: "number" }),
  displayScore: varchar({ length: 100 }).notNull(),
  notes: text().notNull(),
  unit: varchar({ length: 2 }).$type<"lb" | "kg">().notNull(),
  completed: boolean().notNull(),
  legacyScoreId: varchar({ length: 255 }),
}, (t) => [
  uniqueIndex("personal_training_result_item_uq").on(t.personalSessionId, t.itemId),
  uniqueIndex("personal_training_result_legacy_uq").on(t.legacyScoreId),
  index("personal_training_result_user_idx").on(t.userId, t.updatedAt),
])
