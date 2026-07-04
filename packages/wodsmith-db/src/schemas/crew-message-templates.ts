import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import { commonColumns, createCrewMessageTemplateId } from "./common"
import { competitionsTable } from "./competitions"

/**
 * Message template types an organizer can compose and send to crew volunteers.
 * The reminder + confirmation types seed their default copy from the crew
 * react-email components; `custom_broadcast` is a free-form message.
 */
export const CREW_MESSAGE_TEMPLATE_TYPE = {
  ASSIGNMENT_CONFIRMATION: "assignment_confirmation",
  REMINDER_48_HOUR: "reminder_48_hour",
  REMINDER_24_HOUR: "reminder_24_hour",
  CUSTOM_BROADCAST: "custom_broadcast",
} as const

export type CrewMessageTemplateType =
  (typeof CREW_MESSAGE_TEMPLATE_TYPE)[keyof typeof CREW_MESSAGE_TEMPLATE_TYPE]

/**
 * Per-event overrides of the default crew message copy. A row exists only when
 * an organizer has customized a template; the absence of a row means the
 * default copy is used. Body is plain text with `{{variable}}` placeholders and
 * paragraphs split on blank lines.
 */
export const crewMessageTemplatesTable = mysqlTable(
  "crew_message_templates",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewMessageTemplateId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    templateType: varchar({ length: 64 })
      .$type<CrewMessageTemplateType>()
      .notNull(),
    subject: varchar({ length: 255 }).notNull(),
    body: text().notNull(),
  },
  (table) => [
    uniqueIndex("crew_message_templates_competition_type_unique_idx").on(
      table.competitionId,
      table.templateType,
    ),
    index("crew_message_templates_competition_idx").on(table.competitionId),
  ],
)

export const crewMessageTemplatesRelations = relations(
  crewMessageTemplatesTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [crewMessageTemplatesTable.competitionId],
      references: [competitionsTable.id],
    }),
  }),
)

export type CrewMessageTemplate = InferSelectModel<
  typeof crewMessageTemplatesTable
>
export type NewCrewMessageTemplate =
  typeof crewMessageTemplatesTable.$inferInsert
