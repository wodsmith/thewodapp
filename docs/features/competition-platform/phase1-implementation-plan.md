# Phase 1: Competition Platform Foundation - Implementation Plan

## Overview

This document outlines the implementation plan for Phase 1 of the WODsmith Competition Platform. Phase 1 focuses exclusively on database schema updates and backend infrastructure without UI components.

## Decisions Made

- **Feature Flag Approach**: Use existing entitlements system for `HOST_COMPETITIONS` feature
- **Team Type Migration**: Backfill all existing teams as type='gym', personal teams as type='personal'
- **Scope**: Schema and backend only - no UI scaffolding in Phase 1
- **Progress Tracking**: Separate tracking document (this file)

## Implementation Steps

### Step 1: Create Progress Tracking Document ✓
**File**: `docs/features/competition-platform/phase1-progress.md`
- Create new document to track implementation steps
- Include checklist and commit summaries
- **Commit**: "docs: add Phase 1 progress tracking document"

---

### Step 2: Add ID Generators for New Tables
**File**: `apps/wodsmith/src/db/schemas/common.ts`

Add three new ID generator functions:
```typescript
export const createCompetitionGroupId = () => `cgrp_${createId()}`
export const createCompetitionId = () => `comp_${createId()}`
export const createCompetitionRegistrationId = () => `creg_${createId()}`
```

**Commit**: "feat: add ID generators for competition tables"

---

### Step 3: Create Competition Schema File
**File**: `apps/wodsmith/src/db/schemas/competitions.ts`

Create new schema file with three tables:

#### 3.1 Competition Groups Table
```typescript
export const competitionGroupsTable = sqliteTable("competition_groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCompetitionGroupId()),
  organizingTeamId: text("organizingTeamId")
    .notNull()
    .references(() => teamTable.id, { onDelete: "cascade" }),
  slug: text("slug", { length: 255 }).notNull(),
  name: text("name", { length: 255 }).notNull(),
  description: text("description", { length: 1000 }),
  ...commonColumns,
}, (table) => ({
  orgTeamSlugIdx: uniqueIndex("competition_groups_org_slug_idx")
    .on(table.organizingTeamId, table.slug),
}))
```

#### 3.2 Competitions Table
```typescript
export const competitionsTable = sqliteTable("competitions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCompetitionId()),
  organizingTeamId: text("organizingTeamId")
    .notNull()
    .references(() => teamTable.id, { onDelete: "cascade" }),
  competitionTeamId: text("competitionTeamId")
    .notNull()
    .references(() => teamTable.id, { onDelete: "cascade" }),
  groupId: text("groupId") // OPTIONAL - competitions can exist without a group/series
    .references(() => competitionGroupsTable.id, { onDelete: "set null" }),
  slug: text("slug", { length: 255 }).notNull().unique(),
  name: text("name", { length: 255 }).notNull(),
  description: text("description", { length: 2000 }),
  startDate: integer("startDate", { mode: "timestamp" }).notNull(),
  endDate: integer("endDate", { mode: "timestamp" }).notNull(),
  registrationOpensAt: integer("registrationOpensAt", { mode: "timestamp" }),
  registrationClosesAt: integer("registrationClosesAt", { mode: "timestamp" }),
  settings: text("settings", { length: 10000 }), // JSON
  ...commonColumns,
}, (table) => ({
  slugIdx: uniqueIndex("competitions_slug_idx").on(table.slug),
  organizingTeamIdx: index("competitions_organizing_team_idx")
    .on(table.organizingTeamId),
  competitionTeamIdx: index("competitions_competition_team_idx")
    .on(table.competitionTeamId),
  groupIdx: index("competitions_group_idx")
    .on(table.groupId),
}))
```

