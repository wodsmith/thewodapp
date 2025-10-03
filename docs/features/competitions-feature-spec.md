# Competition Management Feature Specification

**Version:** 1.1 (Team-Based Optimization)
**Date:** 2025-10-01
**Status:** Design Phase - Optimized

---

## 🚀 Key Optimizations Summary

This specification has been **optimized** to maximize reuse of existing infrastructure:

### ✅ Team Membership System (NEW)
- **Eliminated** `competition_registration_members` table
- Competition auto-creates a dedicated team for athlete management
- Athletes join as team members with "Competitor" role
- Owners/managers handle all admin tasks with single `manage_competition` permission
- Reuses all existing team membership features (invites, roles, permissions)

### ✅ Tables Reduced: 5 → 4
**Original Plan:** 5 new tables
**Optimized Plan:** 4 new tables
- ✅ `competitions` (with `competitionTeamId` link)
- ✅ `competition_registrations` (with `membershipId` link)
- ✅ `competition_sponsors`
- ✅ `competition_leaderboard_cache`
- ❌ ~~`competition_registration_members`~~ → **Replaced by** `team_membership`

### ✅ New Roles & Permissions
- `competition_manager` - Full competition admin
- `competitor` - Registered athlete (for tracking/waivers)
- **1 streamlined permission** (owner/manager only)

### ✅ Public Access by Default
- All competition pages are **publicly accessible**:
  - Competition details, schedule, divisions, workouts
  - Athlete list and leaderboards
  - No authentication required for viewing
- Roles/permissions only control **management actions** (editing, approving, logging results)
- Competitor role is for tracking registration/waivers, not access control

---

## Table of Contents

