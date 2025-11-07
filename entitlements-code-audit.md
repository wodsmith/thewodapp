# Entitlements System Code Audit

## Executive Summary

Audit of all entitlement/limit/feature checks in the codebase to align with the new snapshot-based entitlements system. **Key finding**: Programming tracks ARE available on the Free tier (limit: 5 tracks) but UI messaging incorrectly says they're not available.

---

## New Entitlements Architecture (Reference)

### Core Concepts
1. **Snapshot-based system**: Team entitlements are snapshotted when they subscribe to a plan
2. **Separation of billing from entitlements**: Plan changes don't retroactively affect existing customers
3. **Feature access**: Boolean flags (`programming_tracks`, `ai_workout_generation`, etc.)
4. **Limits**: Numeric quotas (`max_programming_tracks: 5`, `max_teams: 1`, etc.)
5. **Limits value of -1 = unlimited**

### Current Plan Configuration (from seed-data.ts)

#### Free Plan
- **Features**: `basic_workouts` only
- **Limits**:
  - `max_teams`: 1
  - `max_members_per_team`: 5
  - `max_programming_tracks`: **5** ⚠️
  - `ai_messages_per_month`: 10
  - `max_admins`: 2

**IMPORTANT**: Free tier does NOT have the `programming_tracks` FEATURE flag, but HAS a limit of 5 tracks. This is a **configuration inconsistency**.

#### Pro Plan
- **Features**: `basic_workouts`, `programming_tracks`, `program_calendar`, `custom_scaling_groups`, `ai_workout_generation`, `multi_team_management`
- **Limits**:
  - `max_teams`: -1 (unlimited)
  - `max_members_per_team`: 25
  - `max_programming_tracks`: -1 (unlimited)
  - `ai_messages_per_month`: 200

#### Enterprise Plan
- All features + `program_analytics`, `ai_programming_assistant`
- All limits unlimited (-1)

---

## Issues Found

### 🔴 CRITICAL: Programming Tracks Confusion

**Location**: `src/server/entitlements-checks.ts:180-232`

**Current Behavior**:
```typescript
const hasFeature = teamPlan.entitlements.features.includes(
  FEATURES.PROGRAMMING_TRACKS,
)

if (!hasFeature) {
  message = `Programming tracks are not available on the ${planName} plan. Upgrade to Pro or Enterprise to create programming tracks.`
}
```

**Problem**:
1. Free tier **DOES NOT** have `FEATURES.PROGRAMMING_TRACKS` feature flag
2. Free tier **DOES** have `MAX_PROGRAMMING_TRACKS: 5` limit
3. UI tells users "programming tracks not available on Free plan"
4. But the limit suggests they should be able to create 5 tracks

**Root Cause**: Configuration inconsistency between features and limits in seed data.

**Decision Required**: Choose one of:

#### Option A: Free tier SHOULD have programming tracks (recommended)
- **Change**: Add `FEATURES.PROGRAMMING_TRACKS` to Free plan features
- **Reasoning**: Limit of 5 suggests this was intended
- **Impact**: Users can create 5 tracks on free tier
- **Marketing angle**: "Try programming tracks free, upgrade for unlimited"

#### Option B: Free tier should NOT have programming tracks
- **Change**: Remove `MAX_PROGRAMMING_TRACKS` limit from Free plan (or set to 0)
- **Reasoning**: Clear feature gating for monetization
- **Impact**: Must upgrade to Pro to create any tracks
- **Marketing angle**: "Programming tracks only in Pro/Enterprise"

---

### 🟡 MEDIUM: Entitlement Check Logic in Server Functions

#### File: `src/server/programming-tracks.ts:48-60`

**Current Code**:
```typescript
if (data.ownerTeamId) {
  // Check if team has programming tracks feature
  await requireFeature(data.ownerTeamId, FEATURES.PROGRAMMING_TRACKS)

  // Check if team has reached programming track limit
  await requireLimit(data.ownerTeamId, LIMITS.MAX_PROGRAMMING_TRACKS)
}
```

**Status**: ✅ CORRECT - Using new entitlements system properly

**Note**: This will enforce BOTH feature check AND limit check. Based on decision above, may need adjustment.

---

#### File: `src/server/team-members.ts:246-248`

**Current Code**:
```typescript
// Check if team has reached member limit based on their plan
// This will throw if the limit would be exceeded
await requireLimit(teamId, LIMITS.MAX_MEMBERS_PER_TEAM)
```

**Status**: ✅ CORRECT - Using new entitlements system properly

---

#### File: `src/server/teams.ts:45-47`

**Current Code**:
```typescript
// Check if user has reached their team creation limit
// NOTE: Personal teams (isPersonalTeam = true) do NOT count toward this limit
await requireLimitExcludingPersonalTeams(userId, LIMITS.MAX_TEAMS)
```

**Status**: ✅ CORRECT - Using new entitlements system properly

