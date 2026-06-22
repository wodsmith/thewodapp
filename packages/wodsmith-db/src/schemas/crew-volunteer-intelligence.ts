// @lat: [[crew#Strategic Moat Privacy Model]]
import type { InferSelectModel } from "drizzle-orm"
import { relations, sql } from "drizzle-orm"
import {
  boolean,
  check,
  datetime,
  index,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core"
import {
  commonColumns,
  createCrewCompetitionGroupSettingsId,
  createCrewEventConversionId,
  createCrewVolunteerConsentId,
  createCrewVolunteerCredentialId,
  createCrewVolunteerHistoryEventId,
  createCrewVolunteerIdentityId,
  createCrewVolunteerIntroRequestId,
} from "./common"
import {
  competitionGroupsTable,
  competitionsTable,
} from "./competitions"
import { crewEventSettingsTable } from "./crew-event-settings"
import { teamInvitationTable, teamMembershipTable, teamTable } from "./teams"
import { userTable } from "./users"
import type { VolunteerRoleType } from "./volunteers"

export const CREW_VOLUNTEER_IDENTITY_SOURCE = {
  USER: "user",
  MEMBERSHIP: "membership",
  INVITATION: "invitation",
  SELF_SERVICE: "self_service",
  IMPORT: "import",
  MANUAL: "manual",
} as const

export type CrewVolunteerIdentitySource =
  (typeof CREW_VOLUNTEER_IDENTITY_SOURCE)[keyof typeof CREW_VOLUNTEER_IDENTITY_SOURCE]

export const CREW_VOLUNTEER_IDENTITY_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const

export type CrewVolunteerIdentityStatus =
  (typeof CREW_VOLUNTEER_IDENTITY_STATUS)[keyof typeof CREW_VOLUNTEER_IDENTITY_STATUS]

export const CREW_VOLUNTEER_DISCOVERY_AGE_STATUS = {
  UNKNOWN: "unknown",
  ADULT_CONFIRMED: "adult_confirmed",
  MINOR_BLOCKED: "minor_blocked",
} as const

export type CrewVolunteerDiscoveryAgeStatus =
  (typeof CREW_VOLUNTEER_DISCOVERY_AGE_STATUS)[keyof typeof CREW_VOLUNTEER_DISCOVERY_AGE_STATUS]

export const CREW_VOLUNTEER_CONSENT_SCOPE = {
  SAME_ORGANIZER_HISTORY: "same_organizer_history",
  COMMUNICATION_HISTORY: "communication_history",
  REGIONAL_DISCOVERY: "regional_discovery",
  INTRO_REQUESTS: "intro_requests",
} as const

export type CrewVolunteerConsentScope =
  (typeof CREW_VOLUNTEER_CONSENT_SCOPE)[keyof typeof CREW_VOLUNTEER_CONSENT_SCOPE]

export const CREW_VOLUNTEER_CONSENT_STATUS = {
  GRANTED: "granted",
  REVOKED: "revoked",
  SUPERSEDED: "superseded",
} as const

export type CrewVolunteerConsentStatus =
  (typeof CREW_VOLUNTEER_CONSENT_STATUS)[keyof typeof CREW_VOLUNTEER_CONSENT_STATUS]

export const CREW_VOLUNTEER_CONSENT_SOURCE = {
  VOLUNTEER_ACCOUNT: "volunteer_account",
  PUBLIC_TOKEN: "public_token",
  CONSENT_CENTER: "consent_center",
  ORGANIZER_RECORDED: "organizer_recorded",
} as const

export type CrewVolunteerConsentSource =
  (typeof CREW_VOLUNTEER_CONSENT_SOURCE)[keyof typeof CREW_VOLUNTEER_CONSENT_SOURCE]

export const CREW_VOLUNTEER_HISTORY_EVENT_TYPE = {
  SIGNED_UP: "signed_up",
  IMPORTED: "imported",
  ASSIGNED: "assigned",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  CHANGE_REQUESTED: "change_requested",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  REPLACED: "replaced",
  RESPONSE_RECEIVED: "response_received",
  MESSAGE_SENT: "message_sent",
  MESSAGE_BOUNCED: "message_bounced",
  MESSAGE_REPLIED: "message_replied",
  CREDENTIAL_CHECKED: "credential_checked",
  CREDENTIAL_REVOKED: "credential_revoked",
  CORRECTION: "correction",
} as const

export type CrewVolunteerHistoryEventType =
  (typeof CREW_VOLUNTEER_HISTORY_EVENT_TYPE)[keyof typeof CREW_VOLUNTEER_HISTORY_EVENT_TYPE]

export const CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE = {
  VOLUNTEER_SHIFT: "volunteer_shift",
  JUDGE_ROTATION: "judge_rotation",
  JUDGE_HEAT: "judge_heat",
  DEPARTMENT_LEAD: "department_lead",
  OTHER: "other",
} as const

export type CrewVolunteerHistoryAssignmentType =
  (typeof CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE)[keyof typeof CREW_VOLUNTEER_HISTORY_ASSIGNMENT_TYPE]

export const CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE = {
  SAME_ORGANIZER: "same_organizer",
  CONSENTED_INTRO: "consented_intro",
} as const

export type CrewVolunteerHistoryVisibilityScope =
  (typeof CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE)[keyof typeof CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE]

export const CREW_VOLUNTEER_CREDENTIAL_TYPE = {
  JUDGE_COURSE: "judge_course",
  MEDICAL: "medical",
  SAFETY: "safety",
  EQUIPMENT: "equipment",
  ORGANIZER_TRAINING: "organizer_training",
  OTHER: "other",
} as const

export type CrewVolunteerCredentialType =
  (typeof CREW_VOLUNTEER_CREDENTIAL_TYPE)[keyof typeof CREW_VOLUNTEER_CREDENTIAL_TYPE]

export const CREW_VOLUNTEER_CREDENTIAL_STATUS = {
  SELF_REPORTED: "self_reported",
  VERIFIED: "verified",
  EXPIRED: "expired",
  REVOKED: "revoked",
} as const

export type CrewVolunteerCredentialStatus =
  (typeof CREW_VOLUNTEER_CREDENTIAL_STATUS)[keyof typeof CREW_VOLUNTEER_CREDENTIAL_STATUS]

export const CREW_SERIES_MEMORY_MODE = {
  DISABLED: "disabled",
  SAME_GROUP: "same_group",
} as const

export type CrewSeriesMemoryMode =
  (typeof CREW_SERIES_MEMORY_MODE)[keyof typeof CREW_SERIES_MEMORY_MODE]

export const CREW_EVENT_CONVERSION_STATUS = {
  REQUESTED: "requested",
  PRIVACY_REVIEWED: "privacy_reviewed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const

export type CrewEventConversionStatus =
  (typeof CREW_EVENT_CONVERSION_STATUS)[keyof typeof CREW_EVENT_CONVERSION_STATUS]

export const CREW_VOLUNTEER_INTRO_REQUEST_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const

export type CrewVolunteerIntroRequestStatus =
  (typeof CREW_VOLUNTEER_INTRO_REQUEST_STATUS)[keyof typeof CREW_VOLUNTEER_INTRO_REQUEST_STATUS]

export const crewVolunteerIdentitiesTable = mysqlTable(
  "crew_volunteer_identities",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewVolunteerIdentityId())
      .notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    userId: varchar({ length: 255 }),
    emailHash: varchar({ length: 255 }),
    phoneHash: varchar({ length: 255 }),
    contactHashVersion: varchar({ length: 50 }).default("v1").notNull(),
    sourceCompetitionId: varchar({ length: 255 }),
    sourceMembershipId: varchar({ length: 255 }),
    sourceInvitationId: varchar({ length: 255 }),
    identitySource: varchar({ length: 40 })
      .$type<CrewVolunteerIdentitySource>()
      .default(CREW_VOLUNTEER_IDENTITY_SOURCE.MANUAL)
      .notNull(),
    discoveryAgeStatus: varchar({ length: 30 })
      .$type<CrewVolunteerDiscoveryAgeStatus>()
      .default(CREW_VOLUNTEER_DISCOVERY_AGE_STATUS.UNKNOWN)
      .notNull(),
    status: varchar({ length: 20 })
      .$type<CrewVolunteerIdentityStatus>()
      .default(CREW_VOLUNTEER_IDENTITY_STATUS.ACTIVE)
      .notNull(),
  },
  (table) => [
    uniqueIndex("crew_volunteer_identities_team_user_unique_idx").on(
      table.teamId,
      table.userId,
    ),
    uniqueIndex("crew_volunteer_identities_team_email_hash_unique_idx").on(
      table.teamId,
      table.contactHashVersion,
      table.emailHash,
    ),
    uniqueIndex("crew_volunteer_identities_team_phone_hash_unique_idx").on(
      table.teamId,
      table.contactHashVersion,
      table.phoneHash,
    ),
    index("crew_volunteer_identities_team_idx").on(table.teamId),
    index("crew_volunteer_identities_user_idx").on(table.userId),
    index("crew_volunteer_identities_source_competition_idx").on(
      table.sourceCompetitionId,
    ),
    index("crew_volunteer_identities_status_idx").on(table.status),
    index("crew_volunteer_identities_age_status_idx").on(
      table.discoveryAgeStatus,
    ),
    check(
      "crew_volunteer_identities_anchor_check",
      sql`${table.userId} is not null or ${table.emailHash} is not null or ${table.phoneHash} is not null`,
    ),
  ],
)