1. [Overview](#overview)
2. [Team Membership System](#team-membership-system-for-athlete-management)
3. [Existing Schema Leverage](#existing-schema-leverage)
4. [New Schema Requirements](#new-schema-requirements)
5. [Database Schema Design](#database-schema-design)
6. [Data Flow & Relationships](#data-flow--relationships)
7. [Implementation Plan](#implementation-plan)
8. [API Design](#api-design)
9. [UI/UX Considerations](#uiux-considerations)
10. [Migration Strategy](#migration-strategy)

---

## Overview

This specification defines how to integrate competition management capabilities into our existing workout management system. Rather than building a parallel system, we'll **leverage existing infrastructure** for scaling, scheduling, workouts, AND team management while adding competition-specific features.

### Goals
- Enable teams to create and manage CrossFit-style competitions
- Support 15+ divisions using existing scaling system
- Reuse scheduling infrastructure for multi-day events
- **Leverage existing team membership system for athlete management**
- Track registrations, results, and leaderboards
- Maintain multi-tenant isolation
- Minimize new tables while maximizing existing table reuse

### Key Innovation: Team-Based Competition Management

When a competition is created, a **dedicated team** is automatically generated:
- Competition creator becomes the team **owner**
- Athletes register and join as **team members** with "Competitor" role
- Additional admins can be added with "Competition Manager" role
- Eliminates need for separate `competition_registration_members` table

---

## Team Membership System for Athlete Management ✅

### Automatic Team Creation

When a competition is created:

```typescript
// 1. Create competition
const competition = await createCompetition({
  name: "MWFC 2025",
  // ... other fields
})

// 2. Auto-create dedicated team
const competitionTeam = await createTeam({
  name: "MWFC 2025 - Athletes",
  slug: "mwfc-2025-athletes",
  description: "Competition team for athlete management",
  isPersonalTeam: 0,
  settings: JSON.stringify({
    competitionId: competition.id,
    isCompetitionTeam: true,
  })
})

// 3. Link competition to team
await updateCompetition(competition.id, {
  competitionTeamId: competitionTeam.id  // New field
})

// 4. Add creator as owner
await addTeamMembership({
  teamId: competitionTeam.id,
  userId: creatorUserId,
  roleId: SYSTEM_ROLES_ENUM.OWNER,
  isSystemRole: 1,
})
```

### Competition-Specific Roles & Permissions

**New System Roles** (added to `SYSTEM_ROLES_ENUM`):
```typescript
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner",
  ADMIN: "admin",
  MEMBER: "member",
  GUEST: "guest",

  // Competition-specific roles
  COMPETITION_MANAGER: "competition_manager",  // Full competition admin
  COMPETITOR: "competitor",                   // Registered athlete
}
```

**Note:** No separate "Judge" role needed - owners/managers handle all admin tasks including result logging.

**New Permissions** (added to `TEAM_PERMISSIONS`):

*Simplified from 10+ granular permissions to just 1!*

```typescript
export const TEAM_PERMISSIONS = {
  // ... existing permissions ...

  // Competition Permission (only 1 needed!)
  MANAGE_COMPETITION: "manage_competition",      // Full competition control
                                                 // Includes: settings, schedule, divisions,
                                                 // workouts, sponsors, venue details,
                                                 // registrations, results, leaderboard

  // Note: No separate permissions needed - owners/managers do everything
  // No view permissions needed - competitions are PUBLIC
}
```

**Why only 1 permission?**
- `manage_competition` covers EVERYTHING: setup, registrations, results, leaderboard
- Owners and managers handle all admin tasks (no separate judge role needed)
- Competitors have no special permissions (just team membership for tracking)

**Default Role Permissions:**

| Permission | Owner | Competition Manager | Competitor | Public |
|------------|-------|-------------------|------------|--------|
| **Full Competition Management** |
| `manage_competition` | ✅ | ✅ | ❌ | ❌ |
| ↳ *Includes: ALL admin tasks - setup, schedule, divisions, workouts, sponsors, registrations, results, leaderboard* |
| **Public Access (No Permission Required)** |
| View everything (details, schedule, divisions, workouts, leaderboard, athletes) | ✅ | ✅ | ✅ | ✅ |

**Role Summary:**
- **Owner/Competition Manager:** Full control (single `manage_competition` permission for everything)
- **Competitor:** Team member for registration tracking and waivers (no special permissions)
- **Public:** Can view all competition data

**Note:** No separate judge role needed - owners/managers handle all admin tasks including logging results, approving registrations, and checking in athletes.

### Athlete Registration Flow

```typescript
// 1. Athlete registers for competition (user must be logged in)
const registration = await registerForCompetition({
  competitionId: "comp_abc",
  divisionId: "slvl_001",  // Co-Ed RX
  teamName: "The Crushers",
  athleteUserId: currentUserId,
})

// 2. Add athlete to competition team with Competitor role
await addTeamMembership({
  teamId: competition.competitionTeamId,
  userId: currentUserId,
  roleId: SYSTEM_ROLES_ENUM.COMPETITOR,
  isSystemRole: 1,
})

// 3. Link membership to registration
await updateRegistration(registration.id, {
  membershipId: membership.id  // New field
})

// Note: Athlete can now submit results and waiver, but competition is PUBLIC
```

### Benefits

✅ **No new members table** - Leverage existing `team_membership`
✅ **Unified permission system** - Same role/permission system as rest of app
✅ **Built-in features** - Invitations, role changes, member management all work
✅ **Consistent UX** - Team management UI works for competitions
✅ **Audit trail** - Existing createdAt/updatedAt tracking on memberships
✅ **Public by default** - Anyone can view competitions without authentication

---

## Existing Schema Leverage

### 1. Scaling System for Divisions ✅

**Current Tables:**
- `scaling_groups` - Competition-specific scaling groups
- `scaling_levels` - Individual divisions (e.g., "Co-Ed RX", "Men's Intermediate")
- `workout_scaling_descriptions` - Division-specific workout variations

**How We'll Use It:**

```typescript
// Create a competition scaling group
const competitionScalingGroup = {
  id: "sgrp_mwfc_2025",
  title: "MWFC 2025 Divisions",
  description: "Mountain West Fitness Championship divisions",
  teamId: "team_xyz",
  isDefault: 0,
  isSystem: 0,
}

// Create scaling levels as divisions
const divisions = [
  { id: "slvl_001", scalingGroupId: "sgrp_mwfc_2025", label: "Co-Ed - RX", position: 0 },
  { id: "slvl_002", scalingGroupId: "sgrp_mwfc_2025", label: "Co-Ed - Intermediate", position: 1 },
  { id: "slvl_003", scalingGroupId: "sgrp_mwfc_2025", label: "Co-Ed - Rookie", position: 2 },
  { id: "slvl_004", scalingGroupId: "sgrp_mwfc_2025", label: "Men's - RX", position: 3 },
  // ... 15 total divisions
]
```

**Benefits:**
- No new division tables needed
- Reuse existing UI components for managing levels
- Workout scaling descriptions work out of the box
- Consistent with existing data model

**New Metadata Needed:**
We'll add a JSON `metadata` field to `scaling_groups` to store competition-specific info:

```typescript
{
  competitionId: "comp_abc123",          // Link to competition
  divisionType: "team" | "individual" | "pairs",
  teamSize: 2,
  gender: "mixed" | "male" | "female",
  ageGroup: "open" | "masters" | "teen",
  skillLevel: "rx" | "intermediate" | "rookie",
  movementExpectations: [...],          // Movement requirements
  workingLoads: {...}                   // Weight standards
}
```

---

### 2. Scheduling System for Events ✅

**Current Tables:**
- `locations` - Venues and stages
- `scheduled_classes` - Time-based scheduling with start/end times
- `class_catalog` - Class types (can represent heats/events)

**How We'll Use It:**

Competition events are essentially scheduled activities with:
- **Location** → Competition stage/field (e.g., "Main Stage")
- **Class Catalog** → Heat type or workout session
- **Start/End Time** → Event windows
- **Coach** → Judge/event staff (optional)

```typescript
// Create location for competition venue
const venue = {
  id: "loc_canyon_county",
  teamId: "team_xyz",
  name: "Main Stage",
  capacity: 400,
}

// Schedule a workout heat using scheduled_classes
const workoutHeat = {
  id: "schd_001",
  scheduleId: "sched_mwfc_day1",     // Daily schedule
  classCatalogId: "cat_workout_heat", // Heat type
  locationId: "loc_canyon_county",    // Stage
  coachId: null,                      // Optional judge assignment
  startTime: new Date("2025-10-10T09:00:00"),
  endTime: new Date("2025-10-10T12:33:00"),
}
```

**Benefits:**
- Reuse existing scheduling UI
- Time conflict detection built-in
- Location management already exists
- Can assign judges like coaches

**Extension Needed:**
Add a `metadata` JSON field to `scheduled_classes` for competition context:

```typescript
{
  competitionId: "comp_abc123",
  workoutId: "wkt_sawtooth",
  divisionId: "slvl_001",
  heatNumber: 1,
  sponsorId: "spn_scheels"  // Presented by sponsor
}
```

---

### 3. Workouts System ✅

**Current Tables:**
- `workouts` - Workout definitions
- `results` - Athlete results with `scalingLevelId`
- `workout_scaling_descriptions` - Per-division workout variations

**How We'll Use It:**

Competition workouts are just regular workouts with competition context:

```typescript
const competitionWorkout = {
  id: "wkt_sawtooth",
  name: "Sawtooth",
  description: "... workout description ...",
  scope: "private",               // Team-specific competition
  scheme: "time-with-cap",
  teamId: "team_xyz",
  scalingGroupId: "sgrp_mwfc_2025",  // Links to competition divisions
}

// Division-specific variations
const rxVersion = {
  workoutId: "wkt_sawtooth",
  scalingLevelId: "slvl_001",  // Co-Ed RX
  description: "Thrusters 95/65, Chest-to-Bar Pull-ups"
}

const intermediateVersion = {
  workoutId: "wkt_sawtooth",
  scalingLevelId: "slvl_002",  // Co-Ed Intermediate
  description: "Thrusters 75/55, Pull-ups"
}
```

**Benefits:**
- Workout builder already exists
- Scaling variations already supported
- Results tracking already built
- Movement library available

---

## New Schema Requirements

While we leverage existing tables, we need **4 new tables** for competition-specific features:

1. **`competitions`** - Core competition metadata (with `competitionTeamId` link)
2. **`competition_registrations`** - Team/athlete registration (with `membershipId` link)
3. **`competition_sponsors`** - Sponsor management
4. **`competition_leaderboard_cache`** - Performance optimization

**Eliminated:** `competition_registration_members` - replaced by existing `team_membership` table

---

## Database Schema Design

### 1. Competitions Table

**Purpose:** Core competition information

```typescript
export const competitionsTable = sqliteTable(
  "competitions",
  {
    ...commonColumns,
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createCompetitionId())
      .notNull(),
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),

    // Basic Info
    name: text("name", { length: 255 }).notNull(),
    slug: text("slug", { length: 255 }).notNull(),
    description: text("description", { length: 5000 }),
    shortDescription: text("short_description", { length: 500 }),

    // Dates
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    registrationOpenDate: integer("registration_open_date", { mode: "timestamp" }),
    registrationCloseDate: integer("registration_close_date", { mode: "timestamp" }),
    earlyCheckinStart: integer("early_checkin_start", { mode: "timestamp" }),
    earlyCheckinEnd: integer("early_checkin_end", { mode: "timestamp" }),

    // Location (uses locations table for stages, this is overall venue)
    venueName: text("venue_name", { length: 255 }),
    venueAddress: text("venue_address", { length: 500 }),
    venueCity: text("venue_city", { length: 100 }),
    venueState: text("venue_state", { length: 100 }),
    venueZip: text("venue_zip", { length: 20 }),
    venueCountry: text("venue_country", { length: 100 }),
    venueLatitude: text("venue_latitude", { length: 50 }),
    venueLongitude: text("venue_longitude", { length: 50 }),

    // Status
    status: text("status", {
      enum: [
        "draft",
        "published",
        "registration_open",
        "registration_closed",
        "live",
        "completed",
        "cancelled"
      ],
    })
      .default("draft")
      .notNull(),
    isLive: integer("is_live", { mode: "boolean" }).default(false).notNull(),

    // Organization
    organizerName: text("organizer_name", { length: 255 }),
    organizerEmail: text("organizer_email", { length: 255 }),
    organizerPhone: text("organizer_phone", { length: 50 }),
    eventWebsite: text("event_website", { length: 500 }),
    socialMediaHandles: text("social_media_handles", { mode: "json" }).$type<{
      instagram?: string
      facebook?: string
      twitter?: string
    }>(),

    // Registration
    registrationInfo: text("registration_info", { length: 5000 }),
    refundPolicy: text("refund_policy", { length: 5000 }),
    fanShieldEnabled: integer("fan_shield_enabled", { mode: "boolean" }).default(false),

    // Financial
    prizeMoneyPercentage: integer("prize_money_percentage"),
    expenseBreakdown: text("expense_breakdown", { mode: "json" }).$type<{
      prizePool?: number
      venue?: number
      media?: number
      equipment?: number
      [key: string]: number | undefined
    }>(),

    // Spectators
    spectatorTicketsEnabled: integer("spectator_tickets_enabled", { mode: "boolean" }).default(false),
    spectatorTicketPrices: text("spectator_ticket_prices", { mode: "json" }).$type<{
      oneDay?: number
      twoDay?: number
      weekend?: number
    }>(),

    // Linked Resources
    scalingGroupId: text("scaling_group_id").references(() => scalingGroupsTable.id, {
      onDelete: "set null",
    }), // Links to divisions
    generatedScheduleId: text("generated_schedule_id").references(
      () => generatedSchedulesTable.id,
      { onDelete: "set null" }
    ), // Links to event schedule
    competitionTeamId: text("competition_team_id").references(() => teamTable.id, {
      onDelete: "set null",
    }), // Auto-created team for athlete management

    // Media
    logoUrl: text("logo_url", { length: 500 }),
    coverImageUrl: text("cover_image_url", { length: 500 }),

    // Metadata
    createdById: text("created_by_id").references(() => userTable.id),
  },
  (table) => [
    index("competitions_team_idx").on(table.teamId),
    index("competitions_status_idx").on(table.status),
    index("competitions_slug_idx").on(table.slug),
    index("competitions_scaling_group_idx").on(table.scalingGroupId),
    index("competitions_dates_idx").on(table.startDate, table.endDate),
    index("competitions_competition_team_idx").on(table.competitionTeamId),
  ]
)
```

---

### 2. Competition Sponsors Table

**Purpose:** Manage event sponsors

```typescript
export const competitionSponsorsTable = sqliteTable(
  "competition_sponsors",
  {
    ...commonColumns,
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createCompetitionSponsorId())
      .notNull(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitionsTable.id, { onDelete: "cascade" }),
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),

    // Sponsor Info
    name: text("name", { length: 255 }).notNull(),
    logoUrl: text("logo_url", { length: 500 }).notNull(),
    websiteUrl: text("website_url", { length: 500 }),

    // Tier
    tier: text("tier", {
      enum: ["title", "presenting", "gold", "silver", "bronze", "partner"],
    }).default("partner"),

    // Display
    displayOrder: integer("display_order").default(0).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  },
  (table) => [
    index("competition_sponsors_comp_idx").on(table.competitionId),
    index("competition_sponsors_team_idx").on(table.teamId),
  ]
)
```

---

### 3. Competition Registrations Table

**Purpose:** Track team/athlete registrations (links to team_membership for athletes)

```typescript
export const competitionRegistrationsTable = sqliteTable(
  "competition_registrations",
  {
    ...commonColumns,
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createCompetitionRegistrationId())
      .notNull(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitionsTable.id, { onDelete: "cascade" }),
    scalingLevelId: text("scaling_level_id")
      .notNull()
      .references(() => scalingLevelsTable.id, { onDelete: "restrict" }), // Division
    teamId: text("team_id")
      .notNull()
      .references(() => teamTable.id, { onDelete: "cascade" }),

    // Team Membership Link (replaces competition_registration_members table)
    membershipId: text("membership_id")
      .notNull()
      .references(() => teamMembershipTable.id, { onDelete: "cascade" }), // Link to athlete's membership in competitionTeam

    // Team Info (for display purposes - team of competitors, e.g., "The Crushers")
    teamName: text("team_name", { length: 255 }).notNull(),
    affiliateGym: text("affiliate_gym", { length: 255 }),

    // Registration
    registrationNumber: integer("registration_number").notNull(), // Auto-increment per competition
    registrationDate: integer("registration_date", { mode: "timestamp" }).notNull(),
    status: text("status", {
      enum: [
        "pending",
        "confirmed",
        "paid",
        "checked_in",
        "withdrawn",
        "disqualified",
      ],
    })
      .default("pending")
      .notNull(),

    // Payment
    registrationFee: integer("registration_fee"), // In cents
    isPaid: integer("is_paid", { mode: "boolean" }).default(false).notNull(),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    fanShieldPurchased: integer("fan_shield_purchased", { mode: "boolean" }).default(false),

    // Contact
    primaryContactUserId: text("primary_contact_user_id").references(() => userTable.id),
    contactEmail: text("contact_email", { length: 255 }),
    contactPhone: text("contact_phone", { length: 50 }),

    // Notes
    notes: text("notes", { length: 2000 }),
    withdrawnAt: integer("withdrawn_at", { mode: "timestamp" }),
    withdrawnReason: text("withdrawn_reason", { length: 1000 }),
  },
  (table) => [
    index("competition_registrations_comp_idx").on(table.competitionId),
    index("competition_registrations_division_idx").on(table.scalingLevelId),
    index("competition_registrations_team_idx").on(table.teamId),
    index("competition_registrations_status_idx").on(table.status),
    index("competition_registrations_membership_idx").on(table.membershipId),
    index("competition_registrations_number_idx").on(
      table.competitionId,
      table.registrationNumber
    ),
  ]
)
```

**Note:** Athlete details (name, email, etc.) are stored in `userTable` and linked via `team_membership` → `userId`. No separate members table needed!

---

### 4. Competition Leaderboard Cache Table

**Purpose:** Pre-computed leaderboard for performance (optional, for large competitions)

```typescript
export const competitionLeaderboardCacheTable = sqliteTable(
  "competition_leaderboard_cache",
  {
    ...commonColumns,
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createLeaderboardCacheId())
      .notNull(),
    competitionId: text("competition_id")
      .notNull()
      .references(() => competitionsTable.id, { onDelete: "cascade" }),
    scalingLevelId: text("scaling_level_id")
      .notNull()
      .references(() => scalingLevelsTable.id, { onDelete: "cascade" }), // Division
    registrationId: text("registration_id")
      .notNull()
      .references(() => competitionRegistrationsTable.id, { onDelete: "cascade" }),

    // Aggregate Scores
    totalPoints: integer("total_points").default(0).notNull(),
    overallRank: integer("overall_rank").notNull(),

    // Per-Workout Breakdown (JSON)
    workoutScores: text("workout_scores", { mode: "json" }).$type<
      Array<{
        workoutId: string
        workoutNumber: number
        points: number
        rank: number
        result: string // Raw result: "12:34", "100 reps", etc.
      }>
    >(),

    // Last Updated
    lastCalculatedAt: integer("last_calculated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("competition_leaderboard_cache_comp_idx").on(table.competitionId),
    index("competition_leaderboard_cache_division_idx").on(table.scalingLevelId),
    index("competition_leaderboard_cache_rank_idx").on(
      table.competitionId,
      table.scalingLevelId,
      table.overallRank
    ),
    index("competition_leaderboard_cache_lookup_idx").on(
      table.competitionId,
      table.scalingLevelId,
      table.registrationId
    ),
  ]
)
```

---

## Data Flow & Relationships

### Entity Relationship Overview

```
competitions
├─> teamTable (owner/creator's team)
├─> competitionTeamId → teamTable (auto-created team for athlete management)
│   └─> teamMembershipTable (athletes with "Competitor" role)
│       └─> userTable (athlete details)
├─> scalingGroupsTable (divisions)
│   └─> scalingLevelsTable (Co-Ed RX, Men's Intermediate, etc.)
├─> generatedSchedulesTable (event schedule)
│   └─> scheduledClassesTable (workout heats with metadata)
│       └─> workouts (competition workouts)
├─> competition_sponsors (event sponsors)
└─> competition_registrations (team registrations)
    ├─> scalingLevelsTable (division entered)
    ├─> membershipId → teamMembershipTable (link to athlete)
    ├─> results (workout results - EXISTING TABLE)
    │   └─> scalingLevelId (division they competed in)
    └─> competition_leaderboard_cache (cached rankings)
```

### Key Relationships

1. **Competition → Competition Team (NEW)**
   - `competitions.competitionTeamId` → `teamTable.id` (auto-created)
   - Competition team has many `team_membership` records with roles:
     - `owner` - Competition creator (full control)
     - `competition_manager` - Additional admins (full control)
     - `competitor` - Registered athletes (for tracking only)

2. **Competition → Divisions**
   - `competitions.scalingGroupId` → `scaling_groups.id`
   - `scaling_groups` has many `scaling_levels` (the divisions)

3. **Competition → Schedule**
   - `competitions.generatedScheduleId` → `generated_schedules.id`
   - `generated_schedules` has many `scheduled_classes`
   - `scheduled_classes.metadata` stores `{competitionId, workoutId, divisionId, heatNumber}`

4. **Competition → Workouts**
   - Workouts link to `competitions.scalingGroupId` via `workouts.scalingGroupId`
   - Division-specific variations in `workout_scaling_descriptions`

5. **Registration → Team Membership (NEW)**
   - `competition_registrations.membershipId` → `team_membership.id`
   - `team_membership.userId` → `userTable.id` (athlete details)
   - Athlete has "Competitor" role in competition team
   - No separate members table needed!

6. **Registration → Results**
   - Athletes log results to existing `results` table
   - `results.userId` matches athlete from registration
   - `results.scalingLevelId` matches `competition_registrations.scalingLevelId`
   - Results have `results.scheduledWorkoutInstanceId` or custom metadata

7. **Leaderboard Calculation**
   - Query `results` grouped by `scalingLevelId` and `userId`
   - Join with `competition_registrations` via `membershipId → userId`
   - Aggregate points across all workouts
   - Cache in `competition_leaderboard_cache` for fast queries

---

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1-2)

**Goal:** Enable basic competition creation and division management

1. **Database Migration**
   - Create 4 new tables (competitions, sponsors, registrations, leaderboard cache)
   - Add `metadata` JSON field to `scaling_groups` for competition context
   - Add `metadata` JSON field to `scheduled_classes` for heat info
   - Add new system roles to `SYSTEM_ROLES_ENUM`: `competition_manager`, `judge`, `competitor`
   - Add new permissions to `TEAM_PERMISSIONS` for competition management

2. **Seed Competition Scaling Group**
   - Create default system scaling group for competitions
   - Pre-seed common divisions (RX, Intermediate, Rookie for Co-Ed/Men's/Women's)

3. **Automatic Team Creation Workflow**
   - When competition is created, auto-generate dedicated team:
     - Team name: "{Competition Name} - Athletes"
     - Slug: "{competition-slug}-athletes"
     - Settings: `{competitionId, isCompetitionTeam: true}`
   - Add creator as team `owner`
   - Link competition to team via `competitionTeamId`

4. **Basic CRUD APIs**
   - `POST /api/competitions` - Create competition (triggers team creation)
   - `GET /api/competitions/:id` - Get competition details
   - `PATCH /api/competitions/:id` - Update competition
   - `DELETE /api/competitions/:id` - Delete competition (cascade deletes team)

5. **UI: Competition Creation**
   - Form to create competition with basic info
   - Link to existing scaling group or create new one
   - Date/location inputs
   - Status management (draft/published/live/completed)
   - Show confirmation that competition team was created

---

### Phase 2: Division & Workout Management (Week 3-4)

**Goal:** Configure divisions and assign workouts

1. **Division Management UI**
   - Reuse existing scaling level UI
   - Add competition-specific metadata (team size, gender, skill level)
   - Movement expectations and working loads editor

2. **Workout Assignment**
   - Create workouts linked to competition scaling group
   - Add division-specific variations via `workout_scaling_descriptions`
   - Workout ordering (Workout #1, #2, #3, etc.)

3. **APIs**
   - `GET /api/competitions/:id/divisions` - List divisions
   - `POST /api/competitions/:id/workouts` - Add workout to competition
   - `GET /api/competitions/:id/workouts` - List competition workouts

---

### Phase 3: Scheduling (Week 5-6)

**Goal:** Create multi-day event schedules

1. **Leverage Existing Scheduling**
   - Create `locations` for competition stages
   - Create `generated_schedule` for each competition day
   - Use `scheduled_classes` for workout heats

2. **Schedule Builder UI**
   - Visual timeline for each day
   - Drag-and-drop workout assignments
   - Filter by division/stage
   - Time conflict detection (existing feature)

3. **Metadata Extension**
   - Store `{competitionId, workoutId, divisionId, heatNumber, sponsorId}` in `scheduled_classes.metadata`

4. **APIs**
   - `GET /api/competitions/:id/schedule` - Get event schedule
   - `POST /api/competitions/:id/schedule` - Create schedule item
   - `PATCH /api/schedule/:id` - Update schedule item

---

### Phase 4: Registration System (Week 7-9)

**Goal:** Allow athlete registration and payment processing using team membership

1. **Registration Flow**
   - Public registration form (if competition is published)
   - User must be logged in (or create account)
   - Division selection
   - Team name + affiliate (for team competitions)
   - Payment integration (Stripe via existing billing system)
   - **On successful registration:**
     - Add user to competition team with "Competitor" role
     - Create `competition_registrations` record linking to `team_membership`
     - Send confirmation email

2. **Team Management**
   - Leverage existing team membership UI
   - View all registered athletes in competition team
   - Filter by division/status
   - Manually approve/reject registrations
   - Assign "Judge" role to staff for result logging
   - Check-in athletes on competition day (update status)

3. **Admin Dashboard**
   - View all registrations (filter by division/status)
   - Manage team memberships (add judges, admins)
   - Export registration list
   - Bulk operations (approve all, check-in all)

4. **APIs**
   - `POST /api/competitions/:id/registrations` - Register athlete (adds to team)
   - `GET /api/competitions/:id/registrations` - List registrations (admin)
   - `PATCH /api/registrations/:id` - Update status
   - `POST /api/competitions/:id/team/members` - Add judge/admin to team
   - `PATCH /api/competitions/:id/team/members/:userId/role` - Change role

5. **Email Notifications**
   - Registration confirmation (with team invite)
   - Payment receipt
   - Event reminders
   - Schedule updates

---

### Phase 5: Results & Leaderboard (Week 10-12)

**Goal:** Track results and display live leaderboards

1. **Results Entry**
   - Judge/admin interface to log results
   - Link result to `competition_registrations.id`
   - Use existing `results` table with `scalingLevelId`
   - Validation workflow (judge approval)

2. **Leaderboard Calculation**
   - Query `results` grouped by division and registration
   - Implement points system (placement-based)
   - Handle ties (time-based, reps-based)
   - Cache in `competition_leaderboard_cache`

3. **Leaderboard Display**
   - Public leaderboard page
   - Division tabs
   - Per-workout breakdown
   - Search/filter by team name or affiliate
   - Real-time updates (WebSocket or polling)

4. **APIs**
   - `POST /api/workouts/:id/results` - Log result
   - `GET /api/competitions/:id/leaderboard` - Get overall leaderboard
   - `GET /api/competitions/:id/leaderboard/:divisionId` - Get division leaderboard
   - `POST /api/leaderboard/refresh` - Recalculate cache

---

### Phase 6: Polish & Optimization (Week 13-14)

1. **Performance Optimization**
   - Add indexes for common queries
   - Implement leaderboard caching strategy
   - Optimize schedule queries
   - Image optimization for logos/sponsors

2. **Advanced Features**
   - Sponsor management UI
   - Spectator ticketing (if needed)
   - PDF export for schedules/leaderboards
   - Social media sharing
   - Competition series/tracking (multi-event)

3. **Testing**
   - Unit tests for leaderboard calculations
   - Integration tests for registration flow
   - E2E tests for complete competition lifecycle

---

## API Design

### RESTful Endpoints

**Legend:**
- 🌐 Public (no auth required)
- 🔓 Authenticated (login required)
- 🔒 Permission required (role-based)

```typescript
// Competitions
🌐 GET    /api/competitions                      // List all public competitions
🌐 GET    /api/competitions/:slug                // Get single competition (by slug)
🔒 POST   /api/competitions                      // Create competition (owner)
🔒 PATCH  /api/competitions/:id                  // Update competition (owner/manager)
🔒 DELETE /api/competitions/:id                  // Delete competition (owner)

// Divisions (uses scaling levels)
🌐 GET    /api/competitions/:id/divisions        // List divisions (public)
🔒 POST   /api/competitions/:id/divisions        // Create division (owner/manager)
🔒 PATCH  /api/divisions/:id                     // Update division (owner/manager)
🔒 DELETE /api/divisions/:id                     // Delete division (owner/manager)

// Workouts
🌐 GET    /api/competitions/:id/workouts         // List competition workouts (public)
🔒 POST   /api/competitions/:id/workouts         // Add workout (owner/manager)
🔒 PATCH  /api/workouts/:id                      // Update workout (owner/manager)
🔒 DELETE /api/workouts/:id                      // Remove workout (owner/manager)

// Schedule
🌐 GET    /api/competitions/:id/schedule         // Get event schedule (public)
🌐 GET    /api/competitions/:id/schedule/:date   // Get schedule for date (public)
🔒 POST   /api/competitions/:id/schedule         // Add schedule item (owner/manager)
🔒 PATCH  /api/schedule/:id                      // Update schedule (owner/manager)
🔒 DELETE /api/schedule/:id                      // Delete schedule (owner/manager)

// Sponsors
🌐 GET    /api/competitions/:id/sponsors         // List sponsors (public)
🔒 POST   /api/competitions/:id/sponsors         // Add sponsor (owner/manager)
🔒 PATCH  /api/sponsors/:id                      // Update sponsor (owner/manager)
🔒 DELETE /api/sponsors/:id                      // Remove sponsor (owner/manager)

// Registrations
🔒 GET    /api/competitions/:id/registrations    // List registrations (owner/manager/judge)
🔓 POST   /api/competitions/:id/registrations    // Register for competition (logged in)
🔓 GET    /api/registrations/:id                 // Get own registration
🔒 PATCH  /api/registrations/:id                 // Update status (owner/manager)
🔓 DELETE /api/registrations/:id                 // Withdraw own registration

// Team Management (via existing team APIs)
🔒 GET    /api/competitions/:id/team/members     // List team members (owner/manager)
🔒 POST   /api/competitions/:id/team/members     // Add judge/admin (owner/manager)
🔒 PATCH  /api/teams/:teamId/members/:userId/role // Change role (owner/manager)

// Results
🌐 GET    /api/competitions/:id/results          // Get all results (public)
🌐 GET    /api/workouts/:workoutId/results       // Get results for workout (public)
🔒 POST   /api/workouts/:workoutId/results       // Log result (judge/owner/manager)
🔒 PATCH  /api/results/:id                       // Update result (judge/owner/manager)
🔒 DELETE /api/results/:id                       // Delete result (owner/manager)

// Leaderboard
🌐 GET    /api/competitions/:id/leaderboard                    // Overall leaderboard (public)
🌐 GET    /api/competitions/:id/leaderboard/:divisionId        // Division leaderboard (public)
🔒 POST   /api/competitions/:id/leaderboard/refresh            // Recalculate cache (owner/manager)
🌐 GET    /api/competitions/:id/leaderboard/:divisionId/export // Export CSV/PDF (public)
```

### Access Control Summary

**Public Routes (🌐):**
- All GET routes for viewing competitions, divisions, workouts, schedules, leaderboards, results
- Export functionality

**Authenticated Routes (🔓):**
- Registration (must be logged in to register)
- View/withdraw own registration

**Permission-Required Routes (🔒):**
- All management operations (create, update, delete)
- Result logging (judges, owners, managers)
- Leaderboard cache refresh
- Team management (adding judges/admins)

---

## UI/UX Considerations

### 1. Competition Admin Dashboard

**Navigation:**
```
Competitions (Dashboard)
├─ Create Competition
├─ Competition List
│  └─ [Competition Name]
│     ├─ Overview (edit details)
│     ├─ Divisions (manage via scaling levels)
│     ├─ Workouts (assign & configure)
│     ├─ Schedule (timeline view)
│     ├─ Registrations (list, approve, check-in)
│     ├─ Results (log & validate)
│     ├─ Leaderboard (preview & publish)
│     └─ Sponsors (manage logos/tiers)
```

### 2. Public Competition Pages

**Routes:** (All publicly accessible, no login required)
```
/competitions                           // Browse all competitions
/competitions/:slug                     // Competition homepage
├─ /details       (overview, location, schedule, sponsors)
├─ /divisions     (list divisions with details)
├─ /schedule      (event schedule with filters)
├─ /workouts      (workout descriptions per division)
├─ /leaderboard   (live rankings with tabs per division)
├─ /athletes      (list of registered athletes per division)
└─ /register      (registration form - requires login)
```

**Access Control:**
- All pages are publicly viewable (except admin dashboard)
- Registration requires user account (login/signup)
- SEO-friendly URLs with slugs
- Shareable links for social media

### 3. Mobile Responsiveness

- Tabbed navigation for divisions/schedule/workouts/leaderboard
- Collapsible cards for division details
- Horizontal scrolling for leaderboard tables
- Sticky headers for leaderboard
- QR code check-in for registrations

### 4. Real-Time Features

- WebSocket connection for live leaderboard updates
- Polling fallback every 30 seconds
- Visual indicator when leaderboard is updating
- Toast notifications for major events (registration confirmed, results posted)

---

## Migration Strategy

### Step 1: Schema Migration

**Create Migration:**
```bash
pnpm db:generate create_competitions_tables
```

**Migration File:**
```typescript
// src/db/migrations/XXXX_create_competitions_tables.ts

import { sql } from 'drizzle-orm'

// Create new tables:
// - competitions
// - competition_sponsors
// - competition_registrations
// - competition_leaderboard_cache

// Add metadata column to scaling_groups (if not exists)
// Add metadata column to scheduled_classes (if not exists)
```

**Apply Migration:**
```bash
pnpm db:migrate:dev  # Local
pnpm db:migrate:prod # Production
```

---

### Step 2: Seed Data

**Create System Scaling Group for Competitions:**
```typescript
// src/db/seed-competition-divisions.ts

const systemCompetitionGroup = {
  id: 'sgrp_competition_default',
  title: 'Default Competition Divisions',
  description: 'System-wide competition division templates',
  teamId: null, // System group
  isDefault: 0,
  isSystem: 1,
}

const defaultDivisions = [
  { label: 'Co-Ed - RX', position: 0, metadata: { teamSize: 2, gender: 'mixed', skillLevel: 'rx' } },
  { label: 'Co-Ed - Intermediate', position: 1, metadata: { teamSize: 2, gender: 'mixed', skillLevel: 'intermediate' } },
  { label: 'Co-Ed - Rookie', position: 2, metadata: { teamSize: 2, gender: 'mixed', skillLevel: 'rookie' } },
  { label: "Men's - RX", position: 3, metadata: { teamSize: 2, gender: 'male', skillLevel: 'rx' } },
  { label: "Men's - Intermediate", position: 4, metadata: { teamSize: 2, gender: 'male', skillLevel: 'intermediate' } },
  { label: "Men's - Rookie", position: 5, metadata: { teamSize: 2, gender: 'male', skillLevel: 'rookie' } },
  { label: "Women's - RX", position: 6, metadata: { teamSize: 2, gender: 'female', skillLevel: 'rx' } },
  { label: "Women's - Intermediate", position: 7, metadata: { teamSize: 2, gender: 'female', skillLevel: 'intermediate' } },
  { label: "Women's - Rookie", position: 8, metadata: { teamSize: 2, gender: 'female', skillLevel: 'rookie' } },
  { label: "Masters Co-Ed - RX", position: 9, metadata: { teamSize: 2, gender: 'mixed', ageGroup: 'masters', skillLevel: 'rx' } },
  // ... 15 total
]
```

---

### Step 3: Feature Flag

Enable competition features gradually:

```typescript
// src/constants.ts

export const FEATURE_FLAGS = {
  COMPETITIONS_ENABLED: process.env.NEXT_PUBLIC_FEATURE_COMPETITIONS === 'true',
  COMPETITION_REGISTRATION_ENABLED: process.env.NEXT_PUBLIC_FEATURE_COMPETITION_REGISTRATION === 'true',
  COMPETITION_LIVE_LEADERBOARD: process.env.NEXT_PUBLIC_FEATURE_COMPETITION_LIVE_LEADERBOARD === 'true',
}
```

---

## Key Design Decisions

### 1. Reuse Over Rebuild ✅
- Leverage `scaling_groups` + `scaling_levels` for divisions
- Use `scheduled_classes` for event scheduling
- Store results in existing `results` table
- Extend with JSON `metadata` fields instead of new columns

### 2. Multi-Tenancy ✅
- All tables have `teamId` for data isolation
- Competitions are team-scoped
- Public competitions still belong to organizing team

### 3. Flexibility ✅
- JSON metadata for competition-specific context
- Reusable scaling groups across multiple competitions
- Support for individual, pairs, and team divisions

### 4. Performance ✅
- Leaderboard cache table for fast queries
- Indexes on common filters (competitionId, divisionId, status)
- Pre-computed ranks and points

### 5. Future-Proof ✅
- Competition series support (via metadata)
- Multi-venue events (via locations)
- Heat management (via scheduled_classes)
- Judge assignments (via coachId in scheduled_classes)

---

## Success Metrics

### MVP (Phase 1-3)
- [ ] Create competition with 5+ divisions
- [ ] Add 3+ workouts with division variations
- [ ] Build multi-day schedule with 10+ events
- [ ] Display public competition page

### V1 (Phase 4-5)
- [ ] 50+ team registrations
- [ ] Process payments via Stripe
- [ ] Log 100+ results
- [ ] Display live leaderboard with <2s load time

### V2 (Phase 6)
- [ ] Support 10+ concurrent competitions
- [ ] 500+ registrations across all competitions
- [ ] Real-time leaderboard updates (<5s latency)
- [ ] Mobile check-in via QR codes

---

## Next Steps

1. **Review & Approve Schema** - Validate table design with team
2. **Create Drizzle Migration** - Generate migration files
3. **Build API Foundation** - Implement core CRUD endpoints
4. **Admin UI Development** - Competition creation and management
5. **Public Pages** - Competition details and leaderboard views
6. **Registration Flow** - Team registration and payment
7. **Results & Leaderboard** - Judge interface and live updates
8. **Testing & Launch** - QA, performance testing, production deployment

---

**Document Version:** 1.0
**Last Updated:** 2025-10-01
**Author:** Competition Feature Team
**Status:** Approved for Implementation
