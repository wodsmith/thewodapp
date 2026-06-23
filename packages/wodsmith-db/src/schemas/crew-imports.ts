import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  datetime,
  index,
  int,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCrewAssignmentConfirmationId,
  createCrewImportId,
  createCrewImportRowId,
} from "./common"
import { competitionInvitesTable } from "./competition-invites"
import { competitionsTable } from "./competitions"
import { teamInvitationTable, teamMembershipTable } from "./teams"
import { userTable } from "./users"

export const CREW_IMPORT_KIND = {
  VOLUNTEERS: "volunteers",
  HEAT_SCHEDULE: "heat_schedule",
  ROLE_TEMPLATE: "role_template",
  UNKNOWN: "unknown",
} as const

export type CrewImportKind =
  (typeof CREW_IMPORT_KIND)[keyof typeof CREW_IMPORT_KIND]

export const CREW_IMPORT_STATUS = {
  UPLOADED: "uploaded",
  MAPPED: "mapped",
  PREVIEWED: "previewed",
  APPLIED: "applied",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const

export type CrewImportStatus =
  (typeof CREW_IMPORT_STATUS)[keyof typeof CREW_IMPORT_STATUS]

export const CREW_IMPORT_ROW_TARGET_TYPE = {
  TEAM_INVITATION: "team_invitation",
  TEAM_MEMBERSHIP: "team_membership",
  COMPETITION_HEAT: "competition_heat",
  TRACK_WORKOUT: "track_workout",
  VOLUNTEER_SHIFT: "volunteer_shift",
} as const

export type CrewImportRowTargetType =
  (typeof CREW_IMPORT_ROW_TARGET_TYPE)[keyof typeof CREW_IMPORT_ROW_TARGET_TYPE]

export const CREW_IMPORT_ROW_ACTION = {
  CREATE: "create",
  UPDATE: "update",
  SKIP: "skip",
  ERROR: "error",
} as const

export type CrewImportRowAction =
  (typeof CREW_IMPORT_ROW_ACTION)[keyof typeof CREW_IMPORT_ROW_ACTION]

export const CREW_ASSIGNMENT_CONFIRMATION_TYPE = {
  VOLUNTEER_SHIFT: "volunteer_shift",
  JUDGE_ROTATION: "judge_rotation",
  JUDGE_HEAT: "judge_heat",
} as const

export type CrewAssignmentConfirmationType =
  (typeof CREW_ASSIGNMENT_CONFIRMATION_TYPE)[keyof typeof CREW_ASSIGNMENT_CONFIRMATION_TYPE]

export const CREW_ASSIGNMENT_CONFIRMATION_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked_in",
  DECLINED: "declined",
  CHANGE_REQUESTED: "change_requested",
  NO_SHOW: "no_show",
  CANCELLED: "cancelled",
} as const

export type CrewAssignmentConfirmationStatus =
  (typeof CREW_ASSIGNMENT_CONFIRMATION_STATUS)[keyof typeof CREW_ASSIGNMENT_CONFIRMATION_STATUS]

export type CrewImportSummary = Record<string, unknown>
export type CrewImportRowPayload = Record<string, unknown>
export type CrewImportIssueList = Array<string | Record<string, unknown>>

export const crewImportsTable = mysqlTable(
  "crew_imports",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewImportId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    kind: varchar({ length: 30 })
      .$type<CrewImportKind>()
      .default("unknown")
      .notNull(),
    sourcePlatform: varchar({ length: 100 }),
    uploadedBy: varchar({ length: 255 }),
    originalFilename: varchar({ length: 500 }),
    fileKey: varchar({ length: 1024 }),
    mimeType: varchar({ length: 255 }),
    status: varchar({ length: 20 })
      .$type<CrewImportStatus>()
      .default("uploaded")
      .notNull(),
    parserVersion: varchar({ length: 100 }),
    headers: json().$type<string[]>(),
    columnMapping: json().$type<Record<string, string>>(),
    summary: json().$type<CrewImportSummary>(),
    warningCount: int().default(0).notNull(),
    errorCount: int().default(0).notNull(),
    rowCount: int().default(0).notNull(),
    createdCount: int().default(0).notNull(),
    updatedCount: int().default(0).notNull(),
    skippedCount: int().default(0).notNull(),
    appliedAt: datetime(),
    appliedBy: varchar({ length: 255 }),
  },
  (table) => [
    index("crew_imports_competition_idx").on(table.competitionId),
    index("crew_imports_status_idx").on(table.status),
    index("crew_imports_kind_idx").on(table.kind),
    index("crew_imports_uploaded_by_idx").on(table.uploadedBy),
    index("crew_imports_applied_by_idx").on(table.appliedBy),
  ],
)