export const crewVolunteerConsentsTable = mysqlTable(
  "crew_volunteer_consents",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewVolunteerConsentId())
      .notNull(),
    identityId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    scope: varchar({ length: 50 }).$type<CrewVolunteerConsentScope>().notNull(),
    status: varchar({ length: 20 })
      .$type<CrewVolunteerConsentStatus>()
      .default(CREW_VOLUNTEER_CONSENT_STATUS.GRANTED)
      .notNull(),
    consentText: text().notNull(),
    consentTextVersion: varchar({ length: 100 }).notNull(),
    consentTextHash: varchar({ length: 255 }).notNull(),
    source: varchar({ length: 40 })
      .$type<CrewVolunteerConsentSource>()
      .notNull(),
    sourceSurface: varchar({ length: 100 }).notNull(),
    sourceCompetitionId: varchar({ length: 255 }),
    actorUserId: varchar({ length: 255 }),
    recordedByUserId: varchar({ length: 255 }),
    grantedAt: datetime()
      .$defaultFn(() => new Date())
      .notNull(),
    revokedAt: datetime(),
    revokedByUserId: varchar({ length: 255 }),
    revocationSource: varchar({ length: 100 }),
    supersededByConsentId: varchar({ length: 255 }),
  },
  (table) => [
    index("crew_volunteer_consents_identity_idx").on(table.identityId),
    index("crew_volunteer_consents_team_idx").on(table.teamId),
    index("crew_volunteer_consents_scope_status_idx").on(
      table.scope,
      table.status,
    ),
    index("crew_volunteer_consents_identity_scope_status_idx").on(
      table.identityId,
      table.scope,
      table.status,
    ),
    index("crew_volunteer_consents_source_competition_idx").on(
      table.sourceCompetitionId,
    ),
    index("crew_volunteer_consents_actor_idx").on(table.actorUserId),
    index("crew_volunteer_consents_recorded_by_idx").on(
      table.recordedByUserId,
    ),
    index("crew_volunteer_consents_revoked_at_idx").on(table.revokedAt),
  ],
)

