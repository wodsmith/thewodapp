/**
 * Feature flags for the entitlement system
 * Features are specific capabilities that can be enabled/disabled per team
 *
 * NOTE: This file only contains constant keys for type safety.
 * Actual feature metadata (name, description, category) is stored in the database.
 * Use getAllFeatures() or getFeatureByKey() from @/server/entitlements to query feature metadata.
 */

export const FEATURES = {
  // Core workout features
  BASIC_WORKOUTS: "basic_workouts",

  // Programming features (PRIORITY - Sellable)
  PROGRAMMING_TRACKS: "programming_tracks",
  PROGRAM_CALENDAR: "program_calendar",
  PROGRAM_ANALYTICS: "program_analytics",

  // Scaling features
  CUSTOM_SCALING_GROUPS: "custom_scaling_groups",

  // AI features (PRIORITY - Coming Soon)
  AI_WORKOUT_GENERATION: "ai_workout_generation",
  AI_PROGRAMMING_ASSISTANT: "ai_programming_assistant",
  AI_JUDGE_SCHEDULING: "ai_judge_scheduling",

  // Team features (PRIORITY - Core Monetization)
  MULTI_TEAM_MANAGEMENT: "multi_team_management",

  // Competition platform features
  HOST_COMPETITIONS: "host_competitions",
  PRODUCT_COUPONS: "product_coupons",

  // `@lat`: [[crew#Crew Billing Catalog]]
  // Crew event operations features
  CREW_EVENTS: "crew_events",
  CREW_IMPORTS: "crew_imports",
  CREW_CONFIRMATION_REMINDERS: "crew_confirmation_reminders",
  CREW_DEPARTMENT_LEADS: "crew_department_leads",
  CREW_EXPORTS: "crew_exports",
  CREW_CONCIERGE: "crew_concierge",

  // Personal workout tracking
  WORKOUT_TRACKING: "workout_tracking",
} as const

export type FeatureId = (typeof FEATURES)[keyof typeof FEATURES]
