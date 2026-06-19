import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCrewEventSettingsId,
} from "./common"
import { competitionsTable } from "./competitions"

export const CREW_EVENT_LIFECYCLE = {
  DRAFT: "draft",
  SETUP: "setup",
  IMPORTING: "importing",
  READY: "ready",
  ARCHIVED: "archived",
} as const

export type CrewEventLifecycle =
  (typeof CREW_EVENT_LIFECYCLE)[keyof typeof CREW_EVENT_LIFECYCLE]

export const CREW_CONCIERGE_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  READY: "ready",
  BLOCKED: "blocked",
} as const

export type CrewConciergeStatus =
  (typeof CREW_CONCIERGE_STATUS)[keyof typeof CREW_CONCIERGE_STATUS]

export const CREW_PLAN = {
  SELF_SERVE: "self_serve",
  CONCIERGE: "concierge",
  FULL_PLATFORM: "full_platform",
} as const

export type CrewPlan = (typeof CREW_PLAN)[keyof typeof CREW_PLAN]

export const crewEventSettingsTable = mysqlTable(
  "crew_event_settings",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewEventSettingsId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    crewOnly: boolean().default(true).notNull(),
    sourcePlatform: varchar({ length: 100 }),
    sourceEventUrl: varchar({ length: 2048 }),
    externalRegistrationUrl: varchar({ length: 2048 }),
    lifecycle: varchar({ length: 20 })
      .$type<CrewEventLifecycle>()
      .default("draft")
      .notNull(),
    conciergeStatus: varchar({ length: 20 })
      .$type<CrewConciergeStatus>()
      .default("not_started")
      .notNull(),
    crewPlan: varchar({ length: 20 })
      .$type<CrewPlan>()
      .default("self_serve")
      .notNull(),
    fullPlatformCreditCents: int().default(0).notNull(),
    acquisitionSource: varchar({ length: 255 }),
    settings: text(),
  },
  (table) => [
    uniqueIndex("crew_event_settings_competition_unique_idx").on(
      table.competitionId,
    ),
    index("crew_event_settings_lifecycle_idx").on(table.lifecycle),
    index("crew_event_settings_plan_idx").on(table.crewPlan),
  ],
)

export const crewEventSettingsRelations = relations(
  crewEventSettingsTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [crewEventSettingsTable.competitionId],
      references: [competitionsTable.id],
    }),
  }),
)

export type CrewEventSettings = InferSelectModel<
  typeof crewEventSettingsTable
>
export type NewCrewEventSettings = typeof crewEventSettingsTable.$inferInsert
