# Entitlements System - Developer Usage Guide

## Overview

The entitlements system controls what teams and users can do in TheWodApp. It consists of two complementary types:

- **Features**: Binary on/off capabilities (boolean)
- **Limits**: Quantifiable quotas with usage tracking (numeric)

Both are often used together to create sophisticated access control.

**IMPORTANT**: Features, limits, and plans are stored in the database as the source of truth.
The config files (`src/config/features.ts`, `src/config/limits.ts`) only export constant keys for type safety.
All metadata (names, descriptions, etc.) is stored in the database and queried via functions from `@/server/entitlements`.

## Architecture: Separating Billing from Entitlements

This system follows the principle of **separating billing from entitlements** (see [Why You Should Separate Your Billing from Entitlement](https://arnon.dk/why-you-should-separate-your-billing-from-entitlement/)).

### Key Concept

- **Billing Plan** (`team.currentPlanId`): What the team is subscribed to (e.g., "Pro")
- **Entitlements** (`team_feature_entitlement`, `team_limit_entitlement`): What the team actually has access to

These are **separate** because:
1. Plan definitions can change over time
2. Existing customers should keep what they paid for (grandfathering)
3. Manual overrides and trials need to coexist with plan-based access

### How It Works

When a team subscribes to a plan (or changes plans):
1. The plan's current features and limits are **snapshotted** to team-specific tables
2. Future changes to the plan definition don't affect existing teams
3. The team keeps their snapshotted entitlements until they change plans

```typescript
// When team subscribes to "Pro" plan:
await snapshotPlanEntitlements(teamId, "pro")
// Creates records in team_feature_entitlement and team_limit_entitlement

// Later, if "Pro" plan changes (e.g., removes a feature):
// - New "Pro" subscribers get the updated plan
// - Existing "Pro" teams keep their original entitlements (grandfathered)
```

### Database Schema

**Plan Definition Tables** (templates for new subscriptions):
- `plan` - Plan metadata (name, price, etc.)
- `plan_feature` - Features included in each plan
- `plan_limit` - Limits for each plan

**Team Entitlement Tables** (what teams actually have):
- `team_feature_entitlement` - Features a team has access to (snapshotted from plan)
- `team_limit_entitlement` - Limits a team has (snapshotted from plan)
- `team_entitlement_override` - Manual admin overrides

**Key Function**:
```typescript
snapshotPlanEntitlements(teamId, planId)
// Copies plan's features/limits to team-specific tables
```

## Features vs Limits

### Features (Binary Capabilities)

**Definition**: A feature is a discrete capability that can be enabled or disabled.

**Characteristics**:
- Boolean: either you have it or you don't
- No usage tracking needed
- No reset period
- Checked via `hasFeature(teamId, featureId)` → boolean

**Examples**:
```typescript
FEATURES.PROGRAMMING_TRACKS       // Can create programming tracks?
FEATURES.AI_WORKOUT_GENERATION    // Can use AI generation?
FEATURES.CUSTOM_SCALING_GROUPS    // Can create custom scaling groups?
FEATURES.MULTI_TEAM_MANAGEMENT    // Can manage multiple teams?
```

**When to use features**:
- Gating entire sections of functionality
- Enabling/disabling capabilities
- Distinguishing between plan tiers
- Feature flags for gradual rollout

### Limits (Quantifiable Quotas)

**Definition**: A limit is a numeric constraint on a countable resource.

**Characteristics**:
- Numeric: how many you can create/use
- Requires usage tracking in `teamUsageTable`
- Can reset (monthly/yearly/never)
- Checked via `checkLimit(teamId, limitKey, amount)` → EntitlementCheckResult
- -1 means unlimited

**Examples**:
```typescript
LIMITS.MAX_TEAMS                  // How many teams can you create?
LIMITS.MAX_MEMBERS_PER_TEAM       // How many members per team?
LIMITS.MAX_PROGRAMMING_TRACKS     // How many programming tracks?
LIMITS.AI_MESSAGES_PER_MONTH      // How many AI messages per month? (resets monthly)
```

**When to use limits**:
- Counting resources (teams, members, tracks)
- Monthly/yearly quotas (AI messages, API calls)
- Storage limits (MB, GB)
- Rate limiting

## Using Features and Limits Together

Many capabilities require BOTH a feature check AND a limit check. This is the most powerful pattern.

### Pattern: Feature Gates Functionality, Limit Controls Usage

```typescript
// Example: AI Workout Generation
// 1. Feature check: Is AI enabled for this team's plan?
// 2. Limit check: Have they exceeded monthly AI message quota?

export async function canUseAI(
  userId: string,
  teamId: string
): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
  // FEATURE CHECK: Does team have AI generation feature?
  const hasAIFeature = await hasFeature(teamId, FEATURES.AI_WORKOUT_GENERATION)
  if (!hasAIFeature) {
    return {
      allowed: false,
      reason: 'Upgrade to Pro to use AI features'  // Feature not in plan
    }
  }

  // LIMIT CHECK: Has team exceeded monthly AI message quota?
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
    remaining: (limit.currentLimit ?? 0) - (limit.usedAmount ?? 0),
  }
}
```

**Why both?**
- **Feature**: Prevents Free users from accessing AI at all
- **Limit**: Prevents Pro users from unlimited AI usage (cost control)

**Common patterns**:
1. **Programming Tracks**: Feature enables it, limit controls quantity
2. **AI Generation**: Feature enables it, limit controls monthly usage
3. **Team Members**: No feature needed (all have it), limit controls quantity
4. **Custom Scaling**: Feature enables it (Pro+), no limit on quantity

## API Reference

### Team-Level Entitlements (Plan-Based)

#### `hasFeature(teamId, featureId): Promise<boolean>`

Check if team has access to a feature.

```typescript
import { hasFeature } from '@/server/entitlements'
import { FEATURES } from '@/config/features'

// Check if team can use programming tracks
const canUseProgramming = await hasFeature(
  teamId,
  FEATURES.PROGRAMMING_TRACKS
)

if (canUseProgramming) {
  // Show programming interface
}
```

**Checks in order**:
1. Team's plan features
2. Active add-ons
3. Manual overrides

**Returns**: `boolean`

#### `requireFeature(teamId, featureId): Promise<void>`

Require a feature or throw error.

```typescript
import { requireFeature } from '@/server/entitlements'
import { FEATURES } from '@/config/features'

export const createProgrammingTrackAction = createServerAction()
  .handler(async ({ input }) => {
    // Throws if team doesn't have programming tracks feature
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)

    // Feature is available, continue...
    const track = await createProgrammingTrack(input)
    return track
  })
```

**Throws**: `Error` with message "This feature requires an upgrade to your plan"

#### `checkLimit(teamId, limitKey, incrementBy?): Promise<EntitlementCheckResult>`

Check if action would exceed limit (does NOT increment usage).

```typescript
import { checkLimit } from '@/server/entitlements'
import { LIMITS } from '@/config/limits'

// Check if team can add 3 more members
const result = await checkLimit(
  teamId,
  LIMITS.MAX_MEMBERS_PER_TEAM,
  3  // Would adding 3 exceed the limit?
)

if (result.allowed) {
  console.log(`Can add 3 members. Currently using ${result.usedAmount}/${result.currentLimit}`)
} else {
  console.log(result.reason)  // "This would exceed your plan's limit of 25 max_members_per_team"
}
```

**Parameters**:
- `teamId`: Team ID
- `limitKey`: Which limit to check
- `incrementBy`: How much would be consumed (default: 1)

**Returns**: `EntitlementCheckResult`
```typescript
interface EntitlementCheckResult {
  allowed: boolean
  reason?: string            // Why it was denied
  upgradeRequired?: boolean  // Should we show upgrade prompt?
  currentLimit?: number      // Team's max limit (-1 = unlimited)
  usedAmount?: number        // Current usage
}
```

#### `requireLimit(teamId, limitKey, incrementBy?): Promise<void>`

Check limit AND increment usage if allowed.

```typescript
import { requireLimit } from '@/server/entitlements'
import { LIMITS } from '@/config/limits'

export const inviteTeamMemberAction = createServerAction()
  .handler(async ({ input }) => {
    // Check AND increment usage atomically
    // Throws if would exceed limit
    await requireLimit(input.teamId, LIMITS.MAX_MEMBERS_PER_TEAM)

    // Limit check passed and usage incremented
    const invitation = await createTeamInvitation(input)
    return invitation
  })
```

**IMPORTANT**: This function:
1. Checks if action would exceed limit
2. If allowed, increments usage
3. If not allowed, throws error

**Use this** when you're actually consuming the resource.

**Throws**: `Error` with reason message

#### `requireLimitExcludingPersonalTeams(userId, limitKey): Promise<void>`

Special check for MAX_TEAMS that excludes personal teams.

```typescript
import { requireLimitExcludingPersonalTeams } from '@/server/entitlements'
import { LIMITS } from '@/config/limits'

export const createTeamAction = createServerAction()
  .handler(async ({ input }) => {
    // Personal teams don't count toward this limit
    // Free users: 1 non-personal team
    // Pro users: unlimited non-personal teams
    await requireLimitExcludingPersonalTeams(
      session.userId,
      LIMITS.MAX_TEAMS
    )

    const team = await createTeam({
      ...input,
      isPersonalTeam: false  // This counts toward limit
    })
    return team
  })
```

**Only works for**: `LIMITS.MAX_TEAMS`

**Throws**: `Error` if would exceed team limit

### User-Level Entitlements (Event-Sourced)

#### `getUserEntitlements(userId, teamId?, entitlementType?): Promise<Entitlement[]>`

Get all active entitlements for a user.

```typescript
import { getUserEntitlements } from '@/server/entitlements'

// Get all entitlements for user
const allEntitlements = await getUserEntitlements(userId)

// Get entitlements for specific team
const teamEntitlements = await getUserEntitlements(userId, teamId)

// Get specific type of entitlements
const trackPurchases = await getUserEntitlements(
  userId,
  teamId,
  'programming_track_access'
)
```

**Returns**: Array of active, non-expired entitlements

#### `hasEntitlement(userId, entitlementType, teamId?): Promise<boolean>`

Check if user has a specific entitlement.

```typescript
import { hasEntitlement } from '@/server/entitlements'

const hasTrial = await hasEntitlement(
  userId,
  'feature_trial',
  teamId
)
```

#### `createEntitlement(params): Promise<Entitlement>`

Create a new entitlement (after purchase/grant).

```typescript
import { createEntitlement } from '@/server/entitlements'
import { ENTITLEMENT_TYPES } from '@/db/schema'

// After user purchases a programming track
const entitlement = await createEntitlement({
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
  // Optional: Set expiration
  expiresAt: addYears(new Date(), 1),
})

// User sessions are automatically invalidated
```

**Parameters**:
- `userId`: User who gets the entitlement
- `teamId?`: Optional team context
- `entitlementTypeId`: Type of entitlement (from `ENTITLEMENT_TYPES`)
- `sourceType`: `'PURCHASE' | 'SUBSCRIPTION' | 'MANUAL'`
- `sourceId`: ID of the source (purchaseId, subscriptionId, adminUserId)
- `metadata?`: Type-specific data
- `expiresAt?`: Optional expiration date

**Side effects**: Invalidates user's sessions to refresh access

#### `revokeEntitlement(entitlementId): Promise<void>`

Soft-delete an entitlement (maintains audit trail).

```typescript
import { revokeEntitlement } from '@/server/entitlements'

// Revoke access (soft delete)
await revokeEntitlement(entitlementId)

// User sessions are automatically invalidated
```

#### `revokeEntitlementsBySource(sourceType, sourceId): Promise<void>`

Revoke all entitlements from a source (e.g., refund).

```typescript
import { revokeEntitlementsBySource } from '@/server/entitlements'

// User refunded their purchase
await revokeEntitlementsBySource('PURCHASE', purchaseId)

// All affected user sessions are automatically invalidated
```

## Common Implementation Patterns

### Pattern 1: Feature-Only Gating

Use when you just need to enable/disable functionality.

```typescript
// src/actions/custom-scaling-actions.ts

export const createCustomScalingGroupAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    name: z.string(),
  }))
  .handler(async ({ input }) => {
    // Only check feature
    await requireFeature(input.teamId, FEATURES.CUSTOM_SCALING_GROUPS)

    // No limit on quantity - create as many as you want
    const group = await createScalingGroup(input)
    return group
  })
```

### Pattern 2: Limit-Only Gating

Use when all users have the capability, but quantity varies.

```typescript
// src/actions/team-member-actions.ts

export const inviteTeamMemberAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    email: z.string().email(),
  }))
  .handler(async ({ input }) => {
    // No feature check - all teams can invite members
    // Just check the limit (Free: 5, Pro: 25, Enterprise: unlimited)
    await requireLimit(input.teamId, LIMITS.MAX_MEMBERS_PER_TEAM)

    const invitation = await createTeamInvitation(input)
    return invitation
  })
```

### Pattern 3: Feature + Limit Gating

Use when you need both capability check and usage control.

```typescript
// src/actions/programming-track-actions.ts

export const createProgrammingTrackAction = createServerAction()
  .input(z.object({
    teamId: z.string(),
    name: z.string(),
  }))
  .handler(async ({ input }) => {
    // 1. Feature check: Does team have programming tracks?
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)

    // 2. Limit check: Can team create more tracks?
    // Free: 5 tracks, Pro/Enterprise: unlimited
    await requireLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    const track = await createProgrammingTrack(input)
    return track
  })
```

### Pattern 4: Hybrid Plan + Entitlement Check

Use when users can get access via plan OR individual purchase.

```typescript
// src/server/entitlements-checks.ts

export async function hasProgrammingTrackAccess(
  userId: string,
  teamId: string,
  trackId: string
): Promise<boolean> {
  // 1. Check team's plan (includes all tracks)
  const teamPlan = await getTeamPlan(teamId)
  if (teamPlan.entitlements.features.includes(FEATURES.PROGRAMMING_TRACKS)) {
    return true  // Plan includes unlimited programming tracks
  }

  // 2. Check individual purchase entitlement
  const entitlements = await getUserEntitlements(
    userId,
    teamId,
    'programming_track_access'
  )

  return entitlements.some((e) => e.metadata?.trackId === trackId)
}
```

### Pattern 5: Check Before Showing UI

Use in server components to conditionally render UI.

```typescript
// src/app/(main)/programming/page.tsx

export default async function ProgrammingPage({ params }) {
  const session = await requireVerifiedEmail()
  const teamId = params.teamId

  // Check feature access
  const hasProgrammingAccess = await hasFeature(
    teamId,
    FEATURES.PROGRAMMING_TRACKS
  )

  if (!hasProgrammingAccess) {
    return (
      <UpgradePrompt
        feature="Programming Tracks"
        description="Create and manage unlimited programming tracks"
        currentPlan="Free (5 tracks max)"
        upgradeTo="Pro (unlimited tracks)"
      />
    )
  }

  // Check current usage
  const limitInfo = await checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 0)

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

### Pattern 6: Progressive Usage Display

Show usage meters as users approach limits.

```typescript
// src/components/dashboard/usage-card.tsx

export async function UsageCard({ teamId }: { teamId: string }) {
  const [membersCheck, tracksCheck, aiCheck] = await Promise.all([
    checkLimit(teamId, LIMITS.MAX_MEMBERS_PER_TEAM, 0),
    checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 0),
    checkLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 0),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <UsageMeter
          label="Team Members"
          current={membersCheck.usedAmount ?? 0}
          limit={membersCheck.currentLimit ?? 0}
          icon={Users}
        />

        <UsageMeter
          label="Programming Tracks"
          current={tracksCheck.usedAmount ?? 0}
          limit={tracksCheck.currentLimit ?? 0}
          icon={Calendar}
        />

        <UsageMeter
          label="AI Messages"
          current={aiCheck.usedAmount ?? 0}
          limit={aiCheck.currentLimit ?? 0}
          icon={Sparkles}
          resetsMonthly
        />
      </CardContent>
    </Card>
  )
}
```

## Plan Configuration Reference

### Current Plans

Plans are stored in the database and seeded from `src/config/seed-data.ts`.
To query plans, use the database query functions from `@/server/entitlements`.

```typescript
// Free Plan
{
  id: 'free',
  features: [
    'basic_workouts',           // Can create basic workouts
    'basic_scaling',            // Can use basic scaling
    'team_collaboration',       // Can collaborate with team
  ],
  limits: {
    max_teams: 1,               // 1 team (excluding personal)
    max_members_per_team: 5,    // 5 members max
    max_programming_tracks: 5,  // 5 programming tracks
    ai_messages_per_month: 10,  // 10 AI messages/month
  }
}

// Pro Plan
{
  id: 'pro',
  features: [
    'basic_workouts',
    'programming_tracks',       // Unlimited programming tracks
    'program_calendar',
    'ai_workout_generation',    // AI features enabled
    'multi_team_management',    // Unlimited teams
  ],
  limits: {
    max_teams: -1,              // -1 = unlimited
    max_members_per_team: 25,
    max_programming_tracks: -1, // -1 = unlimited
    ai_messages_per_month: 200,
  }
}

// Enterprise Plan
{
  id: 'enterprise',
  features: [
    // ... all Pro features ...
    'program_analytics',        // Advanced analytics
    'custom_scaling_groups',    // Custom scaling
    'ai_programming_assistant', // Advanced AI
    'custom_branding',
    'api_access',
  ],
  limits: {
    max_teams: -1,
    max_members_per_team: -1,   // -1 = unlimited
    max_programming_tracks: -1,
    ai_messages_per_month: -1,  // -1 = unlimited
  }
}
```

**Note**: `-1` means unlimited

### Querying Features and Limits

All feature and limit metadata is stored in the database. Use these functions from `@/server/entitlements`:

```typescript
import {
  getAllFeatures,
  getFeatureByKey,
  getAllLimits,
  getLimitByKey,
  getAllPlans,
  getPublicPlans,
  getPlanById,
} from "@/server/entitlements"

// Get all features with metadata
const features = await getAllFeatures()
// Returns: [{ id, key, name, description, category, isActive }, ...]

// Get a specific feature
const programmingFeature = await getFeatureByKey(FEATURES.PROGRAMMING_TRACKS)
// Returns: { id, key, name, description, category, isActive }

// Get all limits with metadata
const limits = await getAllLimits()
// Returns: [{ id, key, name, description, unit, resetPeriod, isActive }, ...]

// Get a specific limit
const teamsLimit = await getLimitByKey(LIMITS.MAX_TEAMS)
// Returns: { id, key, name, description, unit, resetPeriod, isActive }

// Get all plans
const plans = await getAllPlans()
// Returns plans with their features and limits

// Get public plans (available for signup)
const publicPlans = await getPublicPlans()

// Get a specific plan
const proPlan = await getPlanById("pro")
```

### Available Features

Feature keys are defined in `src/config/features.ts` for type safety:

```typescript
// Core workout features
BASIC_WORKOUTS              // Create basic workouts (all plans)

// Programming features
PROGRAMMING_TRACKS          // Create programming tracks (Pro+)
PROGRAM_CALENDAR            // Visual calendar (Pro+)
PROGRAM_ANALYTICS           // Analytics (Enterprise)

// Scaling features
CUSTOM_SCALING_GROUPS       // Custom scaling groups (Enterprise)

// AI features
AI_WORKOUT_GENERATION       // AI workout gen (Pro+)
AI_PROGRAMMING_ASSISTANT    // AI programming (Enterprise)

// Team features
MULTI_TEAM_MANAGEMENT       // Multiple teams (Pro+)
```

**Note**: Feature metadata (name, description, category) is in the database. Query with `getAllFeatures()` or `getFeatureByKey()`.

### Available Limits

Limit keys are defined in `src/config/limits.ts` for type safety:

```typescript
// Team limits
MAX_TEAMS                   // Number of teams (Free: 1, Pro+: unlimited)
MAX_MEMBERS_PER_TEAM        // Members per team (Free: 5, Pro: 25, Enterprise: unlimited)
MAX_ADMINS                  // Admin users per team

// Programming limits
MAX_PROGRAMMING_TRACKS      // Programming tracks (Free: 5, Pro+: unlimited)

// AI limits
AI_MESSAGES_PER_MONTH       // AI messages/month (Free: 10, Pro: 200, Enterprise: unlimited)
                           // Resets monthly

// Storage limits
MAX_FILE_STORAGE_MB         // File storage in MB
MAX_VIDEO_STORAGE_MB        // Video storage in MB
```

**Note**: Limit metadata (name, description, unit, resetPeriod) is in the database. Query with `getAllLimits()` or `getLimitByKey()`.

## Testing Entitlements

### Unit Testing

```typescript
import { hasFeature, checkLimit } from '@/server/entitlements'
import { FEATURES, LIMITS } from '@/config'

describe('Programming Track Access', () => {
  it('should allow Pro teams to create unlimited tracks', async () => {
    const teamId = 'pro-team-id'

    // Feature check
    const hasFeature = await hasFeature(teamId, FEATURES.PROGRAMMING_TRACKS)
    expect(hasFeature).toBe(true)

    // Limit check (should be unlimited)
    const limitCheck = await checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 1)
    expect(limitCheck.allowed).toBe(true)
    expect(limitCheck.currentLimit).toBe(-1) // unlimited
  })

  it('should deny Free teams access to programming tracks', async () => {
    const teamId = 'free-team-id'

    const hasFeature = await hasFeature(teamId, FEATURES.PROGRAMMING_TRACKS)
    expect(hasFeature).toBe(false)
  })

  it('should enforce 5 track limit for Free teams', async () => {
    const teamId = 'free-team-id'

    // Assume team already has 5 tracks
    const limitCheck = await checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 1)
    expect(limitCheck.allowed).toBe(false)
    expect(limitCheck.currentLimit).toBe(5)
    expect(limitCheck.usedAmount).toBe(5)
    expect(limitCheck.reason).toContain('exceed your plan\'s limit of 5')
  })
})
```

### Integration Testing

```typescript
import { createServerAction } from '@/lib/zsa'
import { requireFeature, requireLimit } from '@/server/entitlements'

