# Entitlements System Architecture Plan

## Executive Summary

This document outlines the plan to upgrade TheWodApp from a role-based permissions system to a comprehensive **entitlements-based system** that separates billing, entitlements, and permissions into distinct layers. This separation will enable flexible pricing models, feature gating, and scalable product offerings while maintaining security and user experience.

## Current State Analysis

### Existing Systems

#### 1. Role-Based Permissions (RBAC)
**Location**: `src/db/schemas/teams.ts`

**System Roles**:
- `OWNER` - Full access to all features
- `ADMIN` - Administrative access
- `MEMBER` - Standard member access
- `GUEST` - Limited read-only access

**Permissions** (19 total):
```typescript
ACCESS_DASHBOARD, ACCESS_BILLING
INVITE_MEMBERS, REMOVE_MEMBERS, CHANGE_MEMBER_ROLES
EDIT_TEAM_SETTINGS, DELETE_TEAM
CREATE_ROLES, EDIT_ROLES, DELETE_ROLES, ASSIGN_ROLES
CREATE_COMPONENTS, EDIT_COMPONENTS, DELETE_COMPONENTS
MANAGE_PROGRAMMING, MANAGE_SCALING_GROUPS
```

**Permission Assignment**:
- System roles have hardcoded permissions (e.g., OWNER/ADMIN get all permissions)
- Custom roles store permissions as JSON array
- Users inherit permissions from their role(s) in each team
- Permissions are checked via `hasTeamPermission()`, `requireTeamPermission()`

#### 2. Credit-Based Billing
**Location**: `src/db/schemas/billing.ts`

**Current Implementation**:
- User-level credits (`users.currentCredits`)
- Team-level credit balance (`teams.creditBalance`)
- Monthly free credit refresh
- Credit expiration tracking
- Purchased items tracking (components, templates)

**Issues**:
- No concept of plans or subscriptions
- Everyone is currently a "free user"
- No distinction between free vs paid features
- Credit system exists but not tied to feature access
- Billing is at user level but teams are the organizational unit

#### 3. Multi-Tenancy (Team-Based)
**Location**: `src/db/schemas/teams.ts`

- All data scoped to teams via `teamId`
- Users can belong to multiple teams
- Personal teams created for each user
- Team switching capability

### Problems with Current Approach

1. **Tightly Coupled**: Billing, permissions, and feature access are not separated
2. **Inflexible Pricing**: Can't easily create different plan tiers (Free, Pro, Enterprise)
3. **Hard to Gate Features**: No system to restrict features based on plan
4. **No Usage Limits**: Can't enforce limits like "10 workouts per month" for free users
5. **Manual Feature Rollout**: New features require code changes to gate them
6. **Poor Monetization**: Can't trial features, offer addons, or create complex pricing
7. **Cross-Cutting Concerns**: Billing logic mixed with business logic throughout codebase

## Inspiration: Course-Builder Entitlement Pattern

