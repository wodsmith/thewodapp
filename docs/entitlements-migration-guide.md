# Entitlements System Migration Guide

## Problem

The refactored entitlements system uses a **snapshot-based approach** where each team's features and limits are copied from their plan into team-specific tables (`team_feature_entitlement` and `team_limit_entitlement`).

Existing teams created before this system don't have these snapshots, so their features and limits won't show up.

## Solution

The system now includes:
1. **Automatic fallback**: `getTeamPlan()` automatically falls back to the plan definition if no snapshot exists
2. **Migration utilities**: Functions to snapshot existing teams' entitlements

## Quick Fix: Let the Fallback Handle It

The simplest approach is to do nothing. The system will automatically use the plan definition for teams without snapshots. You'll see warnings in the logs like:

```
[Entitlements] Team xxx has no snapshotted entitlements, falling back to plan definition. Consider running snapshotPlanEntitlements().
```

This works fine but doesn't provide the benefits of the snapshot system (grandfathering, independent entitlement changes).

## Proper Migration: Snapshot All Teams

To fully migrate to the snapshot system:

### Option 1: Run Migration Script

```bash
pnpm tsx scripts/migrate-snapshot-team-entitlements.ts
```

This will:
- Find all teams in the database
- Create snapshot records for teams without them
- Skip teams that already have snapshots
- Report success/failure for each team

### Option 2: Use Utility Function

From your code:

```typescript
import { snapshotAllTeams } from "@/server/entitlements"

const result = await snapshotAllTeams()
console.log(`Migrated ${result.success} teams`)
if (result.failed > 0) {
  console.error("Errors:", result.errors)
}
```

### Option 3: Snapshot Individual Teams

```typescript
import { snapshotPlanEntitlements } from "@/server/entitlements"

// When creating a new team
await snapshotPlanEntitlements(teamId, planId)

// When changing a team's plan (already handled in updateTeamPlanAction)
await snapshotPlanEntitlements(teamId, newPlanId)
```

## Checking Migration Status

```typescript
import { teamHasSnapshot } from "@/server/entitlements"

const hasSnapshot = await teamHasSnapshot(teamId)
if (!hasSnapshot) {
  console.log("Team needs migration")
}
```

## When Snapshots Are Created Automatically

The system automatically creates snapshots when:

1. **Admin changes team plan** - via `updateTeamPlanAction`
2. **Team upgrades/downgrades** - via billing webhooks (when implemented)
3. **New team creation** - should call `snapshotPlanEntitlements()` after setting `currentPlanId`

## Benefits of Snapshot System

Once migrated, teams get:

1. **Grandfathering**: Keep their features/limits even if the plan changes
2. **Independent updates**: Admin can modify specific team's entitlements
3. **Audit trail**: Track when/why entitlements changed
4. **Proper separation**: Billing (plan) separate from access (entitlements)

## Rollback

If you need to revert:

1. Delete snapshot records:
   ```sql
   DELETE FROM team_feature_entitlement;
   DELETE FROM team_limit_entitlement;
   ```

2. System will automatically fall back to plan definitions

## Testing

After migration:

```typescript
import { getTeamPlan } from "@/server/entitlements"

const teamPlan = await getTeamPlan(teamId)
console.log("Features:", teamPlan.entitlements.features)
console.log("Limits:", teamPlan.entitlements.limits)
```

Should show the team's features and limits without any fallback warnings.