describe('Create Programming Track Action', () => {
  it('should create track for Pro team', async () => {
    const session = await createTestSession({ planId: 'pro' })

    const result = await createProgrammingTrackAction({
      teamId: session.teamId,
      name: 'Test Track',
    })

    expect(result.success).toBe(true)
  })

  it('should throw error for Free team without feature', async () => {
    const session = await createTestSession({ planId: 'free' })

    await expect(
      createProgrammingTrackAction({
        teamId: session.teamId,
        name: 'Test Track',
      })
    ).rejects.toThrow('This feature requires an upgrade to your plan')
  })

  it('should throw error when limit exceeded', async () => {
    const session = await createTestSession({
      planId: 'free',
      existingTracks: 5  // Already at limit
    })

    await expect(
      createProgrammingTrackAction({
        teamId: session.teamId,
        name: 'Test Track',
      })
    ).rejects.toThrow('exceed your plan\'s limit of 5')
  })
})
```

## Debugging Entitlements

### Check Current Plan

```typescript
import { getTeamPlan } from '@/server/entitlements'

const plan = await getTeamPlan(teamId)
console.log({
  planId: plan.id,
  planName: plan.name,
  features: plan.entitlements.features,
  limits: plan.entitlements.limits,
})

// Example output:
// {
//   planId: 'pro',
//   planName: 'Pro',
//   features: ['basic_workouts', 'programming_tracks', 'ai_workout_generation', ...],
//   limits: { max_teams: -1, max_members_per_team: 25, ... }
// }
```

### Check Current Usage

```typescript
import { checkLimit } from '@/server/entitlements'

