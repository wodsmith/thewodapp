// @lat: [[crew#Self Serve Preset Schema]]
import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
  boolean,
  datetime,
  index,
  json,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCrewDepartmentLeadId,
  createCrewImportMappingPresetId,
  createCrewTemplatePresetId,
} from "./common"
import { competitionVenuesTable, competitionsTable } from "./competitions"
import type { CrewImportKind } from "./crew-imports"
import { teamInvitationTable, teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"
import type { VolunteerRoleType } from "./volunteers"

export const CREW_TEMPLATE_PRESET_KIND = {
  ROLE_TEMPLATE: "role_template",
  SHIFT_TEMPLATE: "shift_template",
  STAFFING_TEMPLATE: "staffing_template",
} as const

export type CrewTemplatePresetKind =
  (typeof CREW_TEMPLATE_PRESET_KIND)[keyof typeof CREW_TEMPLATE_PRESET_KIND]

export const CREW_DEPARTMENT_LEAD_STATUS = {
  INVITED: "invited",
  ACTIVE: "active",
  REVOKED: "revoked",
} as const

export type CrewDepartmentLeadStatus =
  (typeof CREW_DEPARTMENT_LEAD_STATUS)[keyof typeof CREW_DEPARTMENT_LEAD_STATUS]

export type CrewTemplatePresetData = Record<string, unknown>
export type CrewTemplatePresetMetadata = Record<string, unknown>
export type CrewImportMappingPresetMetadata = Record<string, unknown>
export type CrewImportMappingColumnMapping = Record<string, string>
export type CrewDepartmentLeadScope = Record<string, unknown>
export type CrewDepartmentLeadMetadata = Record<string, unknown>

export const crewTemplatePresetsTable = mysqlTable(
  "crew_template_presets",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewTemplatePresetId())
      .notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }),
    kind: varchar({ length: 40 }).$type<CrewTemplatePresetKind>().notNull(),
    name: varchar({ length: 255 }).notNull(),
    description: text(),
    presetData: json().$type<CrewTemplatePresetData>().notNull(),
    metadata: json().$type<CrewTemplatePresetMetadata>(),
    createdBy: varchar({ length: 255 }),
    updatedBy: varchar({ length: 255 }),
    isArchived: boolean().default(false).notNull(),
  },
  (table) => [
    index("crew_template_presets_team_kind_idx").on(table.teamId, table.kind),
    index("crew_template_presets_competition_idx").on(table.competitionId),
    index("crew_template_presets_created_by_idx").on(table.createdBy),
    index("crew_template_presets_archived_idx").on(table.isArchived),
  ],
)

export const crewImportMappingPresetsTable = mysqlTable(
  "crew_import_mapping_presets",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewImportMappingPresetId())
      .notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }),
    kind: varchar({ length: 30 }).$type<CrewImportKind>().notNull(),
    sourcePlatform: varchar({ length: 100 }).default("csv").notNull(),
    name: varchar({ length: 255 }),
    headerFingerprint: varchar({ length: 255 }).notNull(),
    headers: json().$type<string[]>().notNull(),
    columnMapping: json().$type<CrewImportMappingColumnMapping>().notNull(),
    parserVersion: varchar({ length: 100 }),
    lastUsedAt: datetime(),
    metadata: json().$type<CrewImportMappingPresetMetadata>(),
    createdBy: varchar({ length: 255 }),
    updatedBy: varchar({ length: 255 }),
  },
  (table) => [
    uniqueIndex("crew_import_mapping_presets_lookup_unique_idx").on(
      table.teamId,
      table.sourcePlatform,
      table.kind,
      table.headerFingerprint,
    ),
    index("crew_import_mapping_presets_team_kind_idx").on(
      table.teamId,
      table.kind,
    ),
    index("crew_import_mapping_presets_competition_idx").on(
      table.competitionId,
    ),
    index("crew_import_mapping_presets_last_used_idx").on(table.lastUsedAt),
  ],
)