export const crewVolunteerHistoryEventsTable = mysqlTable(
  "crew_volunteer_history_events",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewVolunteerHistoryEventId())
      .notNull(),
    identityId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }),
    groupId: varchar({ length: 255 }),
    eventType: varchar({ length: 50 })
      .$type<CrewVolunteerHistoryEventType>()
      .notNull(),
    visibilityScope: varchar({ length: 30 })
      .$type<CrewVolunteerHistoryVisibilityScope>()
      .default(CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER)
      .notNull(),
    assignmentType: varchar({ length: 40 })
      .$type<CrewVolunteerHistoryAssignmentType>(),
    assignmentId: varchar({ length: 255 }),
    roleType: varchar({ length: 50 }).$type<VolunteerRoleType>(),
    occurredAt: datetime().notNull(),
    sourceType: varchar({ length: 50 }).notNull(),
    sourceId: varchar({ length: 255 }),
    sourceUserId: varchar({ length: 255 }),
    consentId: varchar({ length: 255 }),
    correctionOfEventId: varchar({ length: 255 }),
  },
  (table) => [
    index("crew_volunteer_history_events_identity_idx").on(table.identityId),
    index("crew_volunteer_history_events_team_idx").on(table.teamId),
    index("crew_volunteer_history_events_competition_idx").on(
      table.competitionId,
    ),
    index("crew_volunteer_history_events_group_idx").on(table.groupId),
    index("crew_volunteer_history_events_type_idx").on(table.eventType),
    index("crew_volunteer_history_events_visibility_idx").on(
      table.visibilityScope,
    ),
    index("crew_volunteer_history_events_occurred_idx").on(table.occurredAt),
    index("crew_volunteer_history_events_identity_occurred_idx").on(
      table.identityId,
      table.occurredAt,
    ),
    index("crew_volunteer_history_events_assignment_idx").on(
      table.assignmentType,
      table.assignmentId,
    ),
    index("crew_volunteer_history_events_role_idx").on(table.roleType),
    index("crew_volunteer_history_events_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
    index("crew_volunteer_history_events_consent_idx").on(table.consentId),
    index("crew_volunteer_history_events_correction_idx").on(
      table.correctionOfEventId,
    ),
  ],
)