const check = await checkLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 0)
console.log({
  allowed: check.allowed,
  current: check.usedAmount,
  limit: check.currentLimit,
  remaining: (check.currentLimit ?? 0) - (check.usedAmount ?? 0),
})

// Example output:
// {
//   allowed: true,
//   current: 15,
//   limit: 200,
//   remaining: 185
// }
```

### Check User Entitlements

```typescript
import { getUserEntitlements } from '@/server/entitlements'

const entitlements = await getUserEntitlements(userId, teamId)
console.log(entitlements.map(e => ({
  type: e.entitlementTypeId,
  source: e.sourceType,
  metadata: e.metadata,
  expiresAt: e.expiresAt,
})))

// Example output:
// [
//   {
//     type: 'programming_track_access',
//     source: 'PURCHASE',
//     metadata: { trackId: 'track_123', trackName: 'Strength Builder' },
//     expiresAt: null
//   }
// ]
```

## Best Practices

### 1. Always Check Server-Side

Never trust client-side checks alone.

```typescript
// ❌ BAD: Only checking in UI
function CreateTrackButton() {
  const hasFeature = useSessionStore(s =>
    s.currentTeam?.plan?.features.includes(FEATURES.PROGRAMMING_TRACKS)
  )

  if (!hasFeature) return null

  return <Button onClick={createTrack}>Create Track</Button>
}