#### 3.3 Competition Registrations Table
```typescript
export const competitionRegistrationsTable = sqliteTable("competition_registrations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createCompetitionRegistrationId()),
  eventId: text("eventId")
    .notNull()
    .references(() => competitionsTable.id, { onDelete: "cascade" }),
  userId: text("userId")
    .notNull()
    .references(() => userTable.id, { onDelete: "cascade" }),
  teamMemberId: text("teamMemberId")
    .notNull()
    .references(() => teamMembershipTable.id, { onDelete: "cascade" }),
  divisionId: text("divisionId")
    .references(() => scalingLevelsTable.id),
  registeredAt: integer("registeredAt", { mode: "timestamp" }).notNull(),
  ...commonColumns,
}, (table) => ({
  eventUserIdx: uniqueIndex("competition_registrations_event_user_idx")
    .on(table.eventId, table.userId),
  userIdx: index("competition_registrations_user_idx").on(table.userId),
  eventIdx: index("competition_registrations_event_idx").on(table.eventId),
}))
```

#### 3.4 Relations
```typescript
export const competitionGroupsRelations = relations(
  competitionGroupsTable,
  ({ one, many }) => ({
    organizingTeam: one(teamTable, {
      fields: [competitionGroupsTable.organizingTeamId],
      references: [teamTable.id],
    }),
    competitions: many(competitionsTable),
  })
)

export const competitionsRelations = relations(
  competitionsTable,
  ({ one, many }) => ({
    organizingTeam: one(teamTable, {
      fields: [competitionsTable.organizingTeamId],
      references: [teamTable.id],
      relationName: "organizingTeam",
    }),
    competitionTeam: one(teamTable, {
      fields: [competitionsTable.competitionTeamId],
      references: [teamTable.id],
      relationName: "competitionTeam",
    }),
    group: one(competitionGroupsTable, {
      fields: [competitionsTable.groupId],
      references: [competitionGroupsTable.id],
    }),
    registrations: many(competitionRegistrationsTable),
  })
)

export const competitionRegistrationsRelations = relations(
  competitionRegistrationsTable,
  ({ one }) => ({
    competition: one(competitionsTable, {
      fields: [competitionRegistrationsTable.eventId],
      references: [competitionsTable.id],
    }),
    user: one(userTable, {
      fields: [competitionRegistrationsTable.userId],
      references: [userTable.id],
    }),
    teamMember: one(teamMembershipTable, {
      fields: [competitionRegistrationsTable.teamMemberId],
      references: [teamMembershipTable.id],
    }),
    division: one(scalingLevelsTable, {
      fields: [competitionRegistrationsTable.divisionId],
      references: [scalingLevelsTable.id],
    }),
  })
)
```

**Commit**: "feat: add competition schema tables"

---

### Step 4: Update Teams Schema
**File**: `apps/wodsmith/src/db/schemas/teams.ts`

#### 4.1 Add Team Type Enum
```typescript
export const TEAM_TYPE_ENUM = {
  GYM: "gym",
  COMPETITION_EVENT: "competition_event",
  PERSONAL: "personal",
} as const

export type TeamType = typeof TEAM_TYPE_ENUM[keyof typeof TEAM_TYPE_ENUM]
```

#### 4.2 Update Team Table
Add new fields to `teamTable`:
```typescript
type: text("type", { enum: ["gym", "competition_event", "personal"] })
  .default("gym")
  .notNull(),
parentOrganizationId: text("parentOrganizationId")
  .references(() => teamTable.id, { onDelete: "cascade" }),
competitionMetadata: text("competitionMetadata", { length: 10000 }), // JSON
```

#### 4.3 Add Indexes
```typescript
typeIdx: index("team_type_idx").on(table.type),
parentOrgIdx: index("team_parent_org_idx").on(table.parentOrganizationId),
```

#### 4.4 Update Relations
Add to `teamRelations`:
```typescript
parentOrganization: one(teamTable, {
  fields: [teamTable.parentOrganizationId],
  references: [teamTable.id],
  relationName: "teamHierarchy",
}),
childTeams: many(teamTable, {
  relationName: "teamHierarchy",
}),
competitionGroups: many(competitionGroupsTable),
organizedCompetitions: many(competitionsTable, {
  relationName: "organizingTeam",
}),
managedCompetitions: many(competitionsTable, {
  relationName: "competitionTeam",
}),
```

**Commit**: "feat: add competition fields to teams schema"

---