export const crewVolunteerCredentialsTable = mysqlTable(
  "crew_volunteer_credentials",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewVolunteerCredentialId())
      .notNull(),
    identityId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }),
    credentialType: varchar({ length: 40 })
      .$type<CrewVolunteerCredentialType>()
      .notNull(),
    credentialKey: varchar({ length: 100 }),
    credentialLabel: varchar({ length: 255 }).notNull(),
    issuer: varchar({ length: 255 }),
    status: varchar({ length: 20 })
      .$type<CrewVolunteerCredentialStatus>()
      .default(CREW_VOLUNTEER_CREDENTIAL_STATUS.SELF_REPORTED)
      .notNull(),
    visibilityScope: varchar({ length: 30 })
      .$type<CrewVolunteerHistoryVisibilityScope>()
      .default(CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER)
      .notNull(),
    verifiedAt: datetime(),
    expiresAt: datetime(),
    revokedAt: datetime(),
    verifiedByUserId: varchar({ length: 255 }),
    sourceType: varchar({ length: 50 }),
    sourceId: varchar({ length: 255 }),
    consentId: varchar({ length: 255 }),
  },
  (table) => [
    index("crew_volunteer_credentials_identity_idx").on(table.identityId),
    index("crew_volunteer_credentials_team_idx").on(table.teamId),
    index("crew_volunteer_credentials_competition_idx").on(
      table.competitionId,
    ),
    index("crew_volunteer_credentials_type_idx").on(table.credentialType),
    index("crew_volunteer_credentials_key_idx").on(table.credentialKey),
    index("crew_volunteer_credentials_status_idx").on(table.status),
    index("crew_volunteer_credentials_visibility_idx").on(
      table.visibilityScope,
    ),
    index("crew_volunteer_credentials_expires_idx").on(table.expiresAt),
    index("crew_volunteer_credentials_verified_by_idx").on(
      table.verifiedByUserId,
    ),
    index("crew_volunteer_credentials_consent_idx").on(table.consentId),
  ],
)

