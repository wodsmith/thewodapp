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

// Note: Cross-schema relations have been merged into their primary definitions
// teamTable relations (including programmingTracks) are in schemas/teams.ts