### Step 5: Update Users Schema
**File**: `apps/wodsmith/src/db/schemas/users.ts`

#### 5.1 Add Gender Enum
```typescript
export const GENDER_ENUM = {
  MALE: "male",
  FEMALE: "female",
} as const

export type Gender = typeof GENDER_ENUM[keyof typeof GENDER_ENUM]
```

#### 5.2 Update User Table
Add new fields to `userTable`:
```typescript
gender: text("gender", { enum: ["male", "female"] }),
dateOfBirth: integer("dateOfBirth", { mode: "timestamp" }),
athleteProfile: text("athleteProfile", { length: 10000 }), // JSON
```

#### 5.3 Add Indexes
```typescript
genderIdx: index("user_gender_idx").on(table.gender),
dobIdx: index("user_dob_idx").on(table.dateOfBirth),
```

#### 5.4 Update Relations
Add to `userRelations`:
```typescript
competitionRegistrations: many(competitionRegistrationsTable),
```

**Commit**: "feat: add athlete profile fields to users schema"

---

### Step 6: Update Main Schema Export
**File**: `apps/wodsmith/src/db/schema.ts`

Add exports for new competition tables:
```typescript
export {
  competitionGroupsTable,
  competitionsTable,
  competitionRegistrationsTable,
  competitionGroupsRelations,
  competitionsRelations,
  competitionRegistrationsRelations,
} from "./schemas/competitions"
```

Update team and user exports to include new types:
```typescript
export { TEAM_TYPE_ENUM, type TeamType } from "./schemas/teams"
export { GENDER_ENUM, type Gender } from "./schemas/users"
```

**Commit**: "feat: export competition schema"

---

### Step 7: Add Competition Features to Config
**File**: `apps/wodsmith/src/config/features.ts`

Add new feature constant:
```typescript
export const FEATURES = {
  // ... existing features
  HOST_COMPETITIONS: "host_competitions",
} as const
```

**File**: Insert into features table (manual SQL or seed):
```sql
INSERT INTO feature (id, key, name, description, category, isActive)
VALUES (
  'feat_host_competitions',
  'host_competitions',
  'Host Competitions',
  'Allows a gym team to create and host CrossFit competitions with athlete registration and leaderboards',
  'team',
  1
);
```

**Commit**: "feat: add competition hosting feature flag"

---

### Step 8: Generate and Review Migration
**Commands**:
```bash
pnpm db:generate add_competition_schema_phase1
```

**Review Checklist**:
- [ ] All new tables created
- [ ] All foreign keys have correct ON DELETE actions
- [ ] All indexes created
- [ ] Team type enum added with default 'gym'
- [ ] User profile fields added as nullable

**Manual SQL to Add** (if not auto-generated):
```sql
-- Backfill existing teams with type
UPDATE team SET type = 'personal' WHERE isPersonalTeam = 1;
UPDATE team SET type = 'gym' WHERE isPersonalTeam = 0 OR isPersonalTeam IS NULL;
```

**Commit**: "feat: generate Phase 1 competition schema migration"

---

### Step 9: Apply Migration to Local DB
**Commands**:
```bash
pnpm db:migrate:dev
pnpm db:studio  # Verify tables and data
```

**Verification**:
- [ ] All new tables exist
- [ ] Existing teams have proper type values
- [ ] Foreign keys working correctly
- [ ] No data loss from existing tables

**Document Results**: Update this file with any issues or observations

---

### Step 10: Create Server Functions Stubs
**File**: `apps/wodsmith/src/server/competitions.ts`