export const crewCompetitionGroupSettingsTable = mysqlTable(
  "crew_competition_group_settings",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewCompetitionGroupSettingsId())
      .notNull(),
    competitionGroupId: varchar({ length: 255 }).notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    memoryMode: varchar({ length: 30 })
      .$type<CrewSeriesMemoryMode>()
      .default(CREW_SERIES_MEMORY_MODE.DISABLED)
      .notNull(),
    returningVolunteerConsentRequired: boolean().default(true).notNull(),
    historyVisibilityScope: varchar({ length: 30 })
      .$type<CrewVolunteerHistoryVisibilityScope>()
      .default(CREW_VOLUNTEER_HISTORY_VISIBILITY_SCOPE.SAME_ORGANIZER)
      .notNull(),
    createdByUserId: varchar({ length: 255 }),
    updatedByUserId: varchar({ length: 255 }),
  },
  (table) => [
    uniqueIndex("crew_competition_group_settings_group_unique_idx").on(
      table.competitionGroupId,
    ),
    index("crew_competition_group_settings_team_idx").on(table.teamId),
    index("crew_competition_group_settings_mode_idx").on(table.memoryMode),
    index("crew_competition_group_settings_created_by_idx").on(
      table.createdByUserId,
    ),
    index("crew_competition_group_settings_updated_by_idx").on(
      table.updatedByUserId,
    ),
  ],
)

export const crewEventConversionsTable = mysqlTable(
  "crew_event_conversions",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewEventConversionId())
      .notNull(),
    teamId: varchar({ length: 255 }).notNull(),
    competitionId: varchar({ length: 255 }).notNull(),
    crewEventSettingsId: varchar({ length: 255 }),
    competitionGroupId: varchar({ length: 255 }),
    status: varchar({ length: 30 })
      .$type<CrewEventConversionStatus>()
      .default(CREW_EVENT_CONVERSION_STATUS.REQUESTED)
      .notNull(),
    requestedByUserId: varchar({ length: 255 }),
    reviewedByUserId: varchar({ length: 255 }),
    completedByUserId: varchar({ length: 255 }),
    requestedAt: datetime()
      .$defaultFn(() => new Date())
      .notNull(),
    privacyReviewedAt: datetime(),
    completedAt: datetime(),
    cancelledAt: datetime(),
  },
  (table) => [
    uniqueIndex("crew_event_conversions_competition_unique_idx").on(
      table.competitionId,
    ),
    index("crew_event_conversions_team_idx").on(table.teamId),
    index("crew_event_conversions_settings_idx").on(table.crewEventSettingsId),
    index("crew_event_conversions_group_idx").on(table.competitionGroupId),
    index("crew_event_conversions_status_idx").on(table.status),
    index("crew_event_conversions_requested_by_idx").on(
      table.requestedByUserId,
    ),
    index("crew_event_conversions_reviewed_by_idx").on(table.reviewedByUserId),
    index("crew_event_conversions_completed_by_idx").on(
      table.completedByUserId,
    ),
  ],
)

