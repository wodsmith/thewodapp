-- SQL to Insert a Programming Track
-- ===================================
-- This SQL creates a programming track and associates it with a team.
-- Replace the placeholder values with your actual data.

-- Step 1: Insert the Programming Track
-- ------------------------------------
-- Available track types: 'self_programmed', 'team_owned', 'official_3rd_party'
INSERT INTO programming_track (
    id,
    name,
    description,
    type,
    ownerTeamId,
    isPublic,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'ptrk_' || lower(hex(randomblob(16))),  -- Auto-generated ID (or use your own with 'ptrk_' prefix)
    'YOUR_TRACK_NAME_HERE',                 -- REPLACE: Name of your programming track
    'YOUR_TRACK_DESCRIPTION_HERE',          -- REPLACE: Description of what this track is about
    'team_owned',                           -- REPLACE: Track type ('self_programmed', 'team_owned', or 'official_3rd_party')
    'TEAM_ID_HERE',                         -- REPLACE: ID of the team that owns this track (e.g., 'team_abc123xyz')
    0,                                      -- REPLACE: 0 for private, 1 for public track
    datetime('now'),                        -- Current timestamp
    datetime('now'),                        -- Current timestamp
    0                                       -- Initial update counter
);

-- Step 2: Associate the Track with a Team (if needed)
-- ---------------------------------------------------
-- This creates a relationship between the team and the programming track
-- allowing the team to use this track for scheduling workouts.

-- First, get the track ID we just created (replace with actual ID if known)
-- You can find the track ID by running: SELECT id FROM programming_track WHERE name = 'YOUR_TRACK_NAME_HERE';

INSERT INTO team_programming_track (
    teamId,
    trackId,
    isActive,
    addedAt,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'TEAM_ID_HERE',                         -- REPLACE: Same team ID as above
    'TRACK_ID_FROM_STEP_1',                 -- REPLACE: The ID of the track created in step 1
    1,                                      -- 1 = active, 0 = inactive
    datetime('now'),                        -- When the track was added to the team
    datetime('now'),                        -- Current timestamp
    datetime('now'),                        -- Current timestamp
    0                                       -- Initial update counter
);

-- Step 3: Optional - Set as Team's Default Track
-- ----------------------------------------------
-- If you want this to be the team's default programming track,
-- update the team's defaultTrackId field:

UPDATE team 
SET 
    defaultTrackId = 'TRACK_ID_FROM_STEP_1',  -- REPLACE: The ID of the track created in step 1
    updatedAt = datetime('now'),
    updateCounter = updateCounter + 1
WHERE 
    id = 'TEAM_ID_HERE';                      -- REPLACE: Same team ID as above

-- Helpful Queries to Find IDs
-- ===========================

-- Find team IDs and names:
-- SELECT id, name, slug FROM team ORDER BY name;

-- Find user IDs and names:
-- SELECT id, firstName, lastName, email FROM user ORDER BY firstName;

-- Find existing programming tracks:
-- SELECT id, name, type, ownerTeamId, isPublic FROM programming_track ORDER BY name;

-- Verify your insertion:
-- SELECT 
--     pt.id,
--     pt.name,
--     pt.description,
--     pt.type,
--     pt.isPublic,
--     t.name as owner_team_name
-- FROM programming_track pt
-- LEFT JOIN team t ON pt.ownerTeamId = t.id
-- WHERE pt.name = 'YOUR_TRACK_NAME_HERE';

-- Example Data for Testing
-- ========================
-- Here's an example of what the actual values might look like:

/*
-- Example: Creating a "Beginner CrossFit" track for "CrossFit Gym Alpha"

INSERT INTO programming_track (
    id,
    name,
    description,
    type,
    ownerTeamId,
    isPublic,
    createdAt,
    updatedAt,
    updateCounter
) VALUES (
    'ptrk_beginner_crossfit_2025',
    'Beginner CrossFit Program',
    'A 12-week progressive program designed for CrossFit beginners focusing on fundamental movements and building strength.',
    'team_owned',
    'team_abc123xyz',  -- Replace with actual team ID
    1,                 -- Public track
    datetime('now'),
    datetime('now'),
    0
);
*/