Create new file with stub functions for Phase 2:
```typescript
import "server-only"
import { getDb } from "@/db"
import type { Competition, CompetitionGroup } from "@/db/schema"

/**
 * Create a new competition
 * @param organizingTeamId - The gym team creating the competition
 * @param competitionData - Competition details
 * Phase 2: Implementation pending
 */
export async function createCompetition(params: {
  organizingTeamId: string
  name: string
  slug: string
  startDate: Date
  endDate: Date
  // ... other fields
}): Promise<{ competitionId: string; competitionTeamId: string }> {
  throw new Error("Not implemented - Phase 2")
}

/**
 * Get all competitions for an organizing team
 * Phase 2: Implementation pending
 */
export async function getCompetitions(
  organizingTeamId: string
): Promise<Competition[]> {
  throw new Error("Not implemented - Phase 2")
}

/**
 * Create a competition group (series)
 * Phase 2: Implementation pending
 */
export async function createCompetitionGroup(params: {
  organizingTeamId: string
  name: string
  slug: string
  description?: string
}): Promise<{ groupId: string }> {
  throw new Error("Not implemented - Phase 2")
}

/**
 * Register an athlete for a competition
 * Phase 2: Implementation pending
 */
export async function registerForCompetition(params: {
  eventId: string
  userId: string
  divisionId: string
}): Promise<{ registrationId: string; teamMemberId: string }> {
  throw new Error("Not implemented - Phase 2")
}
```

**Commit**: "feat: add competition server function stubs"

---

### Step 11: Update Team Auth Utils
**File**: `apps/wodsmith/src/utils/team-auth.ts`

Add new helper functions:

```typescript
/**
 * Check if a team can host competitions
 * Uses the entitlements system to check for HOST_COMPETITIONS feature
 */
export async function canHostCompetitions(teamId: string): Promise<boolean> {
  const { hasFeature } = await import("@/server/entitlements")
  const { FEATURES } = await import("@/config/features")

  try {
    return await hasFeature(teamId, FEATURES.HOST_COMPETITIONS)
  } catch {
    return false
  }
}

/**
 * Require that a team has competition hosting access
 * Throws ZSAError if team cannot host competitions
 */
export async function requireCompetitionHostingAccess(
  teamId: string
): Promise<Session> {
  const session = await requireTeamMembership(teamId)
  const canHost = await canHostCompetitions(teamId)

  if (!canHost) {
    throw new ZSAError(
      "FORBIDDEN",
      "This team does not have access to host competitions. Please upgrade your plan."
    )
  }

  return session
}

/**
 * Check if a team is a competition event team
 */
export async function isCompetitionEventTeam(teamId: string): Promise<boolean> {
  const db = getDb()
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, teamId),
    columns: { type: true },
  })

  return team?.type === "competition_event"
}
```

**Commit**: "feat: add competition hosting authorization helpers"

---

### Step 12: Final Progress Update
**Tasks**:
- [ ] Review all commits
- [ ] Update this document with completion summary
- [ ] Document any deviations from plan
- [ ] Note items deferred to Phase 2
- [ ] Test all database operations in Drizzle Studio

**Commit**: "docs: complete Phase 1 implementation summary"

---

## Progress Summary

| Step | Status | Commit | Notes |
|------|--------|--------|-------|
| 1. Progress tracking doc | ⬜ Pending | - | - |
| 2. ID generators | ⬜ Pending | - | - |
| 3. Competition schema | ⬜ Pending | - | - |
| 4. Teams schema update | ⬜ Pending | - | - |
| 5. Users schema update | ⬜ Pending | - | - |
| 6. Schema exports | ⬜ Pending | - | - |
| 7. Feature flag config | ⬜ Pending | - | - |
| 8. Generate migration | ⬜ Pending | - | - |
| 9. Apply migration | ⬜ Pending | - | - |
| 10. Server function stubs | ⬜ Pending | - | - |
| 11. Auth utils | ⬜ Pending | - | - |
| 12. Final summary | ⬜ Pending | - | - |

---

## Deviations from Original Plan

_To be filled in during implementation_

---

## Items Deferred to Phase 2

1. All UI components and routes
2. Competition event creation logic
3. Athlete registration flow
4. Leaderboard functionality
5. Score submission system
6. Admin dashboard pages
7. Public competition pages

---

## Next Steps After Phase 1

Once Phase 1 is complete, Phase 2 will focus on:
1. Core routing structure (`/compete/*` routes)
2. Admin interfaces for competition management
3. Public competition pages
4. Registration system implementation
5. Basic leaderboard functionality

Refer to `overview.md` for full Phase 2 requirements.