export const crewVolunteerIntroRequestsTable = mysqlTable(
  "crew_volunteer_intro_requests",
  {
    ...commonColumns,
    id: varchar({ length: 255 })
      .primaryKey()
      .$defaultFn(() => createCrewVolunteerIntroRequestId())
      .notNull(),
    requestingTeamId: varchar({ length: 255 }).notNull(),
    requestingCompetitionId: varchar({ length: 255 }).notNull(),
    volunteerIdentityId: varchar({ length: 255 }).notNull(),
    discoveryConsentId: varchar({ length: 255 }).notNull(),
    requestedRoleType: varchar({ length: 50 }).$type<VolunteerRoleType>(),
    startsAt: datetime(),
    endsAt: datetime(),
    status: varchar({ length: 20 })
      .$type<CrewVolunteerIntroRequestStatus>()
      .default(CREW_VOLUNTEER_INTRO_REQUEST_STATUS.PENDING)
      .notNull(),
    requestedByUserId: varchar({ length: 255 }),
    requestedAt: datetime()
      .$defaultFn(() => new Date())
      .notNull(),
    respondedByUserId: varchar({ length: 255 }),
    respondedAt: datetime(),
    expiresAt: datetime(),
    resultInvitationId: varchar({ length: 255 }),
    resultMembershipId: varchar({ length: 255 }),
  },
  (table) => [
    index("crew_volunteer_intro_requests_requester_idx").on(
      table.requestingTeamId,
      table.requestingCompetitionId,
    ),
    index("crew_volunteer_intro_requests_identity_idx").on(
      table.volunteerIdentityId,
    ),
    index("crew_volunteer_intro_requests_consent_idx").on(
      table.discoveryConsentId,
    ),
    index("crew_volunteer_intro_requests_role_idx").on(
      table.requestedRoleType,
    ),
    index("crew_volunteer_intro_requests_status_idx").on(table.status),
    index("crew_volunteer_intro_requests_requested_by_idx").on(
      table.requestedByUserId,
    ),
    index("crew_volunteer_intro_requests_responded_by_idx").on(
      table.respondedByUserId,
    ),
    index("crew_volunteer_intro_requests_window_idx").on(
      table.startsAt,
      table.endsAt,
    ),
    index("crew_volunteer_intro_requests_expires_idx").on(table.expiresAt),
    index("crew_volunteer_intro_requests_result_invitation_idx").on(
      table.resultInvitationId,
    ),
    index("crew_volunteer_intro_requests_result_membership_idx").on(
      table.resultMembershipId,
    ),
  ],
)

export const crewVolunteerIdentitiesRelations = relations(
  crewVolunteerIdentitiesTable,
  ({ one, many }) => ({
    team: one(teamTable, {
      fields: [crewVolunteerIdentitiesTable.teamId],
      references: [teamTable.id],
    }),
    user: one(userTable, {
      fields: [crewVolunteerIdentitiesTable.userId],
      references: [userTable.id],
    }),
    sourceCompetition: one(competitionsTable, {
      fields: [crewVolunteerIdentitiesTable.sourceCompetitionId],
      references: [competitionsTable.id],
    }),
    sourceMembership: one(teamMembershipTable, {
      fields: [crewVolunteerIdentitiesTable.sourceMembershipId],
      references: [teamMembershipTable.id],
    }),
    sourceInvitation: one(teamInvitationTable, {
      fields: [crewVolunteerIdentitiesTable.sourceInvitationId],
      references: [teamInvitationTable.id],
    }),
    consents: many(crewVolunteerConsentsTable),
    historyEvents: many(crewVolunteerHistoryEventsTable),
    credentials: many(crewVolunteerCredentialsTable),
    introRequests: many(crewVolunteerIntroRequestsTable),
  }),
)

export const crewVolunteerConsentsRelations = relations(
  crewVolunteerConsentsTable,
  ({ one, many }) => ({
    identity: one(crewVolunteerIdentitiesTable, {
      fields: [crewVolunteerConsentsTable.identityId],
      references: [crewVolunteerIdentitiesTable.id],
    }),
    team: one(teamTable, {
      fields: [crewVolunteerConsentsTable.teamId],
      references: [teamTable.id],
    }),
    sourceCompetition: one(competitionsTable, {
      fields: [crewVolunteerConsentsTable.sourceCompetitionId],
      references: [competitionsTable.id],
    }),
    actor: one(userTable, {
      fields: [crewVolunteerConsentsTable.actorUserId],
      references: [userTable.id],
      relationName: "crewVolunteerConsentActor",
    }),
    recordedByUser: one(userTable, {
      fields: [crewVolunteerConsentsTable.recordedByUserId],
      references: [userTable.id],
      relationName: "crewVolunteerConsentRecordedBy",
    }),
    revokedByUser: one(userTable, {
      fields: [crewVolunteerConsentsTable.revokedByUserId],
      references: [userTable.id],
      relationName: "crewVolunteerConsentRevokedBy",
    }),
    supersededByConsent: one(crewVolunteerConsentsTable, {
      fields: [crewVolunteerConsentsTable.supersededByConsentId],
      references: [crewVolunteerConsentsTable.id],
      relationName: "crewVolunteerConsentSupersession",
    }),
    historyEvents: many(crewVolunteerHistoryEventsTable),
    credentials: many(crewVolunteerCredentialsTable),
    introRequests: many(crewVolunteerIntroRequestsTable),
  }),
)

