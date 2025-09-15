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
