// Re-export all tables and types from schema modules

export * from "./schemas/addresses"
export * from "./schemas/coupons"
export * from "./schemas/affiliates"
export * from "./schemas/broadcasts"
export * from "./schemas/billing"
export * from "./schemas/commerce"
export * from "./schemas/common"
export * from "./schemas/competition-invites"
export * from "./schemas/competitions"
// @lat: [[crew#Crew Billing State And Audit]]
export * from "./schemas/crew-billing-events"
export * from "./schemas/crew-event-settings"
// `@lat`: [[crew#Add Thin Crew Tables]]
export * from "./schemas/crew-imports"
// @lat: [[crew#Self Serve Preset Schema]]
export * from "./schemas/crew-self-serve-presets"
// @lat: [[crew#Strategic Moat Privacy Model]]
export * from "./schemas/crew-volunteer-intelligence"
export * from "./schemas/entitlements"
export * from "./schemas/event-division-mappings"
export * from "./schemas/event-resources"
export * from "./schemas/financial-events"
export * from "./schemas/judging-sheets"
export * from "./schemas/notifications"
export * from "./schemas/organizer-requests"
export * from "./schemas/programming"
export * from "./schemas/route-docs"
export * from "./schemas/scaling"
export * from "./schemas/series"
export * from "./schemas/scheduling"
export * from "./schemas/scores"
export * from "./schemas/sponsors"
export * from "./schemas/teams"
export * from "./schemas/users"
export * from "./schemas/review-notes"
export * from "./schemas/video-submissions"
export * from "./schemas/video-votes"
export * from "./schemas/volunteers"
export * from "./schemas/waivers"
export * from "./schemas/workouts"

// Note: Cross-schema relations have been merged into their primary definitions
// teamTable relations (including programmingTracks) are in schemas/teams.ts