export const crewVolunteerHistoryEventsRelations = relations(
  crewVolunteerHistoryEventsTable,
  ({ one }) => ({
    identity: one(crewVolunteerIdentitiesTable, {
      fields: [crewVolunteerHistoryEventsTable.identityId],
      references: [crewVolunteerIdentitiesTable.id],
    }),
    team: one(teamTable, {
      fields: [crewVolunteerHistoryEventsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewVolunteerHistoryEventsTable.competitionId],
      references: [competitionsTable.id],
    }),
    group: one(competitionGroupsTable, {
      fields: [crewVolunteerHistoryEventsTable.groupId],
      references: [competitionGroupsTable.id],
    }),
    sourceUser: one(userTable, {
      fields: [crewVolunteerHistoryEventsTable.sourceUserId],
      references: [userTable.id],
    }),
    consent: one(crewVolunteerConsentsTable, {
      fields: [crewVolunteerHistoryEventsTable.consentId],
      references: [crewVolunteerConsentsTable.id],
    }),
    correctionOfEvent: one(crewVolunteerHistoryEventsTable, {
      fields: [crewVolunteerHistoryEventsTable.correctionOfEventId],
      references: [crewVolunteerHistoryEventsTable.id],
      relationName: "crewVolunteerHistoryEventCorrection",
    }),
  }),
)

export const crewVolunteerCredentialsRelations = relations(
  crewVolunteerCredentialsTable,
  ({ one }) => ({
    identity: one(crewVolunteerIdentitiesTable, {
      fields: [crewVolunteerCredentialsTable.identityId],
      references: [crewVolunteerIdentitiesTable.id],
    }),
    team: one(teamTable, {
      fields: [crewVolunteerCredentialsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewVolunteerCredentialsTable.competitionId],
      references: [competitionsTable.id],
    }),
    verifiedByUser: one(userTable, {
      fields: [crewVolunteerCredentialsTable.verifiedByUserId],
      references: [userTable.id],
    }),
    consent: one(crewVolunteerConsentsTable, {
      fields: [crewVolunteerCredentialsTable.consentId],
      references: [crewVolunteerConsentsTable.id],
    }),
  }),
)

export const crewCompetitionGroupSettingsRelations = relations(
  crewCompetitionGroupSettingsTable,
  ({ one }) => ({
    group: one(competitionGroupsTable, {
      fields: [crewCompetitionGroupSettingsTable.competitionGroupId],
      references: [competitionGroupsTable.id],
    }),
    team: one(teamTable, {
      fields: [crewCompetitionGroupSettingsTable.teamId],
      references: [teamTable.id],
    }),
    createdByUser: one(userTable, {
      fields: [crewCompetitionGroupSettingsTable.createdByUserId],
      references: [userTable.id],
      relationName: "crewCompetitionGroupSettingsCreatedBy",
    }),
    updatedByUser: one(userTable, {
      fields: [crewCompetitionGroupSettingsTable.updatedByUserId],
      references: [userTable.id],
      relationName: "crewCompetitionGroupSettingsUpdatedBy",
    }),
  }),
)

