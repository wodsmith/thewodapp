# Database Schema - Track Subscription Feature

## Overview
This document outlines the database schema changes and relationships for the track subscription feature implemented on 2025-07-09.

## Core Tables

### `team_programming_track` (Subscription Junction Table)
**Purpose**: Manages team subscriptions to programming tracks with activation state and customization options.

```sql
CREATE TABLE team_programming_track (
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    updateCounter INTEGER DEFAULT 0,
    teamId TEXT NOT NULL REFERENCES team(id),
    trackId TEXT NOT NULL REFERENCES programming_track(id),
    isActive INTEGER DEFAULT 1 NOT NULL,
    subscribedAt INTEGER NOT NULL,
    startDayOffset INTEGER DEFAULT 0 NOT NULL,
    PRIMARY KEY (teamId, trackId)
);
```

**Key Fields:**
- `teamId` + `trackId`: Composite primary key ensuring one subscription per team-track pair
- `isActive`: Boolean flag (1/0) to enable/disable subscription without deletion
- `subscribedAt`: Timestamp when subscription was created
- `startDayOffset`: Allows teams to customize their starting point within a track

**Indexes:**
- `team_programming_track_active_idx` ON `isActive`
- `team_programming_track_team_idx` ON `teamId`

## Subscription Workflow

### 🎯 **Primary Subscription Path**
The track subscription feature follows a clear workflow that ensures proper team ownership and permission validation:

```
User Request → Team Validation → Permission Check → Subscription Creation
```

**Step-by-Step Process:**
1. **User Selection**: User selects a programming track to subscribe to
2. **Team Resolution**:
   - If `teamId` provided: Use specified team
   - If no `teamId`: Automatically resolve to user's personal team
3. **Access Validation**: Verify user has permission to subscribe this team
4. **Subscription Creation**: Create/update `team_programming_track` record
5. **UI Update**: Show subscription status with team context

### 2. Database Operations

**Subscribe Operation:**
```typescript
// Check for existing subscription
const existing = await db.query.teamProgrammingTracksTable.findFirst({
    where: and(
        eq(teamProgrammingTracksTable.teamId, teamId),
        eq(teamProgrammingTracksTable.trackId, trackId)
    )
});

if (existing) {
    // Reactivate existing subscription
    await db.update(teamProgrammingTracksTable)
        .set({ isActive: 1 })
        .where(and(
            eq(teamProgrammingTracksTable.teamId, teamId),
            eq(teamProgrammingTracksTable.trackId, trackId)
        ));
} else {
    // Create new subscription
    await db.insert(teamProgrammingTracksTable)
        .values({
            teamId,
            trackId,
            isActive: 1,
            startDayOffset: 0
        });
}
```

**Unsubscribe Operation:**
```typescript
// Soft delete by setting isActive to 0
await db.update(teamProgrammingTracksTable)
    .set({ isActive: 0 })
    .where(and(
        eq(teamProgrammingTracksTable.teamId, teamId),
        eq(teamProgrammingTracksTable.trackId, trackId)
    ));
```

## Related Tables

### `programming_track`
- Contains track metadata (name, description, type)
- One-to-many relationship with `team_programming_track`

### `team`
- Team information including personal teams
- One-to-many relationship with `team_programming_track`

### `track_workout`
- Links workouts to tracks with day numbers
- Used to determine workout schedule for subscribed teams

### `scheduled_workout_instance`
- Actual scheduled workouts for teams
- References `track_workout` and respects `startDayOffset` from subscription

## Multi-Tenancy Considerations

### Team Isolation
- All subscriptions are scoped to specific teams
- Users can subscribe different teams to different tracks
- Personal teams allow individual user subscriptions

### Permission Checks
- Users can only subscribe teams they have access to
- Team membership validation occurs in server actions
- Admin users may have broader subscription capabilities

## Data Integrity

### Constraints
- Composite primary key prevents duplicate subscriptions
- Foreign key constraints ensure referential integrity
- NOT NULL constraints on critical fields

### Soft Deletes
- Subscriptions use `isActive` flag instead of hard deletes
- Preserves subscription history and analytics
- Allows for easy reactivation

## Performance Optimizations

### Indexing Strategy
- Primary index on `(teamId, trackId)` for subscription lookups
- Secondary index on `teamId` for team-based queries
- Index on `isActive` for filtering active subscriptions

### Query Patterns
```sql
-- Get active subscriptions for a team
SELECT * FROM team_programming_track
WHERE teamId = ? AND isActive = 1;

-- Get teams subscribed to a track
SELECT t.* FROM team t
JOIN team_programming_track tpt ON t.id = tpt.teamId
WHERE tpt.trackId = ? AND tpt.isActive = 1;

-- Get subscription with track details
SELECT tpt.*, pt.name, pt.description
FROM team_programming_track tpt
JOIN programming_track pt ON tpt.trackId = pt.id
WHERE tpt.teamId = ? AND tpt.isActive = 1;
```

## Migration Notes

### Schema Changes
- Added `startDayOffset` column for track customization
- Renamed `addedAt` to `subscribedAt` for clarity
- Enhanced indexing for performance

### Data Migration
- Existing subscriptions maintain backward compatibility
- Default values ensure smooth transition
- Soft delete pattern preserves historical data