After researching the [badass-courses/course-builder](https://github.com/badass-courses/course-builder) entitlement system, we've identified a powerful pattern that complements the three-layer architecture:

### Course-Builder's Key Insight

**Entitlements are explicit records of granted access**, not just configuration. This provides:

1. **Audit Trail**: Every access grant is a database record with timestamps
2. **Event Sourcing**: Purchases/subscriptions create entitlements, which grant access
3. **Flexible Sources**: Entitlements can come from:
   - `PURCHASE` - One-time purchases
   - `SUBSCRIPTION` - Recurring subscriptions
   - `MANUAL` - Manual grants by admins
4. **Soft Deletion**: Revoke access while maintaining history (set `deletedAt`)
5. **Per-User Granularity**: Individual access grants, not just team-level

### Their Schema Pattern

```typescript
// entitlementTypes table - defines categories of access
{
  id: string
  name: string (unique) // e.g., "cohort_content_access", "subscription_tier"
  description: string
}

// entitlements table - actual access grants
{
  id: string
  entitlementType: string        // FK to entitlementTypes
  userId: string                 // who has this access
  organizationId: string         // org context
  sourceType: 'PURCHASE' | 'SUBSCRIPTION' | 'MANUAL'
  sourceId: string               // FK to purchase/subscription/etc
  metadata: json                 // type-specific data (contentIds, features, etc)
  expiresAt: timestamp           // optional expiration
  deletedAt: timestamp           // soft delete for audit trail
  createdAt, updatedAt
}
```

### How They Check Access

**Direct database queries**: Query the `entitlements` table to check if user has active entitlements:
```sql
SELECT * FROM entitlements
WHERE userId = ?
  AND entitlementType = ?
  AND deletedAt IS NULL
  AND (expiresAt IS NULL OR expiresAt > NOW())
```

### Workflow Example

```
User purchases course
  → Create purchase record
  → Create entitlement(sourceType: PURCHASE, sourceId: purchaseId, type: 'cohort_content_access')
  → User now has access to content
  → To revoke: SET deletedAt = NOW()
```

## The Three-Layer Architecture + Entitlements

Based on the article "Why You Should Separate Your Billing from Entitlement" and the course-builder pattern, we need a **hybrid approach**:

```
┌─────────────────────────────────────────┐
│         1. PERMISSIONS LAYER            │
│  "What can this USER do?"               │
│  - User roles (owner, admin, member)    │
│  - Action-level permissions             │
│  - UI/UX access control                 │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│    2. ENTITLEMENTS LAYER (HYBRID)       │
│  "What access has been granted?"        │
│                                          │
│  A. TEAM-LEVEL (Plan-Based)             │
│    - Feature flags (plan includes X)    │
│    - Usage limits (team can do Y)       │
│    - Checked via: getTeamPlan()         │
│                                          │
│  B. USER-LEVEL (Event-Sourced)          │
│    - Explicit entitlement records       │
│    - Individual purchases/grants        │
│    - Checked via: getUserEntitlements() │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│         3. BILLING LAYER                │
│  "What has this TEAM/USER paid for?"    │
│  - Team subscriptions & invoices        │
│  - Individual purchases                 │
│  - Payment processing (Stripe)          │
│  - Credits & transactions               │
│  - Billing history                      │
└─────────────────────────────────────────┘
```

### Layer Definitions

#### Layer 1: Permissions (User-Level)
**Purpose**: Control what individual users can do within a team based on their role

**Examples**:
- Can this user edit workouts?
- Can this user invite members?
- Can this user delete components?

**Implementation**: Keep existing RBAC system largely intact

#### Layer 2: Entitlements (Hybrid: Team + User Level)
**Purpose**: Control what features and resources are accessible, using two complementary systems

**2A. Team-Level (Plan-Based) - For Team-Wide Features**:
- Can this team access programming tracks?
- How many workouts can this team create per month?
- Can this team use custom branding?
- Implementation: Check team's current plan and limits

**2B. User-Level (Event-Sourced) - For Individual Grants**:
- Did this user purchase a specific component?
- Was this user manually granted trial access to a feature?
- Does this user have a personal subscription seat?
- Implementation: Query entitlements table for active records

**When to use which**:
- **Plan-based**: Shared team resources, usage limits, feature access included in subscription
- **Entitlement-based**: Individual purchases, manual grants, trials, seat-based licensing, audit requirements

#### Layer 3: Billing (Team-Level)
**Purpose**: Track payments, subscriptions, and financial transactions

**Examples**:
- Is this team's subscription active?
- When does their plan renew?
- How many credits have they purchased?
- What's their billing history?

**Implementation**: Keep existing credit system, add Stripe subscription management

## Proposed Entitlements System

### Core Concepts

#### 1. Plans (Subscription Tiers)

```typescript
// Example plan structure
const PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    entitlements: {
      features: [
        'basic_workouts',
        'basic_scaling',
        'team_collaboration',
        'basic_analytics',
      ],
      limits: {
        max_teams: 1,                      // PRIORITY: Only 1 team
        max_members_per_team: 5,           // PRIORITY: 5 members per team
        max_programming_tracks: 5,         // PRIORITY: 5 programming tracks
        ai_generations_per_month: 5,       // PRIORITY: Limited AI usage
        ai_suggestions_per_month: 10,
        // NOTE: No limits on workouts, movements, or scheduled workouts - unlimited for all plans
      }
    }
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    interval: 'month',
    entitlements: {
      features: [
        'basic_workouts',
        'advanced_workouts',
        'workout_library',
        'programming_tracks',            // PRIORITY: Full programming access
        'program_calendar',
        'basic_scaling',
        'advanced_scaling',
        'ai_workout_generation',         // PRIORITY: AI features included
        'ai_workout_suggestions',
        'multi_team_management',         // PRIORITY: Unlimited teams
        'team_collaboration',
        'basic_analytics',
      ],
      limits: {
        max_teams: -1,                   // PRIORITY: Unlimited teams (excluding personal)
        max_members_per_team: 25,        // PRIORITY: 25 members per team
        max_programming_tracks: -1,      // PRIORITY: Unlimited programming tracks
        ai_messages_per_month: 200,      // PRIORITY: 200 AI messages/month
        // NOTE: No limits on workouts, movements, or scheduled workouts - unlimited for all plans
      }
    }
  },
  ENTERPRISE: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    interval: 'month',
    entitlements: {
      features: [
        'basic_workouts',
        'advanced_workouts',
        'workout_library',
        'programming_tracks',
        'program_calendar',
        'program_analytics',             // Additional analytics
        'basic_scaling',
        'advanced_scaling',
        'custom_scaling_groups',
        'ai_workout_generation',
        'ai_workout_suggestions',
        'ai_programming_assistant',       // Advanced AI features
        'multi_team_management',
        'team_collaboration',
        'custom_branding',
        'api_access',
        'basic_analytics',
        'advanced_analytics',
        'custom_reports',
      ],
      limits: {
        max_teams: -1,                   // Unlimited teams (excluding personal)
        max_members_per_team: -1,        // Unlimited members
        max_programming_tracks: -1,      // Unlimited programming tracks
        ai_messages_per_month: -1,       // Unlimited AI messages
        // NOTE: No limits on workouts, movements, or scheduled workouts - unlimited for all plans
      }
    }
  }
}
```

#### 2. Feature Flags

Feature flags are specific capabilities that can be enabled/disabled per team:

```typescript
// Feature categories
const FEATURES = {
  // Core workout features
  BASIC_WORKOUTS: 'basic_workouts',
  ADVANCED_WORKOUTS: 'advanced_workouts',
  WORKOUT_LIBRARY: 'workout_library',

  // Programming features (PRIORITY - Sellable)
  PROGRAMMING_TRACKS: 'programming_tracks',
  PROGRAM_CALENDAR: 'program_calendar',
  PROGRAM_ANALYTICS: 'program_analytics',

  // Scaling features
  BASIC_SCALING: 'basic_scaling',
  ADVANCED_SCALING: 'advanced_scaling',
  CUSTOM_SCALING_GROUPS: 'custom_scaling_groups',

  // AI features (PRIORITY - Coming Soon)
  AI_WORKOUT_GENERATION: 'ai_workout_generation',
  AI_WORKOUT_SUGGESTIONS: 'ai_workout_suggestions',
  AI_PROGRAMMING_ASSISTANT: 'ai_programming_assistant',

  // Team features (PRIORITY - Core Monetization)
  MULTI_TEAM_MANAGEMENT: 'multi_team_management', // Free: 1 team, Paid: unlimited
  TEAM_COLLABORATION: 'team_collaboration',
  CUSTOM_BRANDING: 'custom_branding',

  // Integration features
  API_ACCESS: 'api_access',
  WEBHOOK_INTEGRATION: 'webhook_integration',

  // Analytics
  BASIC_ANALYTICS: 'basic_analytics',
  ADVANCED_ANALYTICS: 'advanced_analytics',
  CUSTOM_REPORTS: 'custom_reports',
}
```

#### 3. Usage Limits & Quotas

Limits are countable resources that can be restricted per plan:

```typescript
const LIMITS = {
  // Content limits - REMOVED: No limits on workouts, movements, or scheduled workouts
  // All users get unlimited workouts, movements, and scheduling

  // Team limits (PRIORITY - Core Monetization)
  MAX_TEAMS: 'max_teams',              // Free: 1, Paid: unlimited (-1) - EXCLUDES personal team
  MAX_MEMBERS_PER_TEAM: 'max_members_per_team',  // Free: 5, Paid: higher limits
  MAX_ADMINS: 'max_admins',

  // Programming limits (PRIORITY - Sellable)
  MAX_PROGRAMMING_TRACKS: 'max_programming_tracks',  // Free: 5, Paid: unlimited

  // AI usage limits (PRIORITY - Coming Soon)
  AI_MESSAGES_PER_MONTH: 'ai_messages_per_month',  // Free: 10-20, Paid: 200+

  // Storage limits
  MAX_FILE_STORAGE_MB: 'max_file_storage_mb',
  MAX_VIDEO_STORAGE_MB: 'max_video_storage_mb',
}
```

#### 4. Add-ons & Overrides

Allow teams to purchase additional features or capacity beyond their base plan:

```typescript
const ADDONS = {
  // PRIORITY - Team capacity add-ons
  EXTRA_TEAM_MEMBERS: {
    id: 'extra_team_members',
    name: 'Additional Team Members (5-pack)',
    price: 10,
    interval: 'month',
    unit: 'per 5 members',
    modifies: {
      limit: 'max_members_per_team',
      operation: 'add',
      value: 5
    }
  },

  // PRIORITY - AI add-ons
  AI_MESSAGE_PACK: {
    id: 'ai_message_pack',
    name: 'AI Message Credits',
    price: 15,
    interval: 'one_time',
    modifies: {
      limit: 'ai_messages_per_month',
      operation: 'add',
      value: 200
    }
  },

  // PRIORITY - Programming track add-ons
  PROGRAMMING_TRACK_BUNDLE: {
    id: 'programming_track_bundle',
    name: 'Additional Programming Tracks (10-pack)',
    price: 20,
    interval: 'month',
    modifies: {
      limit: 'max_programming_tracks',
      operation: 'add',
      value: 10
    }
  },

  // Premium features
  CUSTOM_BRANDING: {
    id: 'custom_branding',
    name: 'Custom Branding',
    price: 25,
    interval: 'month',
    modifies: {
      feature: 'custom_branding',
      operation: 'enable'
    }
  },

  API_ACCESS: {
    id: 'api_access',
    name: 'API Access',
    price: 30,
    interval: 'month',
    modifies: {
      feature: 'api_access',
      operation: 'enable'
    }
  }
}
```

### Database Schema Changes

#### New Tables

##### 1. `entitlement_type` Table (Course-Builder Pattern)
Define categories of entitlements:

```typescript
export const entitlementTypeTable = sqliteTable('entitlement_type', {
  id: text().primaryKey().$defaultFn(() => createEntitlementTypeId()),
  name: text({ length: 100 }).notNull().unique(),
  description: text({ length: 500 }),
  ...commonColumns,
})

// Predefined entitlement types
export const ENTITLEMENT_TYPES = {
  // Programming track access (individual purchase or subscription)
  PROGRAMMING_TRACK_ACCESS: 'programming_track_access',

  // AI usage entitlements
  AI_MESSAGE_CREDITS: 'ai_message_credits',

  // Feature trials
  FEATURE_TRIAL: 'feature_trial',

  // Manual grants by admin
  MANUAL_FEATURE_GRANT: 'manual_feature_grant',

  // Subscription-based access (complements team plan)
  SUBSCRIPTION_SEAT: 'subscription_seat',

  // Add-on purchases
  ADDON_ACCESS: 'addon_access',
} as const
```

##### 2. `entitlement` Table (Course-Builder Pattern)
Explicit records of granted access:

```typescript
export const entitlementTable = sqliteTable('entitlement', {
  id: text().primaryKey().$defaultFn(() => createEntitlementId()),

  // What type of access is this?
  entitlementTypeId: text().notNull().references(() => entitlementTypeTable.id),

  // Who has this access?
  userId: text().notNull().references(() => userTable.id),

  // Team context (for org-scoped access)
  teamId: text().references(() => teamTable.id),

  // Where did this entitlement come from?
  sourceType: text({
    enum: ['PURCHASE', 'SUBSCRIPTION', 'MANUAL']
  }).notNull(),

  // What is the source? (purchaseId, subscriptionId, adminUserId, etc.)
  sourceId: text().notNull(),

  // Type-specific metadata (contentIds, featureIds, etc.)
  metadata: text({ mode: 'json' }).$type<Record<string, any>>(),

  // Optional expiration
  expiresAt: integer({ mode: 'timestamp' }),

  // Soft delete for audit trail
  deletedAt: integer({ mode: 'timestamp' }),

  ...commonColumns,
}, (table) => [
  index('entitlement_user_id_idx').on(table.userId),
  index('entitlement_team_id_idx').on(table.teamId),
  index('entitlement_type_idx').on(table.entitlementTypeId),
  index('entitlement_source_idx').on(table.sourceType, table.sourceId),
  index('entitlement_deleted_at_idx').on(table.deletedAt),
])

// Example metadata structures for different types:
// PROGRAMMING_TRACK_ACCESS: { trackId: string, trackName: string }
// AI_MESSAGE_CREDITS: { messages: number, resetPeriod: 'monthly' | 'never' }
// FEATURE_TRIAL: { featureId: string, originalExpiresAt: Date }
// MANUAL_FEATURE_GRANT: { featureId: string, grantedBy: userId, reason: string }
// SUBSCRIPTION_SEAT: { subscriptionId: string, seatNumber: number }
```

##### 3. `plan` Table
Store available subscription plans:

```typescript
export const planTable = sqliteTable('plan', {
  id: text().primaryKey().$defaultFn(() => createPlanId()),
  name: text({ length: 100 }).notNull(),
  description: text({ length: 500 }),
  price: integer().notNull(), // in cents
  interval: text({ enum: ['month', 'year'] }),
  isActive: integer().default(1).notNull(),
  isPublic: integer().default(1).notNull(), // can users sign up for this?
  sortOrder: integer().default(0).notNull(),
  // JSON field storing the plan's entitlements
  entitlements: text({ mode: 'json' }).notNull().$type<PlanEntitlements>(),
  // Stripe-related fields
  stripePriceId: text({ length: 255 }),
  stripeProductId: text({ length: 255 }),
  ...commonColumns,
})

interface PlanEntitlements {
  features: string[] // array of feature IDs
  limits: Record<string, number> // limit_id -> value (-1 for unlimited)
}
```

##### 2. `team_subscription` Table
Track team subscriptions:

```typescript
export const teamSubscriptionTable = sqliteTable('team_subscription', {
  id: text().primaryKey().$defaultFn(() => createTeamSubscriptionId()),
  teamId: text().notNull().references(() => teamTable.id),
  planId: text().notNull().references(() => planTable.id),
  status: text({
    enum: ['active', 'cancelled', 'past_due', 'trialing', 'paused']
  }).notNull(),
  currentPeriodStart: integer({ mode: 'timestamp' }).notNull(),
  currentPeriodEnd: integer({ mode: 'timestamp' }).notNull(),
  cancelAtPeriodEnd: integer().default(0).notNull(),
  trialStart: integer({ mode: 'timestamp' }),
  trialEnd: integer({ mode: 'timestamp' }),
  // Stripe-related fields
  stripeSubscriptionId: text({ length: 255 }),
  stripeCustomerId: text({ length: 255 }),
  ...commonColumns,
}, (table) => [
  index('team_subscription_team_id_idx').on(table.teamId),
  index('team_subscription_status_idx').on(table.status),
])
```

##### 3. `team_addon` Table
Track purchased add-ons:

```typescript
export const teamAddonTable = sqliteTable('team_addon', {
  id: text().primaryKey().$defaultFn(() => createTeamAddonId()),
  teamId: text().notNull().references(() => teamTable.id),
  addonId: text().notNull(), // reference to addon definition in code
  quantity: integer().default(1).notNull(),
  status: text({ enum: ['active', 'cancelled'] }).notNull(),
  expiresAt: integer({ mode: 'timestamp' }),
  // Stripe-related fields
  stripeSubscriptionItemId: text({ length: 255 }),
  ...commonColumns,
}, (table) => [
  index('team_addon_team_id_idx').on(table.teamId),
  index('team_addon_status_idx').on(table.status),
])
```

##### 4. `team_entitlement_override` Table
Allow manual overrides for specific teams (e.g., custom deals, grandfathered plans):

```typescript
export const teamEntitlementOverrideTable = sqliteTable('team_entitlement_override', {
  id: text().primaryKey().$defaultFn(() => createTeamEntitlementOverrideId()),
  teamId: text().notNull().references(() => teamTable.id),
  type: text({ enum: ['feature', 'limit'] }).notNull(),
  key: text().notNull(), // feature or limit ID
  value: text().notNull(), // JSON value (boolean for features, number for limits)
  reason: text({ length: 500 }), // why was this override applied?
  expiresAt: integer({ mode: 'timestamp' }),
  createdBy: text().references(() => userTable.id),
  ...commonColumns,
}, (table) => [
  index('team_entitlement_override_team_id_idx').on(table.teamId),
  index('team_entitlement_override_type_idx').on(table.type),
])
```

##### 5. `team_usage` Table
Track usage against limits:

```typescript
export const teamUsageTable = sqliteTable('team_usage', {
  id: text().primaryKey().$defaultFn(() => createTeamUsageId()),
  teamId: text().notNull().references(() => teamTable.id),
  limitKey: text().notNull(), // which limit this tracks
  currentValue: integer().default(0).notNull(),
  periodStart: integer({ mode: 'timestamp' }).notNull(),
  periodEnd: integer({ mode: 'timestamp' }).notNull(),
  ...commonColumns,
}, (table) => [
  index('team_usage_team_id_idx').on(table.teamId),
  index('team_usage_limit_key_idx').on(table.limitKey),
  // Unique constraint on team + limit + period
  index('team_usage_unique_idx').on(table.teamId, table.limitKey, table.periodStart),
])
```

#### Modified Tables

##### Update `team` Table
```typescript
// Add to existing teamTable
export const teamTable = sqliteTable('team', {
  // ... existing fields ...

  // Current subscription
  currentPlanId: text().references(() => planTable.id),

  // Remove these fields (moved to team_subscription):
  // planId: text({ length: 100 }),
  // planExpiresAt: integer({ mode: 'timestamp' }),

  // Keep creditBalance for backward compatibility and one-off purchases
  creditBalance: integer().default(0).notNull(),
})
```

### Core Entitlements Service

Create a centralized service for checking entitlements:

```typescript
// src/server/entitlements.ts
import "server-only"

interface EntitlementCheckResult {
  allowed: boolean
  reason?: string
  upgradeRequired?: boolean
  currentLimit?: number
  usedAmount?: number
}

/**
 * Check if a team has access to a specific feature
 */
export async function hasFeature(
  teamId: string,
  featureId: string
): Promise<boolean> {
  // 1. Get team's current plan
  const plan = await getTeamPlan(teamId)

  // 2. Check plan entitlements
  const hasFeatureInPlan = plan.entitlements.features.includes(featureId)

  // 3. Check for add-ons that enable this feature
  const hasFeatureFromAddon = await checkAddonForFeature(teamId, featureId)

  // 4. Check for manual overrides
  const override = await getFeatureOverride(teamId, featureId)
  if (override !== null) {
    return override
  }

  return hasFeatureInPlan || hasFeatureFromAddon
}

/**
 * Check if a team can perform an action that consumes a limited resource
 */
export async function checkLimit(
  teamId: string,
  limitKey: string,
  incrementBy: number = 1
): Promise<EntitlementCheckResult> {
  // 1. Get team's limit for this resource
  const maxLimit = await getTeamLimit(teamId, limitKey)

  // -1 means unlimited
  if (maxLimit === -1) {
    return { allowed: true }
  }

  // 2. Get current usage
  const currentUsage = await getCurrentUsage(teamId, limitKey)

  // 3. Check if action would exceed limit
  const wouldExceed = (currentUsage + incrementBy) > maxLimit

  if (wouldExceed) {
    return {
      allowed: false,
      reason: `This would exceed your plan's limit of ${maxLimit} ${limitKey}`,
      upgradeRequired: true,
      currentLimit: maxLimit,
      usedAmount: currentUsage,
    }
  }

  return {
    allowed: true,
    currentLimit: maxLimit,
    usedAmount: currentUsage,
  }
}

