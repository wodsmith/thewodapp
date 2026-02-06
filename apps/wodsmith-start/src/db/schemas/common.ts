import { createId } from "@paralleldrive/cuid2"
import { sql } from "drizzle-orm"
import { integer } from "drizzle-orm/sqlite-core"

// Common columns used across all tables
export const commonColumns = {
	createdAt: integer({
		mode: "timestamp",
	})
		.$defaultFn(() => new Date())
		.notNull(),
	updatedAt: integer({
		mode: "timestamp",
	})
		.$onUpdateFn(() => new Date())
		.notNull(),
	updateCounter: integer()
		.default(0)
		.$onUpdate(() => sql`updateCounter + 1`),
}

// Common ID generation functions
export const createUserId = () => `usr_${createId()}`
export const createTeamId = () => `team_${createId()}`
export const createPasskeyId = () => `pkey_${createId()}`
export const createCreditTransactionId = () => `ctxn_${createId()}`
export const createPurchasedItemId = () => `pitem_${createId()}`
export const createTeamMembershipId = () => `tmem_${createId()}`
export const createTeamRoleId = () => `trole_${createId()}`
export const createTeamInvitationId = () => `tinv_${createId()}`
export const createProgrammingTrackId = () => `ptrk_${createId()}`
export const createTrackWorkoutId = () => `trwk_${createId()}`
export const createScheduledWorkoutInstanceId = () => `swi_${createId()}`
export const createProgrammingTrackPaymentId = () => `ptpay_${createId()}`
export const createLocationId = () => `loc_${createId()}`
export const createSkillId = () => `skl_${createId()}`
export const createClassCatalogId = () => `clsc_${createId()}`
export const createTagId = () => `tag_${createId()}`
export const createScalingGroupId = () => `sgrp_${createId()}`
export const createScalingLevelId = () => `slvl_${createId()}`
export const createWorkoutScalingDescriptionId = () => `wsd_${createId()}`

// Entitlement system ID generators
export const createEntitlementTypeId = () => `etype_${createId()}`
export const createEntitlementId = () => `ent_${createId()}`
export const createFeatureId = () => `feat_${createId()}`
export const createLimitId = () => `lim_${createId()}`
export const createPlanId = () => `plan_${createId()}`
export const createPlanFeatureId = () => `pfeat_${createId()}`
export const createPlanLimitId = () => `plim_${createId()}`
export const createTeamSubscriptionId = () => `tsub_${createId()}`
export const createTeamAddonId = () => `tadd_${createId()}`
export const createTeamEntitlementOverrideId = () => `tover_${createId()}`
export const createTeamUsageId = () => `tusage_${createId()}`
export const createTeamFeatureEntitlementId = () => `tfent_${createId()}`
export const createTeamLimitEntitlementId = () => `tlent_${createId()}`

// Competition platform ID generators
export const createCompetitionGroupId = () => `cgrp_${createId()}`
export const createCompetitionId = () => `comp_${createId()}`
export const createCompetitionRegistrationId = () => `creg_${createId()}`
export const createCompetitionRegistrationTeammateId = () =>
	`crmt_${createId()}`
export const createAffiliateId = () => `aff_${createId()}`

// Commerce ID generators
export const createCommerceProductId = () => `cprod_${createId()}`
export const createCommercePurchaseId = () => `cpur_${createId()}`
export const createCompetitionDivisionFeeId = () => `cdfee_${createId()}`

// Competition heat scheduling ID generators
export const createCompetitionVenueId = () => `cvenue_${createId()}`
export const createCompetitionHeatId = () => `cheat_${createId()}`
export const createCompetitionHeatAssignmentId = () => `chasgn_${createId()}`
export const createHeatVolunteerId = () => `hvol_${createId()}`
export const createJudgeRotationId = () => `jrot_${createId()}`
export const createJudgeAssignmentVersionId = () => `jver_${createId()}`

// Sponsor ID generators
export const createSponsorGroupId = () => `spgrp_${createId()}`
export const createSponsorId = () => `spnsr_${createId()}`

// Organizer request ID generators
export const createOrganizerRequestId = () => `oreq_${createId()}`

// Competition registration question ID generators
export const createCompetitionRegistrationQuestionId = () => `crq_${createId()}`
export const createCompetitionRegistrationAnswerId = () => `cra_${createId()}`

// Competition event ID generators (per-event settings for online competitions)
export const createCompetitionEventId = () => `cevt_${createId()}`

// Event resource ID generators
export const createEventResourceId = () => `eres_${createId()}`

// Judging sheet ID generators
export const createEventJudgingSheetId = () => `ejsheet_${createId()}`

// Address ID generators
export const createAddressId = () => `addr_${createId()}`

// Onboarding ID generators
export const createOnboardingStateId = () => `obs_${createId()}`
