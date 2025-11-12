# Entitlements System Scripts

## Overview

Team limits are tracked using a **snapshot + usage** pattern:

1. **`team_limit_entitlement`** - Snapshot of team's limits (SOURCE OF TRUTH)
2. **`team_usage`** - Current usage per limit per period

When checking limits:
```typescript
// Get team's snapshotted limit
const maxLimit = await getTeamLimit(teamId, limitKey)

// Get current usage for period
const currentUsage = await getCurrentUsage(teamId, limitKey)

// Compare
const wouldExceed = currentUsage + incrementBy > maxLimit
```

## Local Development

For local development, everything is handled automatically:

```bash
pnpm db:seed
```

This runs `scripts/seed-all.sh` which:
1. Seeds `seed.sql` (includes entitlements data)
2. Seeds crossfit heroes data
3. Snapshots team entitlements via `migrate-teams-to-snapshot-entitlements.ts`

## Production Deployment

### Step 1: Run Migrations

Apply database migrations to create new tables:

```bash
# Production
pnpm db:migrate:prod

# Staging
pnpm db:migrate:staging
```

### Step 2: Seed Entitlements Data

Seed features, limits, plans, and update existing teams:

```bash
# Production
pnpm db:seed:entitlements:prod

# Staging
pnpm db:seed:entitlements:staging
```

This script (`seed-entitlements-production.sql`):
- Seeds entitlement types, features, limits, plans
- Links features/limits to plans via junction tables
- **Sets all existing teams to `current_plan_id = 'free'`**

### Step 3: Snapshot Team Entitlements

Snapshot each team's plan to their entitlement tables:

```bash
# Production
pnpm db:snapshot:teams:prod

# Staging
pnpm db:snapshot:teams:staging

# Local (TypeScript version)
pnpm db:snapshot:teams:dev
```

This script (`snapshot-teams-production.sql`):
- Snapshots each team's features to `team_feature_entitlement`
- Snapshots each team's limits to `team_limit_entitlement`
- These snapshots become the SOURCE OF TRUTH

## Scripts Reference

### Local Development
- **`seed.sql`** - Includes all entitlements data for local dev
- **`seed-all.sh`** - Master seed script (includes snapshot step)
- **`migrate-teams-to-snapshot-entitlements.ts`** - Snapshots teams (called by seed-all.sh)
  - Note: Requires Cloudflare Workers context, only works when called from seed-all.sh

### Production
- **`seed-entitlements-production.sql`** - Seeds metadata (wrangler)
- **`snapshot-teams-production.sql`** - Snapshots teams (wrangler, recommended)
- **`snapshot-teams-production.ts`** - TypeScript version (requires Cloudflare context)
- **`ENTITLEMENTS_DEPLOYMENT.md`** - Full deployment guide

**Note:** For standalone execution, use the SQL scripts. The TypeScript versions require Cloudflare Workers context.

## NPM Scripts

```bash
# Seed entitlements metadata (features, limits, plans)
pnpm db:seed:entitlements:prod      # Production
pnpm db:seed:entitlements:staging   # Staging

# Snapshot team entitlements (SQL version, recommended)
pnpm db:snapshot:teams:prod         # Production
pnpm db:snapshot:teams:staging      # Staging

# Note: db:snapshot:teams:dev requires Cloudflare context
# Use the SQL version directly instead:
wrangler d1 execute $(node scripts/get-db-name.mjs) --local --file=scripts/snapshot-teams-production.sql
```

## Key Principles

1. **Plans are metadata** - Define what new subscribers get
2. **Team snapshots are truth** - What existing customers have
3. **Decoupled from billing** - Plan changes don't affect existing customers
4. **Period-based usage** - Limits reset per period (monthly, yearly, never)

## Example: Adding a New Limit

1. Add to `src/config/limits.ts`:
   ```typescript
   export const LIMITS = {
     MAX_CUSTOM_MOVEMENTS: "max_custom_movements"
   }
   ```

2. Add to `src/config/seed-data.ts`:
   ```typescript
   {
     key: LIMITS.MAX_CUSTOM_MOVEMENTS,
     name: "Custom Movements",
     description: "Number of custom movements you can create",
     unit: "movements",
     resetPeriod: "never"
   }
   ```

3. Update plan limits in `PLAN_SEED_DATA`

4. Run seed script to update database

5. Run snapshot script to update existing teams

## Verification

After deployment, verify:

```sql
-- Check plans exist
SELECT * FROM plan;

-- Check teams have snapshots
SELECT COUNT(*) FROM team_feature_entitlement;
SELECT COUNT(*) FROM team_limit_entitlement;

-- Check specific team
SELECT l.key, l.name, tle.value
FROM team_limit_entitlement tle
JOIN limit l ON tle.limit_id = l.id
WHERE tle.team_id = 'YOUR_TEAM_ID';
```

## See Also

- **`ENTITLEMENTS_DEPLOYMENT.md`** - Complete deployment guide
- **`docs/entitlements-usage-guide.md`** - Usage documentation
- **`src/server/entitlements.ts`** - Core entitlements service