/**
 * Increment usage for a limited resource
 */
export async function incrementUsage(
  teamId: string,
  limitKey: string,
  amount: number = 1
): Promise<void> {
  const db = getDd()

  // Get or create usage record for current period
  const now = new Date()
  const periodStart = getStartOfMonth(now)
  const periodEnd = getEndOfMonth(now)

  const existingUsage = await db.query.teamUsageTable.findFirst({
    where: and(
      eq(teamUsageTable.teamId, teamId),
      eq(teamUsageTable.limitKey, limitKey),
      eq(teamUsageTable.periodStart, periodStart)
    )
  })

  if (existingUsage) {
    await db.update(teamUsageTable)
      .set({ currentValue: existingUsage.currentValue + amount })
      .where(eq(teamUsageTable.id, existingUsage.id))
  } else {
    await db.insert(teamUsageTable).values({
      teamId,
      limitKey,
      currentValue: amount,
      periodStart,
      periodEnd,
    })
  }
}

/**
 * Special limit check for MAX_TEAMS that excludes personal teams
 * Personal teams (isPersonalTeam = true) do NOT count toward the limit
 */
export async function requireLimitExcludingPersonalTeams(
  userId: string,
  limitKey: string
): Promise<void> {
  if (limitKey !== LIMITS.MAX_TEAMS) {
    throw new Error('This function only applies to MAX_TEAMS limit')
  }

  const db = getDd()

  // Get user's plan limit
  const userPlan = await getUserPlan(userId)
  const maxTeams = userPlan.limits[limitKey]

  // -1 means unlimited
  if (maxTeams === -1) {
    return
  }

  // Count non-personal teams owned by this user
  const teams = await db.query.teamTable.findMany({
    where: and(
      eq(teamTable.personalTeamOwnerId, userId),
      eq(teamTable.isPersonalTeam, 0) // Only count non-personal teams
    )
  })

  const currentTeamCount = teams.length

  if (currentTeamCount >= maxTeams) {
    throw new ZSAError(
      'FORBIDDEN',
      `You've reached your limit of ${maxTeams} team(s). Upgrade to create more teams. (Personal teams don't count toward this limit)`
    )
  }
}

