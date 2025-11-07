-- Production Migration: Snapshot Free Plan to All Existing Teams
-- Run this AFTER seed-entitlements-production.sql
-- This ensures all teams have their plan entitlements snapshotted
--
-- Usage:
--   wrangler d1 execute <db-name> --file=scripts/snapshot-teams-production.sql --remote

-- ============================================================================
-- SNAPSHOT FEATURES TO TEAMS
-- ============================================================================

-- Insert team_feature_entitlement records for all teams based on their current plan
-- This snapshots the plan's features to each team

INSERT OR IGNORE INTO team_feature_entitlement (id, teamId, featureId, source, sourcePlanId, createdAt, updatedAt, updateCounter)
SELECT
  'team_feat_' || lower(hex(randomblob(16))) as id,
  t.id as teamId,
  pf.featureId,
  'plan' as source,
  COALESCE(t.currentPlanId, 'free') as sourcePlanId,
  strftime('%s', 'now') as createdAt,
  strftime('%s', 'now') as updatedAt,
  0 as updateCounter
FROM team t
CROSS JOIN plan_feature pf
WHERE pf.planId = COALESCE(t.currentPlanId, 'free')
  -- Only insert if this team doesn't already have this feature
  AND NOT EXISTS (
    SELECT 1 FROM team_feature_entitlement tfe
    WHERE tfe.teamId = t.id AND tfe.featureId = pf.featureId
  );

-- ============================================================================
-- SNAPSHOT LIMITS TO TEAMS
-- ============================================================================

-- Insert team_limit_entitlement records for all teams based on their current plan
-- This snapshots the plan's limits to each team

INSERT OR IGNORE INTO team_limit_entitlement (id, teamId, limitId, value, source, sourcePlanId, createdAt, updatedAt, updateCounter)
SELECT
  'team_limit_' || lower(hex(randomblob(16))) as id,
  t.id as teamId,
  pl.limitId,
  pl.value,
  'plan' as source,
  COALESCE(t.currentPlanId, 'free') as sourcePlanId,
  strftime('%s', 'now') as createdAt,
  strftime('%s', 'now') as updatedAt,
  0 as updateCounter
FROM team t
CROSS JOIN plan_limit pl
WHERE pl.planId = COALESCE(t.currentPlanId, 'free')
  -- Only insert if this team doesn't already have this limit
  AND NOT EXISTS (
    SELECT 1 FROM team_limit_entitlement tle
    WHERE tle.teamId = t.id AND tle.limitId = pl.limitId
  );

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show counts for verification
SELECT
  'Teams processed' as metric,
  COUNT(DISTINCT id) as count
FROM team;

SELECT
  'Feature entitlements created' as metric,
  COUNT(*) as count
FROM team_feature_entitlement;

SELECT
  'Limit entitlements created' as metric,
  COUNT(*) as count
FROM team_limit_entitlement;

SELECT 'Snapshot migration completed successfully!' as status;