export const crewEventConversionsRelations = relations(
  crewEventConversionsTable,
  ({ one }) => ({
    team: one(teamTable, {
      fields: [crewEventConversionsTable.teamId],
      references: [teamTable.id],
    }),
    competition: one(competitionsTable, {
      fields: [crewEventConversionsTable.competitionId],
      references: [competitionsTable.id],
    }),
    crewEventSettings: one(crewEventSettingsTable, {
      fields: [crewEventConversionsTable.crewEventSettingsId],
      references: [crewEventSettingsTable.id],
    }),
    competitionGroup: one(competitionGroupsTable, {
      fields: [crewEventConversionsTable.competitionGroupId],
      references: [competitionGroupsTable.id],
    }),
    requestedByUser: one(userTable, {
      fields: [crewEventConversionsTable.requestedByUserId],
      references: [userTable.id],
      relationName: "crewEventConversionRequestedBy",
    }),
    reviewedByUser: one(userTable, {
      fields: [crewEventConversionsTable.reviewedByUserId],
      references: [userTable.id],
      relationName: "crewEventConversionReviewedBy",
    }),
    completedByUser: one(userTable, {
      fields: [crewEventConversionsTable.completedByUserId],
      references: [userTable.id],
      relationName: "crewEventConversionCompletedBy",
    }),
  }),
)

export const crewVolunteerIntroRequestsRelations = relations(
  crewVolunteerIntroRequestsTable,
  ({ one }) => ({
    requestingTeam: one(teamTable, {
      fields: [crewVolunteerIntroRequestsTable.requestingTeamId],
      references: [teamTable.id],
    }),
    requestingCompetition: one(competitionsTable, {
      fields: [crewVolunteerIntroRequestsTable.requestingCompetitionId],
      references: [competitionsTable.id],
    }),
    volunteerIdentity: one(crewVolunteerIdentitiesTable, {
      fields: [crewVolunteerIntroRequestsTable.volunteerIdentityId],
      references: [crewVolunteerIdentitiesTable.id],
    }),
    discoveryConsent: one(crewVolunteerConsentsTable, {
      fields: [crewVolunteerIntroRequestsTable.discoveryConsentId],
      references: [crewVolunteerConsentsTable.id],
    }),
    requestedByUser: one(userTable, {
      fields: [crewVolunteerIntroRequestsTable.requestedByUserId],
      references: [userTable.id],
      relationName: "crewVolunteerIntroRequestRequestedBy",
    }),
    respondedByUser: one(userTable, {
      fields: [crewVolunteerIntroRequestsTable.respondedByUserId],
      references: [userTable.id],
      relationName: "crewVolunteerIntroRequestRespondedBy",
    }),
    resultInvitation: one(teamInvitationTable, {
      fields: [crewVolunteerIntroRequestsTable.resultInvitationId],
      references: [teamInvitationTable.id],
    }),
    resultMembership: one(teamMembershipTable, {
      fields: [crewVolunteerIntroRequestsTable.resultMembershipId],
      references: [teamMembershipTable.id],
    }),
  }),
)

export type CrewVolunteerIdentity = InferSelectModel<
  typeof crewVolunteerIdentitiesTable
>
export type NewCrewVolunteerIdentity =
  typeof crewVolunteerIdentitiesTable.$inferInsert
export type CrewVolunteerConsent = InferSelectModel<
  typeof crewVolunteerConsentsTable
>
export type NewCrewVolunteerConsent =
  typeof crewVolunteerConsentsTable.$inferInsert
export type CrewVolunteerHistoryEvent = InferSelectModel<
  typeof crewVolunteerHistoryEventsTable
>
export type NewCrewVolunteerHistoryEvent =
  typeof crewVolunteerHistoryEventsTable.$inferInsert
export type CrewVolunteerCredential = InferSelectModel<
  typeof crewVolunteerCredentialsTable
>
export type NewCrewVolunteerCredential =
  typeof crewVolunteerCredentialsTable.$inferInsert
export type CrewCompetitionGroupSettings = InferSelectModel<
  typeof crewCompetitionGroupSettingsTable
>
export type NewCrewCompetitionGroupSettings =
  typeof crewCompetitionGroupSettingsTable.$inferInsert
export type CrewEventConversion = InferSelectModel<
  typeof crewEventConversionsTable
>
export type NewCrewEventConversion =
  typeof crewEventConversionsTable.$inferInsert
export type CrewVolunteerIntroRequest = InferSelectModel<
  typeof crewVolunteerIntroRequestsTable
>
export type NewCrewVolunteerIntroRequest =
  typeof crewVolunteerIntroRequestsTable.$inferInsert
