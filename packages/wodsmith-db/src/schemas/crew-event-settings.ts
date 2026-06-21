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

// @lat: [[crew#Crew Billing State And Audit]]
export const CREW_BILLING_STATE = {
  UNPAID: "unpaid",
  PENDING: "pending",
  PAID: "paid",
  COMPED: "comped",
  CREDITED: "credited",
  REFUNDED: "refunded",
} as const

// @lat: [[crew#Crew Billing State And Audit]]
export type CrewBillingState =
  (typeof CREW_BILLING_STATE)[keyof typeof CREW_BILLING_STATE]

// @lat: [[crew#Crew Billing State And Audit]]
export const CREW_BILLING_SOURCE = {
  MANUAL_SALES: "manual_sales",
  PAYMENT_LINK: "payment_link",
  STRIPE_CHECKOUT: "stripe_checkout",
  FOUNDER_OVERRIDE: "founder_override",
  CREW_CREDIT: "crew_credit",
  COMP: "comp",
} as const

// @lat: [[crew#Crew Billing State And Audit]]
export type CrewBillingSource =
  (typeof CREW_BILLING_SOURCE)[keyof typeof CREW_BILLING_SOURCE]

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
    // @lat: [[crew#Crew Billing State And Audit]]
    crewBillingState: varchar({ length: 30 })
      .$type<CrewBillingState>()
      .default(CREW_BILLING_STATE.UNPAID)
      .notNull(),
    crewBillingSource: varchar({ length: 40 }).$type<CrewBillingSource>(),
    crewBillingPlanId: varchar({ length: 255 }),
    crewBillingAmountCents: int().default(0).notNull(),
    crewBillingCurrency: varchar({ length: 3 }).default("usd").notNull(),
    crewStripePaymentLinkId: varchar({ length: 255 }),
    crewStripeCheckoutSessionId: varchar({ length: 255 }),
    crewStripePaymentIntentId: varchar({ length: 255 }),
    crewFounderOverride: boolean().default(false).notNull(),
    crewCreditCents: int().default(0).notNull(),
    crewRefundedCents: int().default(0).notNull(),
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
    // @lat: [[crew#Crew Billing State And Audit]]
    index("crew_event_settings_billing_state_idx").on(table.crewBillingState),
    index("crew_event_settings_billing_source_idx").on(table.crewBillingSource),
    index("crew_event_settings_billing_plan_idx").on(table.crewBillingPlanId),
    index("crew_event_settings_payment_link_idx").on(
      table.crewStripePaymentLinkId,
    ),
    index("crew_event_settings_checkout_session_idx").on(
      table.crewStripeCheckoutSessionId,
    ),
    index("crew_event_settings_payment_intent_idx").on(
      table.crewStripePaymentIntentId,
    ),
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