/**
 * Require a feature (throws if not available)
 */
export async function requireFeature(
  teamId: string,
  featureId: string
): Promise<void> {
  const hasAccess = await hasFeature(teamId, featureId)

  if (!hasAccess) {
    throw new ZSAError(
      'FORBIDDEN',
      `This feature requires an upgrade to your plan`
    )
  }
}

/**
 * Require limit check (throws if would exceed)
 */
export async function requireLimit(
  teamId: string,
  limitKey: string,
  incrementBy: number = 1
): Promise<void> {
  const result = await checkLimit(teamId, limitKey, incrementBy)

  if (!result.allowed) {
    throw new ZSAError('FORBIDDEN', result.reason || 'Limit exceeded')
  }

  // Increment usage after check passes
  await incrementUsage(teamId, limitKey, incrementBy)
}

// ============================================================================
// USER-LEVEL ENTITLEMENT CHECKING (Course-Builder Pattern)
// ============================================================================

/**
 * Get active entitlements for a user
 * @param userId - User ID
 * @param teamId - Optional team context
 * @param entitlementType - Optional filter by type
 */
export async function getUserEntitlements(
  userId: string,
  teamId?: string,
  entitlementType?: string
): Promise<Entitlement[]> {
  const db = getDd()

  const conditions = [
    eq(entitlementTable.userId, userId),
    isNull(entitlementTable.deletedAt), // not soft-deleted
    or(
      isNull(entitlementTable.expiresAt), // doesn't expire
      gt(entitlementTable.expiresAt, sql`CURRENT_TIMESTAMP`) // or not yet expired
    ),
  ]

  if (teamId) {
    conditions.push(eq(entitlementTable.teamId, teamId))
  }

  if (entitlementType) {
    conditions.push(eq(entitlementTable.entitlementTypeId, entitlementType))
  }

  return await db.query.entitlementTable.findMany({
    where: and(...conditions),
    with: {
      entitlementType: true,
    },
  })
}

/**
 * Check if a user has a specific entitlement
 * @param userId - User ID
 * @param entitlementType - Type of entitlement to check
 * @param teamId - Optional team context
 * @returns boolean indicating if user has active entitlement
 */
export async function hasEntitlement(
  userId: string,
  entitlementType: string,
  teamId?: string
): Promise<boolean> {
  const entitlements = await getUserEntitlements(userId, teamId, entitlementType)
  return entitlements.length > 0
}

/**
 * Create an entitlement (typically called after purchase/subscription/manual grant)
 */
export async function createEntitlement({
  userId,
  teamId,
  entitlementTypeId,
  sourceType,
  sourceId,
  metadata,
  expiresAt,
}: {
  userId: string
  teamId?: string
  entitlementTypeId: string
  sourceType: 'PURCHASE' | 'SUBSCRIPTION' | 'MANUAL'
  sourceId: string
  metadata?: Record<string, any>
  expiresAt?: Date
}): Promise<Entitlement> {
  const db = getDd()

  const [entitlement] = await db.insert(entitlementTable).values({
    userId,
    teamId,
    entitlementTypeId,
    sourceType,
    sourceId,
    metadata,
    expiresAt,
  }).returning()

  return entitlement
}

/**
 * Soft delete an entitlement (revoke access while maintaining audit trail)
 */
export async function revokeEntitlement(entitlementId: string): Promise<void> {
  const db = getDd()

  await db.update(entitlementTable)
    .set({ deletedAt: new Date() })
    .where(eq(entitlementTable.id, entitlementId))
}

/**
 * Soft delete all entitlements for a specific source
 * (e.g., when a purchase is refunded or subscription cancelled)
 */
export async function revokeEntitlementsBySource(
  sourceType: 'PURCHASE' | 'SUBSCRIPTION' | 'MANUAL',
  sourceId: string
): Promise<void> {
  const db = getDd()

  await db.update(entitlementTable)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(entitlementTable.sourceType, sourceType),
        eq(entitlementTable.sourceId, sourceId),
        isNull(entitlementTable.deletedAt) // only revoke active ones
      )
    )
}

/**
 * Check if user has access to a specific programming track (via purchase or entitlement)
 * Combines plan-based check with entitlement-based check
 */
export async function hasProgrammingTrackAccess(
  userId: string,
  teamId: string,
  trackId: string
): Promise<boolean> {
  // 1. Check if team's plan includes programming tracks feature
  const teamPlan = await getTeamPlan(teamId)
  if (teamPlan.entitlements.features.includes(FEATURES.PROGRAMMING_TRACKS)) {
    return true // plan includes all programming tracks
  }

  // 2. Check if user has individual entitlement for this specific track
  const entitlements = await getUserEntitlements(
    userId,
    teamId,
    ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS
  )

  return entitlements.some(
    (e) => e.metadata?.trackId === trackId
  )
}

/**
 * Check if user can use AI features (workout generation, suggestions, etc.)
 * Checks feature access and remaining message limit
 */
export async function canUseAI(
  userId: string,
  teamId: string
): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
  // 1. Check if team has AI generation feature
  const hasFeature = await hasFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)
  if (!hasFeature) {
    return {
      allowed: false,
      reason: 'Upgrade to Pro to use AI features'
    }
  }

  // 2. Check usage limit (counts all AI interactions as "messages")
  const limit = await checkLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 0)

  if (!limit.allowed) {
    return {
      allowed: false,
      remaining: 0,
      reason: `You've used all ${limit.currentLimit} AI messages this month. Upgrade for more!`
    }
  }

  return {
    allowed: true,
    remaining: limit.currentLimit - limit.usedAmount
  }
}
```

### Integration Examples

#### Example 1: Gating Team Creation (PRIORITY)

```typescript
// src/actions/team-actions.ts

export const createTeamAction = createServerAction()
  .input(z.object({
    name: z.string(),
    slug: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()

    // Entitlement check: Can this user create another team?
    // IMPORTANT: Personal teams (isPersonalTeam = true) do NOT count toward this limit
    // Free users: max 1 non-personal team, Pro/Enterprise: unlimited
    await requireLimitExcludingPersonalTeams(session.userId, LIMITS.MAX_TEAMS)

    // Create the team (non-personal)
    const team = await createTeam({
      name: input.name,
      slug: input.slug,
      ownerId: session.userId,
      isPersonalTeam: false, // This is a real team, counts toward limit
    })

    return team
  })
```

#### Example 2: Gating Team Member Invites (PRIORITY)

```typescript
// src/actions/team-member-actions.ts

export const inviteTeamMemberAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    email: z.string().email(),
    roleId: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()

    // Permission check (can this USER invite members?)
    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.INVITE_MEMBERS)

    // Entitlement check (can this TEAM add more members?)
    // Free: max 5 members, Pro: max 25, Enterprise: unlimited
    await requireLimit(input.teamId, LIMITS.MAX_MEMBERS_PER_TEAM)

    // Create invitation
    const invitation = await createTeamInvitation({
      teamId: input.teamId,
      email: input.email,
      roleId: input.roleId,
      invitedBy: session.userId,
    })

    return invitation
  })
```

#### Example 3: Gating Programming Track Creation (PRIORITY)

```typescript
// src/actions/programming-track-actions.ts

export const createProgrammingTrackAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    name: z.string(),
    description: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()

    // Permission check (can this USER manage programming?)
    await requireTeamPermission(input.teamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

    // Feature check (does team have programming tracks feature?)
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)

    // Limit check (can this TEAM create more programming tracks?)
    // Free: max 5 tracks, Pro/Enterprise: unlimited
    await requireLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    // Create programming track
    const track = await createProgrammingTrack({
      teamId: input.teamId,
      name: input.name,
      description: input.description,
    })

    return track
  })
```

#### Example 4: Gating AI Workout Generation (PRIORITY - Coming Soon)

```typescript
// src/actions/ai-workout-actions.ts

