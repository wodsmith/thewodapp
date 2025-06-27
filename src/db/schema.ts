// Re-export all tables and types from schema modules
export * from "./schemas/common"
export * from "./schemas/users"
export * from "./schemas/billing"
export * from "./schemas/teams"
export * from "./schemas/workouts"
export * from "./schemas/programming"

import { creditTransactionTable, purchasedItemsTable } from "./schemas/billing"
import {
	programmingTracksTable,
	scheduledWorkoutInstancesTable,
	trackWorkoutsTable,
} from "./schemas/programming"
import {
	teamInvitationTable,
	teamMembershipTable,
	teamRoleTable,
	teamTable,
} from "./schemas/teams"
// Import all tables for relations and re-export them
import { passKeyCredentialTable, userTable } from "./schemas/users"
import {
	movements,
	results,
	sets,
	tags,
	workoutMovements,
	workoutTags,
	workouts,
} from "./schemas/workouts"

// Cross-schema relations to ensure proper relation names and avoid conflicts
import { relations } from "drizzle-orm"

// Team reverse relations for programming tracks
export const teamReverseRelations = relations(teamTable, ({ many }) => ({
	programmingTracks: many(programmingTracksTable),
}))
