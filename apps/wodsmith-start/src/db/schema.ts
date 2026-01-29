// Re-export all tables and types from schema modules

export * from "./schemas/addresses"
export * from "./schemas/affiliates"
export * from "./schemas/billing"
export * from "./schemas/commerce"
export * from "./schemas/common"
export * from "./schemas/competitions"
export * from "./schemas/entitlements"
export * from "./schemas/event-resources"
export * from "./schemas/judging-sheets"
export * from "./schemas/notifications"
export * from "./schemas/organizer-requests"
export * from "./schemas/programming"
export * from "./schemas/scaling"
export * from "./schemas/scheduling"
export * from "./schemas/scores"
export * from "./schemas/sponsors"
export * from "./schemas/teams"
export * from "./schemas/users"
export * from "./schemas/video-submissions"
export * from "./schemas/volunteers"
export * from "./schemas/waivers"
export * from "./schemas/workouts"

// Cross-schema relations to ensure proper relation names and avoid conflicts
import { relations } from "drizzle-orm"
import { programmingTracksTable } from "./schemas/programming"
import { teamTable } from "./schemas/teams"

// Team reverse relations for programming tracks
export const teamReverseRelations = relations(teamTable, ({ many }) => ({
	programmingTracks: many(programmingTracksTable),
}))