// ✅ GOOD: Check in UI AND server action
export const createProgrammingTrackAction = createServerAction()
  .handler(async ({ input }) => {
    // Always verify server-side
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)
    await requireLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    return await createProgrammingTrack(input)
  })
```

### 2. Use `requireX()` in Server Actions

Use `requireFeature()` and `requireLimit()` in server actions to fail fast.

```typescript
// ✅ GOOD: Clear, throws on failure
export const createTrackAction = createServerAction()
  .handler(async ({ input }) => {
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)
    await requireLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    return await createTrack(input)
  })

// ❌ AVOID: Manual error handling
export const createTrackAction = createServerAction()
  .handler(async ({ input }) => {
    const hasFeature = await hasFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)
    if (!hasFeature) {
      throw new Error('Feature not available')
    }

    const limitCheck = await checkLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason)
    }

    await incrementUsage(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    return await createTrack(input)
  })
```

### 3. Check Limits Without Incrementing

Use `checkLimit()` with `0` to check without consuming.

```typescript
// Check if user can perform action without incrementing
const canCreate = await checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 0)

if (canCreate.allowed) {
  // Show create button
} else {
  // Show upgrade prompt
}
```

### 4. Batch Limit Checks for UI

Fetch multiple limit checks at once for dashboards.

```typescript
const [members, tracks, aiMessages] = await Promise.all([
  checkLimit(teamId, LIMITS.MAX_MEMBERS_PER_TEAM, 0),
  checkLimit(teamId, LIMITS.MAX_PROGRAMMING_TRACKS, 0),
  checkLimit(teamId, LIMITS.AI_MESSAGES_PER_MONTH, 0),
])
```

### 5. Use Descriptive Error Messages

Provide clear upgrade paths in error messages.

```typescript
if (!limitCheck.allowed) {
  throw new Error(
    `You've reached your limit of ${limitCheck.currentLimit} programming tracks. ` +
    `Upgrade to Pro for unlimited tracks.`
  )
}
```

### 6. Handle Unlimited (-1) Correctly

Always check for `-1` when displaying limits.

```typescript
function formatLimit(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toString()
}

