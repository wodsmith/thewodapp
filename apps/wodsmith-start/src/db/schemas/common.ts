import { ulid } from "ulid"
import { sql } from "drizzle-orm"
import { datetime, int } from "drizzle-orm/mysql-core"

/**
 * Common columns used across all tables
 *
 * All timestamps are stored as UTC ISO 8601 datetime
 * Format: 'YYYY-MM-DD HH:MM:SS' (e.g., '2024-01-15 14:30:00')
 *
 * Migration: Epoch integers → UTC ISO 8601 datetime
 * - Epoch seconds: value * 1000 → new Date() → toISOString()
 * - Stored in MySQL datetime column (not timestamp)
 */
export const commonColumns = {
	createdAt: datetime("created_at")
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: datetime("updated_at")
		.$defaultFn(() => new Date())
		.$onUpdateFn(() => new Date())
		.notNull(),
	updateCounter: int("update_counter")
		.default(0)
		.$onUpdate(() => sql`update_counter + 1`),
}

// Common ID generation functions using ULID for sortable unique IDs
export const createUserId = () => `usr_${ulid()}`
export const createTeamId = () => `team_${ulid()}`
export const createPasskeyId = () => `pkey_${ulid()}`
export const createCreditTransactionId = () => `ctxn_${ulid()}`
export const createPurchasedItemId = () => `pitem_${ulid()}`
export const createTeamMembershipId = () => `tmem_${ulid()}`
export const createTeamRoleId = () => `trole_${ulid()}`
export const createTeamInvitationId = () => `tinv_${ulid()}`
export const createProgrammingTrackId = () => `ptrk_${ulid()}`
export const createTrackWorkoutId = () => `trwk_${ulid()}`
export const createScheduledWorkoutInstanceId = () => `swi_${ulid()}`
export const createProgrammingTrackPaymentId = () => `ptpay_${ulid()}`
export const createLocationId = () => `loc_${ulid()}`
export const createSkillId = () => `skl_${ulid()}`
export const createClassCatalogId = () => `clsc_${ulid()}`
export const createTagId = () => `tag_${ulid()}`
export const createScalingGroupId = () => `sgrp_${ulid()}`
export const createScalingLevelId = () => `slvl_${ulid()}`
export const createWorkoutScalingDescriptionId = () => `wsd_${ulid()}`

// Entitlement system ID generators
export const createEntitlementTypeId = () => `etype_${ulid()}`
export const createEntitlementId = () => `ent_${ulid()}`
export const createFeatureId = () => `feat_${ulid()}`
export const createLimitId = () => `lim_${ulid()}`
export const createPlanId = () => `plan_${ulid()}`
export const createPlanFeatureId = () => `pfeat_${ulid()}`
export const createPlanLimitId = () => `plim_${ulid()}`
export const createTeamSubscriptionId = () => `tsub_${ulid()}`
export const createTeamAddonId = () => `tadd_${ulid()}`
export const createTeamEntitlementOverrideId = () => `tover_${ulid()}`
export const createTeamUsageId = () => `tusage_${ulid()}`
export const createTeamFeatureEntitlementId = () => `tfent_${ulid()}`
export const createTeamLimitEntitlementId = () => `tlent_${ulid()}`

// Competition platform ID generators
export const createCompetitionGroupId = () => `cgrp_${ulid()}`
export const createCompetitionId = () => `comp_${ulid()}`
export const createCompetitionRegistrationId = () => `creg_${ulid()}`
export const createCompetitionRegistrationTeammateId = () =>
	`crmt_${ulid()}`
export const createAffiliateId = () => `aff_${ulid()}`

// Commerce ID generators
export const createCommerceProductId = () => `cprod_${ulid()}`
export const createCommercePurchaseId = () => `cpur_${ulid()}`
export const createCompetitionDivisionFeeId = () => `cdfee_${ulid()}`

// Competition heat scheduling ID generators
export const createCompetitionVenueId = () => `cvenue_${ulid()}`
export const createCompetitionHeatId = () => `cheat_${ulid()}`
export const createCompetitionHeatAssignmentId = () => `chasgn_${ulid()}`
export const createHeatVolunteerId = () => `hvol_${ulid()}`
export const createJudgeRotationId = () => `jrot_${ulid()}`
export const createJudgeAssignmentVersionId = () => `jver_${ulid()}`

// Sponsor ID generators
export const createSponsorGroupId = () => `spgrp_${ulid()}`
export const createSponsorId = () => `spnsr_${ulid()}`

// Organizer request ID generators
export const createOrganizerRequestId = () => `oreq_${ulid()}`

// Competition registration question ID generators
export const createCompetitionRegistrationQuestionId = () => `crq_${ulid()}`
export const createCompetitionRegistrationAnswerId = () => `cra_${ulid()}`

// Competition event ID generators (per-event settings for online competitions)
export const createCompetitionEventId = () => `cevt_${ulid()}`

// Event resource ID generators
export const createEventResourceId = () => `eres_${ulid()}`

// Judging sheet ID generators
export const createEventJudgingSheetId = () => `ejsheet_${ulid()}`

// Address ID generators
export const createAddressId = () => `addr_${ulid()}`