---

#### File: `src/app/api/chat/route.ts:44-57`

**Current Code**:
```typescript
try {
  // Check if team has AI feature access
  await requireFeature(body.teamId, FEATURES.AI_WORKOUT_GENERATION)

  // Check and increment AI message usage
  // This checks if team has messages remaining and increments by 1
  await requireLimit(body.teamId, LIMITS.AI_MESSAGES_PER_MONTH, 1)
} catch (error) {
  // ZSAError thrown by requireFeature/requireLimit
  if (error instanceof Error) {
    return new Response(error.message, { status: 403 })
  }
  return new Response("Access denied", { status: 403 })
}
```

**Status**: ✅ CORRECT - Using new entitlements system properly

**Issue**: Free tier has:
- NO `ai_workout_generation` feature
- BUT has `ai_messages_per_month: 10` limit

Same inconsistency as programming tracks. Decision needed:
- Should Free tier have AI (with 10 msg limit)?
- Or should AI be Pro+ only?

---

### 🟢 INFO: UI Components Using Entitlement Checks

All UI components are correctly using the check functions:

1. **Programming Track Create Dialog** (`src/app/(admin)/admin/teams/[teamId]/programming/_components/programming-track-create-dialog.tsx:165-183`)
   - Uses `checkCanCreateProgrammingTrackAction`
   - Shows proper error messages
   - ✅ Implementation correct, but displays wrong message due to config issue

2. **Invite Member Modal** (`src/components/teams/invite-member-modal.tsx:75-79`)
   - Uses `checkCanInviteMemberAction`
   - ✅ Correct

3. **Create Team Form** (`src/components/teams/create-team-form.tsx:78-81`)
   - Uses `limitCheck` prop from server
   - ✅ Correct

4. **Chat Page** (`src/app/(main)/chat/page.tsx:53-57`)
   - Uses `checkCanUseAIAction`
   - ✅ Correct

5. **Create Team Page** (`src/app/(settings)/settings/teams/create/page.tsx:21`)
   - Uses `checkCanCreateTeam()`
   - ✅ Correct

---

### 🟡 MEDIUM: Error Messages Hardcoding Plan Names

#### Location: `src/server/entitlements-checks.ts:210`

```typescript
message = `Programming tracks are not available on the ${planName} plan. Upgrade to Pro or Enterprise to create programming tracks.`
```

**Issue**: Hardcodes "Pro or Enterprise" - should be dynamic

**Fix**: Change to generic "upgrade" message
```typescript
message = `Programming tracks are not available on the ${planName} plan. Upgrade your plan to create programming tracks.`
```

#### Location: `src/server/entitlements-checks.ts:277`

```typescript
message = `AI features are not available on the ${planName} plan. Upgrade to Pro or Enterprise to use AI.`
```

**Issue**: Same - hardcodes plan names

**Fix**:
```typescript
message = `AI features are not available on the ${planName} plan. Upgrade your plan to use AI features.`
```

---

## Required Code Changes

### Priority 1: Resolve Configuration Inconsistency

**File**: `src/config/seed-data.ts`

**Current Free Plan Config**:
```typescript
{
  id: "free",
  name: "Free",
  features: [FEATURES.BASIC_WORKOUTS],  // ← No programming_tracks feature
  limits: {
    [LIMITS.MAX_PROGRAMMING_TRACKS]: 5,  // ← But has limit of 5 tracks
    // ...
  }
}
```

**Option A Fix** (Recommended - Add feature to Free):
```typescript
{
  id: "free",
  name: "Free",
  features: [
    FEATURES.BASIC_WORKOUTS,
    FEATURES.PROGRAMMING_TRACKS,  // ← ADD THIS
  ],
  limits: {
    [LIMITS.MAX_PROGRAMMING_TRACKS]: 5,  // Keep as-is
    // ...
  }
}
```

**Option B Fix** (Remove from Free):
```typescript
{
  id: "free",
  name: "Free",
  features: [FEATURES.BASIC_WORKOUTS],  // Keep as-is
  limits: {
    [LIMITS.MAX_PROGRAMMING_TRACKS]: 0,  // ← CHANGE from 5 to 0
    // ...
  }
}
```

**After changing seed data, run**:
```bash
pnpm db:seed
```

Then snapshot all teams to new config:
```typescript
// Run this migration script or admin function
await snapshotAllTeams()
```

---

### Priority 2: Fix Hardcoded Plan Names in Messages

**File**: `src/server/entitlements-checks.ts`

**Changes**:

```typescript
// Line 210
// OLD:
message = `Programming tracks are not available on the ${planName} plan. Upgrade to Pro or Enterprise to create programming tracks.`

// NEW:
message = `Programming tracks are not available on the ${planName} plan. Upgrade your plan to create programming tracks.`

// Line 277
// OLD:
message = `AI features are not available on the ${planName} plan. Upgrade to Pro or Enterprise to use AI.`

// NEW:
message = `AI features are not available on the ${planName} plan. Upgrade your plan to use AI features.`
```