// Usage
<div>
  {formatLimit(limitCheck.currentLimit)} programming tracks
</div>
```

### 7. Cache-Invalidate After Changes

Sessions are automatically invalidated when entitlements change, but be aware:

```typescript
// createEntitlement, revokeEntitlement, etc. automatically invalidate sessions
await createEntitlement({ ... })
// User's sessions are now invalidated and will refresh on next request
```

## Troubleshooting

### Feature Check Returns False Unexpectedly

1. **Check team's current plan**:
   ```typescript
   const plan = await getTeamPlan(teamId)
   console.log(plan.entitlements.features)
   ```

2. **Verify feature exists in plan config** (`src/config/plans.ts`)

3. **Check for manual overrides**:
   ```sql
   SELECT * FROM team_entitlement_override
   WHERE teamId = ? AND type = 'feature' AND key = ?
   ```

### Limit Check Fails Unexpectedly

1. **Check current usage**:
   ```typescript
   const check = await checkLimit(teamId, limitKey, 0)
   console.log(`Using ${check.usedAmount}/${check.currentLimit}`)
   ```

2. **Check usage table**:
   ```sql
   SELECT * FROM team_usage
   WHERE teamId = ? AND limitKey = ?
   ORDER BY createdAt DESC
   ```

3. **Verify limit in plan config** (`src/config/plans.ts`)

### User Can't Access Purchased Content

1. **Check user entitlements**:
   ```typescript
   const entitlements = await getUserEntitlements(userId, teamId)
   console.log(entitlements)
   ```

2. **Verify entitlement not expired or deleted**:
   ```sql
   SELECT * FROM entitlement
   WHERE userId = ? AND deletedAt IS NULL
   AND (expiresAt IS NULL OR expiresAt > datetime('now'))
   ```

3. **Check session is up-to-date**: User may need to re-login to refresh session

## Migration from Old System

If you're updating code that doesn't use entitlements yet:

### Before (No Entitlement Checks)

```typescript
export const createProgrammingTrackAction = createServerAction()
  .handler(async ({ input }) => {
    // No checks - anyone can create unlimited tracks
    const track = await createProgrammingTrack(input)
    return track
  })