export const generateAIWorkoutAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    prompt: z.string(),
    workoutType: z.enum(['metcon', 'strength', 'emom', 'amrap']),
  }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()

    // Feature check (does team have AI generation feature?)
    await requireFeature(input.teamId, FEATURES.AI_WORKOUT_GENERATION)

    // Usage limit check (has team exceeded monthly AI messages?)
    // Each AI request counts as 1 message (regardless of back-and-forth)
    // Free: 10/month, Pro: 200/month, Enterprise: unlimited
    const limitCheck = await requireLimit(
      input.teamId,
      LIMITS.AI_MESSAGES_PER_MONTH,
      1 // increment by 1 message
    )

    // Generate workout using AI (uses 1 AI message)
    const generatedWorkout = await generateWorkoutWithAI({
      prompt: input.prompt,
      workoutType: input.workoutType,
    })

    // Save as draft workout
    const workout = await createWorkout({
      teamId: input.teamId,
      ...generatedWorkout,
      createdBy: session.userId,
    })

    return {
      workout,
      remainingMessages: limitCheck.currentLimit - limitCheck.usedAmount
    }
  })
```

#### Example 5: Gating Programming Feature in UI

```typescript
// src/app/(main)/programming/page.tsx

export default async function ProgrammingPage({ params }) {
  const session = await requireVerifiedEmail()
  const teamId = params.teamId

  // Check if team has access to programming tracks feature
  const hasProgrammingAccess = await hasFeature(teamId, FEATURES.PROGRAMMING_TRACKS)

  if (!hasProgrammingAccess) {
    return <UpgradePrompt
      feature="Programming Tracks"
      description="Create and manage unlimited programming tracks for your gym"
      currentPlan="Free (5 tracks max)"
      upgradeTo="Pro (unlimited tracks)"
    />
  }

  // Check current usage vs limit
  const limitInfo = await checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 0)

  // Show programming interface with usage indicator
  return (
    <div>
      <ProgrammingHeader
        usage={limitInfo.usedAmount}
        limit={limitInfo.currentLimit}
      />
      <ProgrammingInterface teamId={teamId} />
    </div>
  )
}
```

#### Example 6: Showing Usage in UI (PRIORITY)

```typescript
// src/components/dashboard/usage-card.tsx

export function UsageCard({ teamId }: { teamId: string }) {
  const usage = await getUsageForTeam(teamId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {/* PRIORITY: Team member usage */}
        <UsageMeter
          label="Team Members"
          current={usage.members.current}
          limit={usage.members.limit}
          icon={Users}
          upgradeMessage="Add more members"
        />

        {/* PRIORITY: Programming tracks usage */}
        <UsageMeter
          label="Programming Tracks"
          current={usage.programmingTracks.current}
          limit={usage.programmingTracks.limit}
          icon={Calendar}
          upgradeMessage="Create unlimited tracks"
        />

        {/* PRIORITY: AI usage */}
        <UsageMeter
          label="AI Messages"
          current={usage.aiMessages.current}
          limit={usage.aiMessages.limit}
          icon={Sparkles}
          resetsAt={usage.aiMessages.resetsAt}
          upgradeMessage="Get 200 messages/month"
        />

        {/* Teams created (for multi-team users) */}
        {usage.teams && (
          <UsageMeter
            label="Teams"
            current={usage.teams.current}
            limit={usage.teams.limit}
            icon={Building}
            upgradeMessage="Create unlimited teams"
          />
        )}
      </CardContent>
    </Card>
  )
}
```

#### Example 7: Individual Programming Track Purchase (Entitlement Pattern)

```typescript
// src/actions/programming-track-purchase-actions.ts

