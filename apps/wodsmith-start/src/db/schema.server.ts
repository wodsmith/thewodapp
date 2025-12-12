// Re-export all tables and types from schema modules

export * from "./schemas/affiliates.server"
export * from "./schemas/billing.server"
export * from "./schemas/commerce.server"
export * from "./schemas/common.server"
export * from "./schemas/competitions.server"
export * from "./schemas/entitlements.server"
export * from "./schemas/programming.server"
export * from "./schemas/scaling.server"
export * from "./schemas/scheduling.server"
export * from "./schemas/scores.server"
export * from "./schemas/sponsors.server"
export * from "./schemas/teams.server"
export * from "./schemas/users.server"
export * from "./schemas/workouts.server"

// Cross-schema relations to ensure proper relation names and avoid conflicts
import { relations } from "drizzle-orm"
import { programmingTracksTable } from "./schemas/programming.server"
import { teamTable } from "./schemas/teams.server"

// Team reverse relations for programming tracks
export const teamReverseRelations = relations(teamTable, ({ many }) => ({
	programmingTracks: many(programmingTracksTable),
}))