```

### After (With Entitlements)

```typescript
export const createProgrammingTrackAction = createServerAction()
  .handler(async ({ input }) => {
    // Add entitlement checks
    await requireFeature(input.teamId, FEATURES.PROGRAMMING_TRACKS)
    await requireLimit(input.teamId, LIMITS.MAX_PROGRAMMING_TRACKS)

    const track = await createProgrammingTrack(input)
    return track
  })
```

## Summary

### Quick Reference Table

| Scenario | Feature? | Limit? | Function to Use |
|----------|----------|--------|----------------|
| Gate entire capability | ✅ | ❌ | `requireFeature()` |
| Control quantity (all have access) | ❌ | ✅ | `requireLimit()` |
| Gate capability + control quantity | ✅ | ✅ | Both |
| Check access without consuming | ✅/❌ | ✅ | `hasFeature()`, `checkLimit(..., 0)` |
| Individual purchases | ❌ | ❌ | `createEntitlement()` |

### Decision Tree

```
Do all users have this capability?
├─ YES: Use limits only
│  └─ requireLimit(teamId, limitKey)
│
└─ NO: Some plans don't have it
   └─ Is there a quantity restriction?
      ├─ YES: Use feature + limit
      │  ├─ requireFeature(teamId, featureId)
      │  └─ requireLimit(teamId, limitKey)
      │
      └─ NO: Use feature only
         └─ requireFeature(teamId, featureId)
```

## File References

- **Entitlements Service**: `src/server/entitlements.ts` - Database queries and entitlement logic
- **Features Constants**: `src/config/features.ts` - Feature key constants only
- **Limits Constants**: `src/config/limits.ts` - Limit key constants only
- **Seed Data**: `src/config/seed-data.ts` - Source of truth for seeding the database
- **Seed Script**: `scripts/seed-entitlements.ts` - Populates database from seed data
- **Database Schema**: `src/db/schemas/entitlements.ts` - Database table definitions
- **System Plan**: `docs/entitlements-system-plan.md`

**Note**: All plan, feature, and limit data is stored in the database. The config files only provide constant keys for type safety.

## Questions?

If you're unsure whether to use a feature, limit, or both:

1. Ask: "Can some users do this while others can't?" → **Feature**
2. Ask: "Can all users do this, but with different quantities?" → **Limit**
3. Ask: "Can some users do this, and those who can have different quantities?" → **Both**

When in doubt, check the entitlements system plan or ask the team!