export const purchaseProgrammingTrackAction = createServerAction()
  .input(z.object({
    trackId: z.string(),
    teamId: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireVerifiedEmail()
    const { trackId, teamId } = input

    // Get track details for pricing
    const track = await getProgrammingTrack(trackId)

    // 1. Create purchase record
    const purchase = await createPurchase({
      userId: session.userId,
      itemType: 'PROGRAMMING_TRACK',
      itemId: trackId,
      amount: track.price, // e.g., 2900 = $29.00
    })

    // 2. Create entitlement (new pattern!)
    await createEntitlement({
      userId: session.userId,
      teamId,
      entitlementTypeId: ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS,
      sourceType: 'PURCHASE',
      sourceId: purchase.id,
      metadata: {
        trackId,
        trackName: track.name,
        purchasedAt: new Date(),
      },
      // Optional: Set expiration if it's a time-limited purchase
      // expiresAt: addYears(new Date(), 1),
    })

    return { success: true, purchase, track }
  })

// Check if user can access programming track
export async function canAccessProgrammingTrack(
  userId: string,
  teamId: string,
  trackId: string
): Promise<boolean> {
  // 1. Check if team's plan includes programming tracks
  const teamPlan = await getTeamPlan(teamId)
  if (teamPlan.entitlements.features.includes(FEATURES.PROGRAMMING_TRACKS)) {
    return true // plan includes all programming tracks
  }

  // 2. Check if user has individual entitlement for this track
  const entitlements = await getUserEntitlements(
    userId,
    teamId,
    ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS
  )

  return entitlements.some(
    (e) => e.metadata?.trackId === trackId
  )
}
```

#### Example 8: Manual AI Message Credits Grant (Admin Use Case)

```typescript
// src/app/(admin)/admin/users/[userId]/grant-ai-messages.ts

export const grantAIMessagesAction = createServerAction()
  .input(z.object({
    userId: z.string(),
    teamId: z.string(),
    messages: z.number().min(1).max(1000),
    reason: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireAdmin()

    // Create AI message credits entitlement
    await createEntitlement({
      userId: input.userId,
      teamId: input.teamId,
      entitlementTypeId: ENTITLEMENT_TYPES.AI_MESSAGE_CREDITS,
      sourceType: 'MANUAL',
      sourceId: session.userId, // admin who granted it
      metadata: {
        messages: input.messages,
        grantedBy: session.userId,
        reason: input.reason,
        resetPeriod: 'never', // one-time grant
      },
      // Optional: Set expiration
      // expiresAt: addMonths(new Date(), 1),
    })

    return { success: true, messages: input.messages }
  })
```

#### Example 9: Feature Trial Grant (Admin Use Case)

```typescript
// src/app/(admin)/admin/teams/[teamId]/entitlements/grant-trial.ts

export const grantFeatureTrialAction = createServerAction()
  .input(z.object({
    userId: z.string(),
    teamId: z.string(),
    featureId: z.string(),
    durationDays: z.number().default(14),
    reason: z.string(),
  }))
  .handler(async ({ input }) => {
    const session = await requireAdmin()

    // Create entitlement with expiration
    await createEntitlement({
      userId: input.userId,
      teamId: input.teamId,
      entitlementTypeId: ENTITLEMENT_TYPES.FEATURE_TRIAL,
      sourceType: 'MANUAL',
      sourceId: session.userId, // admin who granted it
      metadata: {
        featureId: input.featureId,
        grantedBy: session.userId,
        reason: input.reason,
        originalExpiresAt: addDays(new Date(), input.durationDays),
      },
      expiresAt: addDays(new Date(), input.durationDays),
    })

    return { success: true }
  })

// Later, check if user has trial access
const hasTrial = await hasEntitlement(
  userId,
  ENTITLEMENT_TYPES.FEATURE_TRIAL,
  teamId
)
```

#### Example 10: Subscription Creates Entitlements (Webhook Handler)

```typescript
// src/app/api/webhooks/stripe/route.ts

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  // 1. Create team_subscription record
  const teamSubscription = await createTeamSubscription({
    teamId: subscription.metadata.teamId,
    planId: subscription.metadata.planId,
    stripeSubscriptionId: subscription.id,
    status: 'active',
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  })

  // 2. Update team's current plan
  await updateTeam(subscription.metadata.teamId, {
    currentPlanId: subscription.metadata.planId,
  })

  // 3. (Optional) Create user-level entitlement for audit trail
  await createEntitlement({
    userId: subscription.metadata.userId,
    teamId: subscription.metadata.teamId,
    entitlementTypeId: ENTITLEMENT_TYPES.SUBSCRIPTION_SEAT,
    sourceType: 'SUBSCRIPTION',
    sourceId: teamSubscription.id,
    metadata: {
      planId: subscription.metadata.planId,
      stripeSubscriptionId: subscription.id,
    },
    // Expires when subscription period ends
    expiresAt: new Date(subscription.current_period_end * 1000),
  })
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  // Revoke all entitlements from this subscription
  await revokeEntitlementsBySource('SUBSCRIPTION', subscription.id)

  // Update team subscription status
  await updateTeamSubscription(subscription.id, { status: 'cancelled' })
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2) ✅
**Goal**: Set up entitlements infrastructure without breaking existing functionality

- [x] Create new database tables:
  - `entitlement_type` (course-builder pattern)
  - `entitlement` (course-builder pattern)
  - `plan`
  - `team_subscription`
  - `team_addon`
  - `team_entitlement_override`
  - `team_usage`
- [ ] Run migrations
- [x] Seed `entitlement_type` table with predefined types:
  - `programming_track_access` - Individual programming track purchases
  - `ai_message_credits` - AI message credits/grants
  - `feature_trial` - Time-limited feature trials
  - `manual_feature_grant` - Admin grants
  - `subscription_seat` - Subscription seat tracking
  - `addon_access` - Add-on purchases
- [x] Define plan configurations in code (`src/config/plans.ts`)
- [x] Define feature flags in code (`src/config/features.ts`)
- [x] Define limits in code (`src/config/limits.ts`)
- [x] Create seed data for default plans (Free, Pro, Enterprise)
- [x] Update `team` table schema (add currentPlanId)

### Phase 2: Core Entitlements Service (Week 3) ✅
**Goal**: Build the centralized entitlements checking service

- [x] Create `src/server/entitlements.ts` with team-level functions:
  - `hasFeature()` - Check if team's plan includes feature
  - `checkLimit()` - Check if action would exceed limit
  - `requireFeature()` - Throw if feature not available
  - `requireLimit()` - Throw if limit would be exceeded
  - `incrementUsage()` - Track usage against limits
  - `getTeamLimit()` - Get team's limit for a resource
  - `getCurrentUsage()` - Get current usage for a resource
  - `requireLimitExcludingPersonalTeams()` - Special check for MAX_TEAMS that excludes personal teams
- [x] Add user-level entitlement functions (course-builder pattern):
  - `getUserEntitlements()` - Get user's active entitlements
  - `hasEntitlement()` - Check if user has specific entitlement
  - `createEntitlement()` - Create new entitlement record
  - `revokeEntitlement()` - Soft delete entitlement
  - `revokeEntitlementsBySource()` - Soft delete by source
  - `hasProgrammingTrackAccess()` - Hybrid check (plan + entitlement)
  - `canUseAI()` - Check AI feature + message limits
- [x] Create helper functions:
  - `getTeamPlan()`
  - `getFeatureOverride()`
  - `getLimitOverride()`
  - `checkAddonForFeature()` (stub)
  - `getAddonLimitModifier()` (stub)
- [x] Add usage tracking utilities (incrementUsage, getCurrentUsage)
- [ ] Write tests for both plan-based and entitlement-based logic
- [ ] **Session Caching & Cache Invalidation**:
  - [ ] Extend `KVSession` interface to include:
    - `entitlements` field (user-level entitlements)
    - `plan` field in teams array (team plan details)
  - [ ] Increment `CURRENT_SESSION_VERSION` in `kv-session.ts`
  - [ ] Update `createKVSession` to load and include entitlements
  - [ ] Update `updateKVSession` to refresh entitlements
  - [ ] Update `updateAllSessionsOfUser` to include entitlements
  - [ ] Create `invalidateUserSessions(userId)` helper
  - [ ] Create `invalidateTeamMembersSessions(teamId)` helper
  - [ ] Add cache invalidation to:
    - `createEntitlement()` - invalidate user sessions
    - `revokeEntitlement()` - invalidate user sessions
    - `revokeEntitlementsBySource()` - invalidate affected user sessions
    - `updateTeamSubscription()` - invalidate all team member sessions
  - [ ] Test session updates happen in real-time

### Phase 3: Migrate Existing Teams (Week 3) ✅
**Goal**: Assign all existing teams to the Free plan

- [x] Create migration script to:
  - Assign all teams to "free" plan
  - Create `team_subscription` records
  - Set trial periods if desired
- [ ] Create admin UI to view/change team plans
- [ ] Create admin UI to add entitlement overrides

### Phase 4: Gate Features (Week 4-5) 🚧 In Progress
**Goal**: Start enforcing entitlements across the application

**Priority 1 - Core Monetization (MUST HAVE)**:
- [x] Team creation limit (`LIMITS.MAX_TEAMS`) - Free: 1 (+ personal team), Paid: unlimited
- [x] Team member limit (`LIMITS.MAX_MEMBERS_PER_TEAM`) - Free: 5, Pro: 25, Enterprise: unlimited
- [x] Programming track limit (`LIMITS.MAX_PROGRAMMING_TRACKS`) - Free: 5, Paid: unlimited
- [x] Programming tracks feature (`FEATURES.PROGRAMMING_TRACKS`) - Pro+ only for unlimited
- [ ] AI message limit (`LIMITS.AI_MESSAGES_PER_MONTH`) - Free: 10, Pro: 200, Enterprise: unlimited
- [ ] AI workout generation feature (`FEATURES.AI_WORKOUT_GENERATION`) - Pro+ only

**Priority 2 - Nice to Have**:
- [ ] Custom branding (`FEATURES.CUSTOM_BRANDING`) - Enterprise feature
- [ ] Advanced analytics (`FEATURES.ADVANCED_ANALYTICS`) - Enterprise feature
- [ ] Advanced scaling features (`FEATURES.CUSTOM_SCALING_GROUPS`)

**Not Implementing**:
- Workout creation limits - All plans get unlimited workouts
- Movement creation limits - All plans get unlimited movements
- Scheduled workout limits - All plans get unlimited scheduling

**Priority 3 - Future Features**:
- [ ] API access (`FEATURES.API_ACCESS`)
- [ ] Webhook integration (`FEATURES.WEBHOOK_INTEGRATION`)
- [ ] White label (`FEATURES.WHITE_LABEL`)

**Implementation per feature**:
1. Add entitlement check in server action
2. Add entitlement check in page component
3. Show upgrade prompt for gated features
4. Update UI to show usage meters
5. Test thoroughly

### Phase 5: Upgrade Flows (Week 6)
**Goal**: Allow teams to upgrade their plans

- [ ] Create plan selection/comparison page (`/settings/teams/[teamSlug]/billing/plans`)
- [ ] Integrate Stripe for payment processing
- [ ] Create webhook handler for Stripe events
- [ ] Handle subscription lifecycle:
  - Creation
  - Updates
  - Cancellations
  - Trial periods
  - Failed payments
- [ ] Create upgrade prompts throughout app
- [ ] Add "Upgrade" CTA buttons

### Phase 6: Add-ons & Overrides (Week 7)
**Goal**: Support purchasing add-ons and manual overrides

- [ ] Create add-on purchase flow
- [ ] Create admin UI for adding overrides
- [ ] Implement override logic in entitlements service
- [ ] Add override audit logging

### Phase 7: Usage Tracking & Analytics (Week 8)
**Goal**: Track usage and show it to teams

- [ ] Build usage dashboard for teams
- [ ] Create admin analytics for plan adoption
- [ ] Set up alerts for approaching limits
- [ ] Create usage reports

### Phase 8: Testing & Refinement (Week 9-10)
**Goal**: Ensure system works correctly and UX is smooth

- [ ] End-to-end testing of all plans
- [ ] Test upgrade/downgrade flows
- [ ] Test edge cases (trial periods, cancellations, etc.)
- [ ] Performance testing (entitlement checks should be fast)
- [ ] UX improvements based on feedback
- [ ] Documentation for team and technical docs

## Migration Strategy

### Backward Compatibility

During the migration, we need to ensure existing functionality continues to work:

1. **Keep Existing Permission System**: Don't remove RBAC; entitlements layer on top
2. **Default to Free Plan**: All existing teams get the "free" plan initially
3. **Generous Free Plan**: Make the free plan generous enough that existing users aren't immediately blocked
4. **Gradual Rollout**: Gate new features first, then gradually add limits to existing features
5. **Admin Overrides**: Use entitlement overrides to give beta users/partners special access

### Data Migration Script

```typescript
// scripts/migrate-to-entitlements.ts

async function migrateTeamsToEntitlements() {
  const db = getDd()

  // 1. Get all teams
  const teams = await db.query.teamTable.findMany()

  // 2. Create free plan subscription for each team
  for (const team of teams) {
    await db.insert(teamSubscriptionTable).values({
      teamId: team.id,
      planId: 'free',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: addMonths(new Date(), 1),
      // Optional: give them a trial period
      trialStart: new Date(),
      trialEnd: addDays(new Date(), 30),
    })

    // 3. Update team table
    await db.update(teamTable)
      .set({ currentPlanId: 'free' })
      .where(eq(teamTable.id, team.id))
  }

  console.log(`Migrated ${teams.length} teams to free plan`)
}
```

## Recommended Free Plan (PRIORITY)

To avoid disrupting existing users while encouraging upgrades, start with this free plan:

```typescript
{
  id: 'free',
  name: 'Free',
  price: 0,
  entitlements: {
    features: [
      'basic_workouts',
      'basic_scaling',
      'team_collaboration',
      'basic_analytics',
    ],
    limits: {
      // PRIORITY LIMITS - Core Monetization Levers
      max_teams: 1,                    // 1 team (excluding personal team) - upgrade for more
      max_members_per_team: 5,         // 5 members per team (upgrade for 25+)
      max_programming_tracks: 5,       // 5 programming tracks (upgrade for unlimited)
      ai_messages_per_month: 10,       // 10 AI messages/month (upgrade for 200+)

      // NOTE: Unlimited workouts, movements, and scheduled workouts for all plans
    }

    // NOTE: Personal teams (isPersonalTeam = true) do NOT count toward max_teams limit
  }
}
```

**Why This Free Plan Works**:
1. ✅ **Generous enough** - Users can actually use the app meaningfully
2. ✅ **Clear upgrade path** - Each limit has an obvious pain point:
   - Growing gym? Need more than 5 members → Upgrade to Pro
   - Want more programming tracks? 5 isn't enough → Upgrade to Pro
   - Multiple gyms/teams? Can't create more → Upgrade to Pro
   - Using AI frequently? 10 messages → Upgrade to Pro for 200
3. ✅ **Non-disruptive** - Existing users likely fit within these limits
4. ✅ **Trial-friendly** - New users can evaluate all features before hitting limits

**IMPORTANT**: Personal teams (created automatically for each user with `isPersonalTeam = true`) do **NOT** count toward the `max_teams` limit. Free users can have:
- 1 personal team (doesn't count)
- 1 additional team (e.g., for their gym)

Pro users can have:
- 1 personal team (doesn't count)
- Unlimited additional teams

## Technical Considerations

### Session Data & Caching Strategy

**Include Entitlements in Session**:

The session already stores team permissions. We should extend it to include user-level entitlements for fast access:

```typescript
// Extend KVSession interface
export interface KVSession {
  // ... existing fields ...
  teams?: {
    id: string
    name: string
    slug: string
    isPersonalTeam: boolean
    role: {
      id: string
      name: string
      isSystemRole: boolean
    }
    permissions: string[]
    plan?: {
      id: string
      name: string
      features: string[]
      limits: Record<string, number>
    }
  }[]

  // NEW: User-level entitlements
  entitlements?: {
    id: string
    type: string
    metadata: Record<string, any>
    expiresAt: Date | null
  }[]

  version?: number // INCREMENT THIS when adding entitlements!
}
```

**When to Load Entitlements**:
```typescript
// In createKVSession and updateKVSession
export async function createKVSession({
  sessionId,
  userId,
  expiresAt,
  user,
  teams,
}: CreateKVSessionParams): Promise<KVSession> {
  // ... existing code ...

  // Load user's active entitlements
  const entitlements = await getUserEntitlements(userId)

  const session: KVSession = {
    // ... existing fields ...
    teams,
    entitlements: entitlements.map(e => ({
      id: e.id,
      type: e.entitlementTypeId,
      metadata: e.metadata,
      expiresAt: e.expiresAt,
    })),
    version: CURRENT_SESSION_VERSION, // MUST INCREMENT!
  }

  // ... rest of code ...
}
```

### Cache Invalidation Strategy

**Why Cache in Session?**

Entitlements need to be checked frequently (every feature access, every limit check), so we cache them in KV sessions to avoid repeated database queries. However, when entitlements change, we MUST invalidate the cache immediately so users get the correct access.

**Cache Invalidation Flow**:

```
User purchases component
  ↓
createEntitlement() creates DB record
  ↓
invalidateUserSessions(userId)
  ↓
updateAllSessionsOfUser() refreshes all sessions
  ↓
User's next request has updated entitlements
  ↓
Fast access check using session data (no DB query)
```

**When to Invalidate/Update Sessions**:

1. **Entitlement Created** (Purchase, Subscription, Manual Grant):
```typescript
export async function createEntitlement({
  userId,
  teamId,
  entitlementTypeId,
  sourceType,
  sourceId,
  metadata,
  expiresAt,
}: CreateEntitlementParams): Promise<Entitlement> {
  const db = getDd()

  const [entitlement] = await db.insert(entitlementTable).values({
    userId,
    teamId,
    entitlementTypeId,
    sourceType,
    sourceId,
    metadata,
    expiresAt,
  }).returning()

  // CRITICAL: Invalidate user's sessions
  await invalidateUserSessions(userId)

  return entitlement
}

async function invalidateUserSessions(userId: string): Promise<void> {
  // Update all active sessions for this user
  await updateAllSessionsOfUser(userId)
}
```

2. **Entitlement Revoked** (Refund, Cancellation, Expiration):
```typescript
export async function revokeEntitlement(entitlementId: string): Promise<void> {
  const db = getDd()

  // Get entitlement to find userId
  const entitlement = await db.query.entitlementTable.findFirst({
    where: eq(entitlementTable.id, entitlementId)
  })

  if (!entitlement) return

  // Soft delete
  await db.update(entitlementTable)
    .set({ deletedAt: new Date() })
    .where(eq(entitlementTable.id, entitlementId))

  // CRITICAL: Invalidate user's sessions
  await invalidateUserSessions(entitlement.userId)
}
```

3. **Team Plan Changed**:
```typescript
export async function updateTeamSubscription(
  teamId: string,
  planId: string
): Promise<void> {
  // Update team's plan
  await db.update(teamTable)
    .set({ currentPlanId: planId })
    .where(eq(teamTable.id, teamId))

  // CRITICAL: Invalidate all team members' sessions
  await invalidateTeamMembersSessions(teamId)
}

async function invalidateTeamMembersSessions(teamId: string): Promise<void> {
  const db = getDd()

  // Get all team members
  const members = await db.query.teamMembershipTable.findMany({
    where: eq(teamMembershipTable.teamId, teamId)
  })

  // Update all their sessions in parallel
  await Promise.all(
    members.map(member => updateAllSessionsOfUser(member.userId))
  )
}
```

**Update Session Utility**:

Modify `updateAllSessionsOfUser` in `kv-session.ts` to include entitlements:

```typescript
export async function updateAllSessionsOfUser(userId: string) {
  const sessions = await getAllSessionIdsOfUser(userId)
  const kv = await getKV()

  if (!kv) {
    throw new Error("Can't connect to KV store")
  }

  const newUserData = await getUserFromDB(userId)
  if (!newUserData) return

  // Get updated teams data with permissions
  const teamsWithPermissions = await getUserTeamsWithPermissions(userId)

  // NEW: Get updated entitlements
  const entitlements = await getUserEntitlements(userId)

  for (const sessionObj of sessions) {
    const session = await kv.get(sessionObj.key)
    if (!session) continue

    const sessionData = JSON.parse(session) as KVSession

    // Only update non-expired sessions
    if (
      sessionObj.absoluteExpiration &&
      sessionObj.absoluteExpiration.getTime() > Date.now()
    ) {
      const ttlInSeconds = Math.floor(
        (sessionObj.absoluteExpiration.getTime() - Date.now()) / 1000,
      )

      await kv.put(
        sessionObj.key,
        JSON.stringify({
          ...sessionData,
          user: newUserData,
          teams: teamsWithPermissions,
          // NEW: Include entitlements
          entitlements: entitlements.map(e => ({
            id: e.id,
            type: e.entitlementTypeId,
            metadata: e.metadata,
            expiresAt: e.expiresAt,
          })),
          version: CURRENT_SESSION_VERSION,
        }),
        { expirationTtl: ttlInSeconds },
      )
    }
  }
}
```

### Accessing Entitlements from Session

Once entitlements are cached in the session, they're fast to access:

**Server Components/Actions**:
```typescript
// src/app/(main)/programming/tracks/[trackId]/page.tsx
export default async function ProgrammingTrackPage({ params }: { params: { trackId: string } }) {
  const session = await getSessionFromCookie()

  if (!session) {
    redirect('/sign-in')
  }

  const currentTeam = session.teams?.[0] // or get from context

  // Fast check - no database query!
  // Check if user has individual purchase entitlement for this track
  const hasPurchasedTrack = session.entitlements?.some(
    e => e.type === ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS &&
         e.metadata?.trackId === params.trackId
  )

  // Or check if team plan includes programming tracks
  const teamHasFullAccess = currentTeam?.plan?.features.includes(FEATURES.PROGRAMMING_TRACKS)

  if (!hasPurchasedTrack && !teamHasFullAccess) {
    return <UpgradePrompt
      trackId={params.trackId}
      message="Purchase this track or upgrade to Pro for unlimited access"
    />
  }

  return <ProgrammingTrackView trackId={params.trackId} />
}
```

**Client Components** (via Zustand store):
```typescript
// src/state/session.ts - extend the store
interface SessionState {
  session: SessionValidationResult
  currentTeam: TeamMember | null
  // Add helper methods
  hasEntitlement: (type: string, metadata?: Record<string, any>) => boolean
  hasFeature: (featureId: string) => boolean
}

export const useSessionStore = create<SessionState & SessionActions>((set, get) => ({
  // ... existing state ...

  hasEntitlement: (type: string, metadata?: Record<string, any>) => {
    const session = get().session
    if (!session?.entitlements) return false

    return session.entitlements.some(e => {
      if (e.type !== type) return false
      if (!metadata) return true

      // Match metadata if provided
      return Object.keys(metadata).every(
        key => e.metadata?.[key] === metadata[key]
      )
    })
  },

  hasFeature: (featureId: string) => {
    const session = get().session
    const currentTeam = get().currentTeam

    if (!currentTeam) return false

    return currentTeam.plan?.features.includes(featureId) ?? false
  },
}))

// Usage in component
function ProgrammingTrackAccessButton({ trackId }: { trackId: string }) {
  const hasPurchased = useSessionStore(state =>
    state.hasEntitlement(ENTITLEMENT_TYPES.PROGRAMMING_TRACK_ACCESS, { trackId })
  )

  const hasFullAccess = useSessionStore(state =>
    state.hasFeature(FEATURES.PROGRAMMING_TRACKS)
  )

  if (hasPurchased || hasFullAccess) {
    return <Button>Open Track</Button>
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline">Purchase This Track - $29</Button>
      <Button>Upgrade to Pro - Unlimited Tracks</Button>
    </div>
  )
}
```

### Performance Optimization

- **Session Version Bumping**: Increment `CURRENT_SESSION_VERSION` when adding entitlements field
- **Selective Invalidation**: Only invalidate sessions that are affected (user-level or team-level)
- **Zero DB Queries for Access Checks**: Entitlements in session = no database hit on every check
- **Batch Updates**: When multiple entitlements change, batch session updates
- **Fast Lookups**: Ensure proper indexing on entitlement tables
- **Session TTL**: KV sessions auto-expire, reducing stale data risk
- **Real-time Updates**: Cache invalidation ensures users get new access immediately

### Security

- **Server-Side Only**: All entitlement checks must happen server-side (use `"server-only"`)
- **Never Trust Client**: Even if UI hides features, always check on server
- **Session Cache = UI Only**: Use session cache for fast UI rendering, but ALWAYS verify on server actions
  ```typescript
  // Client: Check session for fast UI
  const canPurchase = !useSessionStore(s => s.hasEntitlement('component_access', { componentId }))

  // Server Action: ALWAYS verify, don't trust client
  export const purchaseTrackAction = createServerAction()
    .handler(async ({ input }) => {
      // Re-check entitlements from database or fresh session
      const session = await requireVerifiedEmail()

      // Don't assume session cache is current - could be stale
      const hasAccess = await canAccessProgrammingTrack(
        session.userId,
        input.teamId,
        input.trackId
      )

      if (hasAccess) {
        throw new Error('Already have access to this track')
      }

      // Process purchase...
    })
  ```
- **Critical Operations = Fresh Check**: For purchases, refunds, access grants, query DB directly
- **Audit Logging**: Log all entitlement override changes with userId and reason
- **Rate Limiting**: Add rate limiting to prevent abuse of limits

### UX Considerations

- **Clear Messaging**: When a feature is locked, clearly explain why and how to unlock
- **Soft Limits**: Consider "soft limits" that warn before hard blocking
- **Upgrade CTAs**: Make it easy to upgrade when hitting limits
- **Usage Visibility**: Always show users their current usage and limits
- **Grace Periods**: Don't immediately lock out teams when subscription lapses

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Geographic Plans**: Different pricing per region
2. **Custom Plans**: Allow creating custom plans for enterprise customers
3. **Feature Trials**: Time-limited access to premium features
4. **Usage-Based Pricing**: Charge based on actual usage (pay-as-you-go)
5. **Team-Member Hybrid Billing**: Some features at team level, some per-user
6. **Metering**: Advanced usage metering for complex billing scenarios
7. **Self-Service Upgrades**: Allow users to upgrade mid-cycle with prorating

### Integration Opportunities

1. **LaunchDarkly/Flagsmith**: Use third-party feature flag service
2. **Stigg/Schematic**: Use dedicated entitlement platform
3. **Stripe Billing Portal**: Let users manage subscription via Stripe
4. **Analytics**: Track feature adoption per plan tier

## Success Metrics

Track these metrics to measure the success of the entitlements system:

1. **Conversion Rate**: Free → Pro → Enterprise
2. **Feature Adoption**: Which gated features drive upgrades?
3. **Churn Rate**: Are users cancelling? Why?
4. **Limit Hit Rate**: How often do users hit limits?
5. **Upgrade Prompts**: Click-through rate on upgrade CTAs
6. **Plan Distribution**: What % of teams on each plan?
7. **Revenue**: MRR, ARR growth
8. **Support Tickets**: Decrease in pricing/billing confusion

## Key Takeaways from Course-Builder Research

After studying the [badass-courses/course-builder](https://github.com/badass-courses/course-builder) entitlement system, we've adopted a **hybrid approach** that combines:

### What We Learned

1. **Entitlements as Records**: Instead of just checking "does your plan include X?", we now track explicit grant records
2. **Event Sourcing Pattern**: Purchases/subscriptions create entitlements → entitlements grant access
3. **Audit Trail**: Every access grant is a timestamped record with source tracking
4. **Soft Deletion**: Revoke access without losing history (set `deletedAt`)
5. **Flexible Sources**: Entitlements can come from `PURCHASE`, `SUBSCRIPTION`, or `MANUAL` grants

### What Changed in Our Plan

**Before (Plan-Only)**:
```typescript
// Simple: Check team's plan
if (team.plan.features.includes('programming')) {
  // allow access
}
```

**After (Hybrid: Plan + Entitlements)**:
```typescript
// Check team plan OR user entitlement
const hasAccess =
  await hasFeature(teamId, 'programming') ||  // plan-based
  await hasEntitlement(userId, 'feature_trial') // entitlement-based
```

### New Capabilities

1. **Individual Programming Track Purchases** (PRIORITY): Users can buy specific programming tracks à la carte
2. **AI Message Tracking** (PRIORITY): Track and limit AI messages per user/team
3. **Team Creation Limits** (PRIORITY): Free users limited to 1 team, paid users unlimited
4. **Team Member Limits** (PRIORITY): Enforce member caps per plan tier
5. **Programming Track Limits** (PRIORITY): Free: 5 tracks, Pro: unlimited
6. **Feature Trials**: Grant temporary access to features for specific users
7. **Manual AI Message Credits**: Admins can grant bonus AI message credits to users
8. **Seat-Based Licensing**: Track which users are consuming subscription seats
9. **Refund Handling**: Revoke entitlements when purchases are refunded
10. **Historical Tracking**: See exactly what was purchased when and by whom

### Architecture Decision

We use **both patterns** because they serve different purposes:

- **Plan-Based** (Team-Level): Shared features, usage limits, standard subscriptions
- **Entitlement-Based** (User-Level): Individual purchases, trials, manual grants, audit trail

This gives us the flexibility of both approaches without unnecessary complexity.

## Conclusion

This hybrid entitlements system will:

1. **Separate Concerns**: Billing, entitlements, and permissions are independent
2. **Enable Monetization**: Support multiple plan tiers and pricing models
3. **Provide Flexibility**: Easy to launch new features, adjust limits, create custom deals
4. **Improve UX**: Clear upgrade paths and usage visibility
5. **Scale with Business**: Support future pricing innovations without code changes
6. **Enable Audit Trail**: Track every access grant for compliance and debugging (from course-builder)
7. **Support Complex Scenarios**: Individual purchases, trials, manual grants, seat licensing (from course-builder)

The three-layer architecture (Permissions → Entitlements → Billing) combined with the event-sourced entitlement pattern gives us the foundation to build a sustainable SaaS business while maintaining a great user experience.

## Next Steps

1. **Review this plan** with the team
2. **Adjust** plans, features, and limits based on business requirements
3. **Start with Phase 1** (database setup)
4. **Iterate quickly** and gather feedback
5. **Monitor metrics** and adjust pricing/limits as needed

## Resources

### Articles & Documentation
- [Original Article: Why You Should Separate Your Billing from Entitlement](https://arnon.dk/why-you-should-separate-your-billing-from-entitlement/)
- [Course-Builder Repository](https://github.com/badass-courses/course-builder) - Reference implementation of entitlement pattern

### Current Codebase Files
- `apps/wodsmith/src/db/schemas/teams.ts` - RBAC permissions system
- `apps/wodsmith/src/db/schemas/billing.ts` - Credit-based billing
- `apps/wodsmith/src/utils/auth.ts` - Authentication logic
- `apps/wodsmith/src/utils/team-auth.ts` - Team authorization utilities

### Course-Builder Key Files (for reference)
- Database schema: `packages/adapter-drizzle/src/lib/mysql/index.ts`
- Entitlement queries: Multiple apps use similar patterns in `src/server/entitlements.ts`
- Access checking: Direct database queries for active entitlements with soft-delete support