---

### Priority 3: Verify AI Configuration

**File**: `src/config/seed-data.ts`

**Current Free Plan**:
```typescript
features: [FEATURES.BASIC_WORKOUTS],  // No AI feature
limits: {
  [LIMITS.AI_MESSAGES_PER_MONTH]: 10,  // But has 10 messages
}
```

**Decision Required**: Same as programming tracks

**Option A** (Add AI to Free with 10 msg limit):
```typescript
features: [
  FEATURES.BASIC_WORKOUTS,
  FEATURES.AI_WORKOUT_GENERATION,  // ADD
],
```

**Option B** (Remove AI from Free):
```typescript
limits: {
  [LIMITS.AI_MESSAGES_PER_MONTH]: 0,  // CHANGE from 10
}
```

---

## Testing Checklist

After making changes:

### 1. Free Tier Team
- [ ] Create new free tier team
- [ ] Verify entitlements snapshot created
- [ ] Try creating programming track (should work if Option A, fail if Option B)
- [ ] Verify limit enforcement (5 tracks max if Option A)
- [ ] Try using AI chat (should work if Option A for AI, fail if Option B)
- [ ] Verify AI message counting

### 2. Pro Tier Team
- [ ] Create pro tier team
- [ ] Verify unlimited programming tracks (-1)
- [ ] Create 10+ tracks
- [ ] Verify AI messages (200 limit)

### 3. Existing Teams Migration
- [ ] Run `snapshotAllTeams()` for existing teams
- [ ] Verify all teams have snapshots
- [ ] Spot check 5-10 teams to verify correct entitlements

### 4. UI/UX
- [ ] Programming track create dialog shows correct message
- [ ] Invite member modal shows correct limits
- [ ] Create team page shows correct limits
- [ ] Chat page shows correct AI limits
- [ ] All error messages are dynamic (no hardcoded "Pro or Enterprise")

---

## Summary of Files That Need Changes

### Must Change:
1. ✅ `src/config/seed-data.ts` - Fix feature/limit inconsistency
2. ✅ `src/server/entitlements-checks.ts` - Fix hardcoded plan names in messages

### Already Correct (No Changes Needed):
1. ✅ `src/server/programming-tracks.ts` - Using new system correctly
2. ✅ `src/server/team-members.ts` - Using new system correctly
3. ✅ `src/server/teams.ts` - Using new system correctly
4. ✅ `src/app/api/chat/route.ts` - Using new system correctly
5. ✅ All UI components - Using check actions correctly

### Optional Review:
1. ⚠️ `src/server/entitlements.ts` - Review for any additional hardcoded assumptions
2. ⚠️ `src/actions/entitlements-actions.ts` - Review action wrappers

---

## Migration Steps

1. **Decide on Feature/Limit Alignment**
   - Choose Option A or B for programming tracks
   - Choose Option A or B for AI features
   - Update `src/config/seed-data.ts`

2. **Update Error Messages**
   - Remove hardcoded plan names in `src/server/entitlements-checks.ts`

3. **Reseed Database**
   ```bash
   pnpm db:seed
   ```

4. **Snapshot Existing Teams**
   - Run snapshot migration for all existing teams
   - This ensures they get the new plan configurations

5. **Test All Flows**
   - Follow testing checklist above

6. **Deploy**
   - Stage changes
   - Run migrations in production
   - Monitor for issues

---

## Recommendations

### For Free Tier Features

**Recommendation**: **Option A** - Give Free tier limited access to both programming tracks and AI

**Reasoning**:
1. **Better conversion funnel**: Let users try features before buying
2. **Competitive**: Most SaaS offer limited freemium features
3. **Already configured**: Limits already exist (5 tracks, 10 AI messages)
4. **Clear upgrade path**: "You've used 5/5 tracks, upgrade for unlimited"

**Marketing Message**:
- "Try programming with 5 tracks free"
- "Test AI with 10 messages/month free"
- "Upgrade to Pro for unlimited"

This creates a natural upgrade flow when users hit limits.

---

## Additional Notes

### Snapshot System Benefits
- Future plan changes won't affect existing customers
- Can offer custom entitlements per team
- Easy to create limited-time promotions
- Grandfathering old customers is automatic

### Feature vs Limit Pattern
Current pattern:
- **Feature flag** = boolean access (can use at all?)
- **Limit** = numeric quota (how much can use?)

**Best practice**:
- If limit > 0, feature should be enabled
- If feature disabled, limit should be 0
- Avoid the current inconsistency

### Future Considerations
- Add `team_entitlement_override` table usage for:
  - Custom enterprise deals
  - Promotional access
  - Beta feature access
- Consider add-ons for increasing limits without plan change
