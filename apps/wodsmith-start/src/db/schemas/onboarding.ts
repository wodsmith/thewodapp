import type { InferSelectModel } from "drizzle-orm"
import { relations } from "drizzle-orm"
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { commonColumns, createOnboardingStateId } from "./common"
import { competitionsTable } from "./competitions"
import { teamTable } from "./teams"
import { userTable } from "./users"

/**
 * Onboarding State Table
 *
 * Tracks onboarding progress per user/team/competition.
 * Used for setup checklists, page tips dismissal, and guided tour completion.
 */
export const onboardingStateTable = sqliteTable(
	"onboarding_state",
	{
		...commonColumns,
		id: text()
			.primaryKey()
			.$defaultFn(() => createOnboardingStateId())
			.notNull(),
		userId: text()
			.notNull()
			.references(() => userTable.id, { onDelete: "cascade" }),
		teamId: text()
			.notNull()
			.references(() => teamTable.id, { onDelete: "cascade" }),
		// Nullable: some onboarding state is team-level, not competition-specific
		competitionId: text().references(() => competitionsTable.id, {
			onDelete: "cascade",
		}),
		// Key identifies what this state tracks (e.g., "checklist_dismissed", "divisions_tip_dismissed")
		key: text({ length: 255 }).notNull(),
		// Whether the step/tip is completed/dismissed
		completed: integer({ mode: "boolean" }).default(false).notNull(),
		completedAt: integer({ mode: "timestamp" }),
		// JSON metadata for partial progress or extra context
		metadata: text({ length: 5000 }),
	},
	(table) => [
		// Unique constraint: one state per user+team+competition+key
		uniqueIndex("onboarding_state_unique_idx").on(
			table.userId,
			table.teamId,
			table.competitionId,
			table.key,
		),
		index("onboarding_state_user_idx").on(table.userId),
		index("onboarding_state_team_idx").on(table.teamId),
		index("onboarding_state_competition_idx").on(table.competitionId),
	],
)

// Type exports
export type OnboardingState = InferSelectModel<typeof onboardingStateTable>

// Relations
export const onboardingStateRelations = relations(
	onboardingStateTable,
	({ one }) => ({
		user: one(userTable, {
			fields: [onboardingStateTable.userId],
			references: [userTable.id],
		}),
		team: one(teamTable, {
			fields: [onboardingStateTable.teamId],
			references: [teamTable.id],
		}),
		competition: one(competitionsTable, {
			fields: [onboardingStateTable.competitionId],
			references: [competitionsTable.id],
		}),
	}),
)

// Onboarding state keys
export const ONBOARDING_KEYS = {
	// Setup checklist
	CHECKLIST_DISMISSED: "checklist_dismissed",
	// Individual checklist steps (auto-detected ones don't need state)
	CHECKLIST_PREVIEW_PUBLIC_PAGE: "checklist_preview_public_page",
} as const

export type OnboardingKey =
	(typeof ONBOARDING_KEYS)[keyof typeof ONBOARDING_KEYS]
