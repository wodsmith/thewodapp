// Re-export all tables and types from schema modules

export * from "./schemas/affiliates"
export * from "./schemas/billing"
export * from "./schemas/common"
export * from "./schemas/competitions"
export * from "./schemas/entitlements"
export * from "./schemas/programming"
export * from "./schemas/scaling"
export * from "./schemas/scheduling"
export * from "./schemas/teams"
export * from "./schemas/users"
export * from "./schemas/workouts"

// Cross-schema relations to ensure proper relation names and avoid conflicts
import { relations } from "drizzle-orm"
import { competitionsTable } from "./schemas/competitions"
import { programmingTracksTable } from "./schemas/programming"
import { teamTable } from "./schemas/teams"

// Team reverse relations for programming tracks
export const teamReverseRelations = relations(teamTable, ({ many }) => ({
	programmingTracks: many(programmingTracksTable),
}))

// Competition reverse relations for programming tracks (events)
export const competitionReverseRelations = relations(
	competitionsTable,
	({ many }) => ({
		programmingTrack: many(programmingTracksTable),
	}),
)
