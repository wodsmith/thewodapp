/**
 * Usage limits and quotas for the entitlement system
 * Limits are countable resources that can be restricted per plan
 * -1 indicates unlimited
 *
 * NOTE: This file only contains constant keys for type safety.
 * Actual limit metadata (name, description, unit, resetPeriod) is stored in the database.
 * Use getAllLimits() or getLimitByKey() from @/server/entitlements to query limit metadata.
 */

export const LIMITS = {
  // NOTE: No limits on workouts, movements, or scheduled workouts - unlimited for all plans

  // Team limits (PRIORITY - Core Monetization)
  MAX_MEMBERS_PER_TEAM: 'max_members_per_team', // Free: 5, Paid: higher limits
  MAX_ADMINS: 'max_admins',

  // Programming limits (PRIORITY - Sellable)
  MAX_PROGRAMMING_TRACKS: 'max_programming_tracks', // Free: 5, Paid: unlimited

  // AI usage limits (PRIORITY - Coming Soon)
  AI_MESSAGES_PER_MONTH: 'ai_messages_per_month', // Free: 10-20, Paid: 200+

  // Competition organizing limits
  MAX_PUBLISHED_COMPETITIONS: 'max_published_competitions', // 0: pending approval, -1: unlimited
} as const

export type LimitKey = (typeof LIMITS)[keyof typeof LIMITS]
