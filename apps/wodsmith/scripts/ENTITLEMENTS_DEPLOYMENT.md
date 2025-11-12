# Entitlements System Deployment Guide

This guide explains how to deploy the new entitlements system to production.

## Overview

The entitlements system introduces snapshot-based plan management, where each team gets a snapshot of their plan's features and limits. This decouples billing from entitlements, allowing plan changes without affecting existing customers.

## Deployment Steps

### 1. Run Migrations

First, apply the database migrations to create the new tables:

```bash
# Production
pnpm db:migrate:prod

# Staging
pnpm db:migrate:staging
```

This creates:
- `entitlement_type` - Types of entitlements (programming track access, AI credits, etc.)
- `feature` - Available features (programming tracks, AI generation, etc.)
- `limit` - Available limits (max teams, AI messages, etc.)
- `plan` - Subscription plans (free, pro, enterprise)
- `plan_feature` - Junction table linking plans to features
- `plan_limit` - Junction table linking plans to limits with values
- `team_subscription` - Team subscription tracking
- `team_addon` - Team add-on purchases
- `team_entitlement_override` - Manual admin overrides
- `team_usage` - Usage tracking for limits
- `team_feature_entitlement` - **Snapshot of features per team (SOURCE OF TRUTH)**
- `team_limit_entitlement` - **Snapshot of limits per team (SOURCE OF TRUTH)**

### 2. Seed Entitlements Data

Seed the features, limits, and plans:

```bash
# Production
pnpm db:seed:entitlements:prod

# Staging
pnpm db:seed:entitlements:staging
```

This script (`seed-entitlements-production.sql`) does the following:
- Seeds entitlement types
- Seeds features (basic_workouts, programming_tracks, etc.)
- Seeds limits (max_teams, ai_messages_per_month, etc.)
- Seeds plans (free, pro, enterprise)
- Links features to plans via `plan_feature` table
- Links limits to plans via `plan_limit` table with values
- **Sets all existing teams to have `current_plan_id = 'free'`**

### 3. Snapshot Team Entitlements

After seeding, snapshot the free plan to all existing teams:

```bash
# Production
pnpm db:snapshot:teams:prod

# Staging
pnpm db:snapshot:teams:staging

# Local (uses TypeScript, requires getDb() to work)
pnpm db:snapshot:teams:dev
```

This script (`snapshot-teams-production.sql` or `snapshot-teams-production.ts`) does the following:
- For each team, snapshots their plan's features to `team_feature_entitlement`
- For each team, snapshots their plan's limits to `team_limit_entitlement`
- These snapshots become the SOURCE OF TRUTH for what each team has access to

### 4. Verify Deployment

After deployment, verify the data:

```sql
-- Check that plans were created
SELECT * FROM plan;

-- Check that features were created
SELECT * FROM feature;

-- Check that limits were created
SELECT * FROM limit;

-- Check that teams have the free plan
SELECT id, name, current_plan_id FROM team WHERE current_plan_id = 'free';

-- Check that teams have feature entitlements snapshotted
SELECT COUNT(*) FROM team_feature_entitlement;

-- Check that teams have limit entitlements snapshotted
SELECT COUNT(*) FROM team_limit_entitlement;

-- Check a specific team's entitlements
SELECT
  f.key,
  f.name,
  tfe.source
FROM team_feature_entitlement tfe
JOIN feature f ON tfe.feature_id = f.id
WHERE tfe.team_id = 'YOUR_TEAM_ID';

SELECT
  l.key,
  l.name,
  tle.value,
  tle.source
FROM team_limit_entitlement tle
JOIN limit l ON tle.limit_id = l.id
WHERE tle.team_id = 'YOUR_TEAM_ID';
```

## How It Works

### Plan Management

1. **Plan Definition** (`plan`, `plan_feature`, `plan_limit`)
   - Defines what NEW subscribers get
   - Can be changed without affecting existing customers

2. **Team Snapshot** (`team_feature_entitlement`, `team_limit_entitlement`)
   - Each team gets a snapshot when they subscribe
   - This snapshot is their SOURCE OF TRUTH
   - Never changes unless explicitly updated

3. **Entitlement Checks** (`src/server/entitlements.ts`)
   - Always queries team snapshots, NOT plan definitions
   - `hasFeature()` checks `team_feature_entitlement`
   - `checkLimit()` checks `team_limit_entitlement`

### Limit Tracking

Limits are tracked in the `team_usage` table:
- Each limit has a `resetPeriod` (monthly, yearly, never)
- Usage is tracked per period
- `incrementUsage()` updates current period's usage
- `checkLimit()` compares usage against team's limit snapshot

### Example Flow

1. **Team subscribes to Pro plan**:
   ```typescript
   await snapshotPlanEntitlements(teamId, 'pro')
   ```
   - Snapshots Pro plan's features to `team_feature_entitlement`
   - Snapshots Pro plan's limits to `team_limit_entitlement`

2. **Admin updates Pro plan** (adds new feature):
   - Updates `plan_feature` table
   - Existing Pro customers are NOT affected
   - New Pro subscribers get the new feature

3. **Team uses AI feature**:
   ```typescript
   await requireLimit(teamId, 'ai_messages_per_month', 1)
   ```
   - Checks team's limit snapshot (not plan definition)
   - Increments usage in `team_usage` table
   - Throws error if limit exceeded

## Rollback

If you need to rollback:

1. **Remove team entitlements**:
   ```sql
   DELETE FROM team_feature_entitlement;
   DELETE FROM team_limit_entitlement;
   ```

2. **Remove plan data**:
   ```sql
   DELETE FROM plan_limit;
   DELETE FROM plan_feature;
   DELETE FROM plan;
   DELETE FROM limit;
   DELETE FROM feature;
   DELETE FROM entitlement_type;
   ```

3. **Reset team plans**:
   ```sql
   UPDATE team SET current_plan_id = NULL;
   ```

4. **Revert migrations** (if needed):
   ```bash
   # Create down migrations and apply them
   pnpm db:migrate:prod
   ```

## Local Development

For local development, use the existing seed script:

```bash
pnpm db:seed
```

This runs `scripts/seed-all.sh` which includes entitlements seeding.

## Notes

- **Safe to run multiple times**: Both SQL scripts use `INSERT OR IGNORE` so they won't create duplicates
- **Team snapshots are independent**: Changing a plan definition doesn't affect existing teams
- **Manual overrides**: Use `team_entitlement_override` table for custom team access
- **Add-ons**: Use `team_addon` table for purchased add-ons that modify entitlements

## Support

If you encounter issues:
1. Check the verification queries above
2. Review the error logs from the snapshot script
3. Ensure migrations ran successfully before seeding
4. Contact the development team for assistance