export const crewDepartmentLeadsTable = mysqlTable(
  "crew_department_leads",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewDepartmentLeadId())
      .notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    membershipId: varchar({ length: 255 }),
    invitationId: varchar({ length: 255 }),
    email: varchar({ length: 255 }),
    name: varchar({ length: 255 }),
    roleType: varchar({ length: 50 }).$type<VolunteerRoleType>(),
    venueId: varchar({ length: 255 }),
    startsAt: datetime(),
    endsAt: datetime(),
    scope: json().$type<CrewDepartmentLeadScope>(),
    status: varchar({ length: 20 })
      .$type<CrewDepartmentLeadStatus>()
      .default("invited")
      .notNull(),
    assignedBy: varchar({ length: 255 }),
    acceptedAt: datetime(),
    revokedAt: datetime(),
    notes: text(),
    metadata: json().$type<CrewDepartmentLeadMetadata>(),
  },
  (table) => [
    index("crew_department_leads_competition_idx").on(table.competitionId),
    index("crew_department_leads_team_idx").on(table.teamId),
    index("crew_department_leads_membership_idx").on(table.membershipId),
    index("crew_department_leads_invitation_idx").on(table.invitationId),
    index("crew_department_leads_email_idx").on(table.email),
    index("crew_department_leads_role_idx").on(table.roleType),
    index("crew_department_leads_venue_idx").on(table.venueId),
    index("crew_department_leads_status_idx").on(table.status),
    index("crew_department_leads_time_idx").on(table.startsAt, table.endsAt),
  ],
)

export const crewTemplatePresetsRelations = relations(
  crewTemplatePresetsTable,
  ({ one }) => ({
    team: one(teamTable, {
      fields: [crewTemplatePresetsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewTemplatePresetsTable.competitionId],
      references: [competitionsTable.id],
    }),
    createdByUser: one(userTable, {
      fields: [crewTemplatePresetsTable.createdBy],
      references: [userTable.id],
      relationName: "crewTemplatePresetCreatedBy",
    }),
    updatedByUser: one(userTable, {
      fields: [crewTemplatePresetsTable.updatedBy],
      references: [userTable.id],
      relationName: "crewTemplatePresetUpdatedBy",
    }),
  }),
)

export const crewImportMappingPresetsRelations = relations(
  crewImportMappingPresetsTable,
  ({ one }) => ({
    team: one(teamTable, {
      fields: [crewImportMappingPresetsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewImportMappingPresetsTable.competitionId],
      references: [competitionsTable.id],
    }),
    createdByUser: one(userTable, {
      fields: [crewImportMappingPresetsTable.createdBy],
      references: [userTable.id],
      relationName: "crewImportMappingPresetCreatedBy",
    }),
    updatedByUser: one(userTable, {
      fields: [crewImportMappingPresetsTable.updatedBy],
      references: [userTable.id],
      relationName: "crewImportMappingPresetUpdatedBy",
    }),
  }),
)

export const crewDepartmentLeadsRelations = relations(
  crewDepartmentLeadsTable,
  ({ one }) => ({
    team: one(teamTable, {
      fields: [crewDepartmentLeadsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewDepartmentLeadsTable.competitionId],
      references: [competitionsTable.id],
    }),
    membership: one(teamMembershipTable, {
      fields: [crewDepartmentLeadsTable.membershipId],
      references: [teamMembershipTable.id],
    }),
    invitation: one(teamInvitationTable, {
      fields: [crewDepartmentLeadsTable.invitationId],
      references: [teamInvitationTable.id],
    }),
    venue: one(competitionVenuesTable, {
      fields: [crewDepartmentLeadsTable.venueId],
      references: [competitionVenuesTable.id],
    }),
    assignedByUser: one(userTable, {
      fields: [crewDepartmentLeadsTable.assignedBy],
      references: [userTable.id],
      relationName: "crewDepartmentLeadAssignedBy",
    }),
  }),
)

export type CrewTemplatePreset = InferSelectModel<
  typeof crewTemplatePresetsTable
>
export type NewCrewTemplatePreset = typeof crewTemplatePresetsTable.$inferInsert
export type CrewImportMappingPreset = InferSelectModel<
  typeof crewImportMappingPresetsTable
>
export type NewCrewImportMappingPreset =
  typeof crewImportMappingPresetsTable.$inferInsert
export type CrewDepartmentLead = InferSelectModel<
  typeof crewDepartmentLeadsTable
>
export type NewCrewDepartmentLead = typeof crewDepartmentLeadsTable.$inferInsert
