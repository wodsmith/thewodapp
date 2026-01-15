-- Grant AI Programming Assistant access to admin@example.com teams
-- This adds feature overrides so the admin user can access AI features

-- First, get the feature ID for AI_PROGRAMMING_ASSISTANT
-- (We'll use a subquery to look it up)

-- Grant AI access to admin's personal team
INSERT INTO team_entitlement_override (
  id,
  teamId,
  type,
  key,
  value,
  expiresAt,
  createdAt,
  updatedAt,
  updateCounter
)
VALUES (
  'override_ai_admin_personal',
  'team_personaladmin',
  'feature',
  'ai_programming_assistant',
  'true',
  NULL, -- No expiration
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
)
ON CONFLICT(id) DO UPDATE SET
  value = 'true',
  expiresAt = NULL,
  updatedAt = strftime('%s', 'now');

-- Grant AI access to CrossFit Box One (admin's main team)
INSERT INTO team_entitlement_override (
  id,
  teamId,
  type,
  key,
  value,
  expiresAt,
  createdAt,
  updatedAt,
  updateCounter
)
VALUES (
  'override_ai_box_one',
  'team_cokkpu1klwo0ulfhl1iwzpvnbox1',
  'feature',
  'ai_programming_assistant',
  'true',
  NULL, -- No expiration
  strftime('%s', 'now'),
  strftime('%s', 'now'),
  0
)
ON CONFLICT(id) DO UPDATE SET
  value = 'true',
  expiresAt = NULL,
  updatedAt = strftime('%s', 'now');

-- Verify the overrides were created
SELECT
  teo.id,
  teo.teamId,
  t.name as teamName,
  teo.type,
  teo.key,
  teo.value,
  datetime(teo.expiresAt, 'unixepoch') as expiresAt
FROM team_entitlement_override teo
JOIN team t ON t.id = teo.teamId
WHERE teo.key = 'ai_programming_assistant'
  AND teo.teamId IN ('team_personaladmin', 'team_cokkpu1klwo0ulfhl1iwzpvnbox1');