export const crewImportRowsTable = mysqlTable(
  "crew_import_rows",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewImportRowId())
      .notNull(),
    importId: varchar({ length: 255 }).notNull(),
    rowNumber: int().notNull(),
    rawRow: json().$type<CrewImportRowPayload>(),
    normalizedRow: json().$type<CrewImportRowPayload>(),
    targetType: varchar({ length: 30 }).$type<CrewImportRowTargetType>(),
    targetId: varchar({ length: 255 }),
    action: varchar({ length: 20 }).$type<CrewImportRowAction>(),
    warnings: json().$type<CrewImportIssueList>(),
    errors: json().$type<CrewImportIssueList>(),
  },
  (table) => [
    index("crew_import_rows_import_idx").on(table.importId),
    uniqueIndex("crew_import_rows_import_row_unique_idx").on(
      table.importId,
      table.rowNumber,
    ),
    index("crew_import_rows_target_idx").on(table.targetType, table.targetId),
    index("crew_import_rows_action_idx").on(table.action),
  ],
)

export const crewAssignmentConfirmationsTable = mysqlTable(
  "crew_assignment_confirmations",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewAssignmentConfirmationId())
      .notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    assignmentType: varchar({ length: 30 })
      .$type<CrewAssignmentConfirmationType>()
      .notNull(),
    assignmentId: varchar({ length: 255 }).notNull(),
    membershipId: varchar({ length: 255 }),
    invitationId: varchar({ length: 255 }),
    competitionInviteId: varchar({ length: 255 }),
    email: varchar({ length: 255 }),
    tokenHash: varchar({ length: 255 }).notNull(),
    status: varchar({ length: 30 })
      .$type<CrewAssignmentConfirmationStatus>()
      .default("pending")
      .notNull(),
    sentAt: datetime(),
    respondedAt: datetime(),
    expiresAt: datetime(),
    responseNote: text(),
    lastReminderAt: datetime(),
    reminderCount: int().default(0).notNull(),
  },
  (table) => [
    index("crew_assignment_confirmations_competition_idx").on(
      table.competitionId,
    ),
    index("crew_assignment_confirmations_assignment_idx").on(
      table.assignmentType,
      table.assignmentId,
    ),
    index("crew_assignment_confirmations_status_idx").on(table.status),
    index("crew_assignment_confirmations_membership_idx").on(
      table.membershipId,
    ),
    index("crew_assignment_confirmations_invitation_idx").on(
      table.invitationId,
    ),
    index("crew_assignment_confirmations_competition_invite_idx").on(
      table.competitionInviteId,
    ),
    index("crew_assignment_confirmations_email_idx").on(table.email),
    index("crew_assignment_confirmations_expires_idx").on(table.expiresAt),
    uniqueIndex("crew_assignment_confirmations_token_hash_unique_idx").on(
      table.tokenHash,
    ),
  ],
)

export const crewImportsRelations = relations(
  crewImportsTable,
  ({ one, many }) => ({
    competition: one(competitionsTable, {
      fields: [crewImportsTable.competitionId],
      references: [competitionsTable.id],
    }),
    uploadedByUser: one(userTable, {
      fields: [crewImportsTable.uploadedBy],
      references: [userTable.id],
      relationName: "crewImportUploadedBy",
    }),
    appliedByUser: one(userTable, {
      fields: [crewImportsTable.appliedBy],
      references: [userTable.id],
      relationName: "crewImportAppliedBy",
    }),
    rows: many(crewImportRowsTable),
  }),
)

export const crewImportRowsRelations = relations(
  crewImportRowsTable,
  ({ one }) => ({
    import: one(crewImportsTable, {
      fields: [crewImportRowsTable.importId],
      references: [crewImportsTable.id],
    }),
  }),
)

export const crewAssignmentConfirmationsRelations = relations(
  crewAssignmentConfirmationsTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [crewAssignmentConfirmationsTable.competitionId],
      references: [competitionsTable.id],
    }),
    membership: one(teamMembershipTable, {
      fields: [crewAssignmentConfirmationsTable.membershipId],
      references: [teamMembershipTable.id],
    }),
    invitation: one(teamInvitationTable, {
      fields: [crewAssignmentConfirmationsTable.invitationId],
      references: [teamInvitationTable.id],
    }),
    competitionInvite: one(competitionInvitesTable, {
      fields: [crewAssignmentConfirmationsTable.competitionInviteId],
      references: [competitionInvitesTable.id],
    }),
  }),
)

export type CrewImport = InferSelectModel<typeof crewImportsTable>
export type NewCrewImport = typeof crewImportsTable.$inferInsert
export type CrewImportRow = InferSelectModel<typeof crewImportRowsTable>
export type NewCrewImportRow = typeof crewImportRowsTable.$inferInsert
export type CrewAssignmentConfirmation = InferSelectModel<
  typeof crewAssignmentConfirmationsTable
>
export type NewCrewAssignmentConfirmation =
  typeof crewAssignmentConfirmationsTable.$inferInsert
