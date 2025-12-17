# Volunteer Management System Plan

## Overview
This document outlines the phased approach to building a Volunteer Management System for WODsmith competitions. The goal is to allow competition organizers to recruit, manage, and schedule volunteers, with a specific focus on assigning judges to heats.

## Design Principles

This schema follows patterns established in our entitlements system:
- **No boolean columns** - Use enums or junction tables instead for extensibility
- **Junction tables for many-to-many** - Capabilities, credentials, assignments
- **Normalized lookup tables** - Credential types, role capabilities are seeded data
- **Audit trails** - Track who changed what and when
- **Reuse existing team infrastructure** - Leverage team invites, memberships, and roles

## Team-Based Volunteer Architecture

### Core Concept

Volunteers are organized into **Volunteer Teams** - a new team type that reuses the existing team invite/membership infrastructure:

```
Competition (e.g., "Mountain West Throwdown 2025")
├── Volunteer Team: "MWFC Judges"
│   └── Members: Becky, Kevin, Matt, JT, Scott... (judge role)
├── Volunteer Team: "MWFC Equipment Crew"  
│   └── Members: Dustin, Trevor, Alex... (equipment role)
├── Volunteer Team: "MWFC Staff"
│   └── Members: Breana, Cynthia, Jamie... (staff role)
└── Volunteer Team: "MWFC Medical"
    └── Members: Austin, Cassidy, James... (medical role)
```

**For smaller competitions**, a single volunteer team works fine:
```
Competition (e.g., "Valentine's Day Throwdown")
└── Volunteer Team: "VDT Volunteers"
    └── Members: All volunteers with different roles assigned via role_assignments
```

### Why Teams?

1. **Reuse invite flow** - `teamInvitationTable` already handles email invites with tokens
2. **Reuse membership** - `teamMembershipTable` tracks who's on the team
3. **Reuse roles** - `teamRoleTable` can define volunteer-specific roles (or use system roles)
4. **Reuse permissions** - Existing permission system for who can manage volunteers
5. **Team hierarchy** - `parentOrganizationId` links volunteer teams to the organizing gym

### New Team Type

Add to `TEAM_TYPE_ENUM` in `teams.ts`:

```typescript
export const TEAM_TYPE_ENUM = {
  GYM: "gym",
  COMPETITION_EVENT: "competition_event",
  COMPETITION_TEAM: "competition_team",
  PERSONAL: "personal",
  VOLUNTEER_TEAM: "volunteer_team", // NEW: For volunteer management
} as const
```

### Competition-Volunteer Team Link

```typescript
// Link competitions to their volunteer teams
export const competitionVolunteerTeamsTable = sqliteTable("competition_volunteer_teams", {
  id: text().primaryKey().$defaultFn(() => createCompetitionVolunteerTeamId()).notNull(),
  competitionId: text().notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  teamId: text().notNull().references(() => teamTable.id, { onDelete: "cascade" }),
  // Optional: primary volunteer team for smaller comps with just one team
  isPrimary: integer().default(0).notNull(),
}, (table) => [
  index("comp_vol_team_comp_idx").on(table.competitionId),
  index("comp_vol_team_team_idx").on(table.teamId),
]);
```

### Volunteer Flow

1. **Organizer creates volunteer team(s)** for their competition
   - Can create one team for small comps, or multiple for large comps (judges, equipment, etc.)
   - Team type = `volunteer_team`, parentOrganizationId = organizing gym
   
2. **Organizer invites volunteers** using existing `inviteUserToTeam()` flow
   - Sends email with token link
   - Volunteer accepts invite, becomes team member
   
3. **Volunteer data stored on team membership**
   - `teamMembershipTable` tracks the volunteer
   - Additional volunteer-specific data (credentials, availability) stored in junction tables

## Phase 1: Foundation (Roles & Volunteer Pool)
**Goal:** Enable organizers to define volunteer roles and build a database of volunteers for their competition.

### 1.1 Database Schema
New tables in `apps/wodsmith/src/db/schemas/volunteers.ts`:

```typescript
// =============================================================================
// LOOKUP TABLES (Seeded Data)
// =============================================================================

// Credential types - seeded data like "L1", "L2", "Medical"
// OR custom credentials defined by a competition
export const competitionCredentialTypesTable = sqliteTable("competition_credential_types", {
  id: text().primaryKey().$defaultFn(() => createCredentialTypeId()).notNull(),
  // NULL = System/Global credential, Set = Custom competition credential
  competitionId: text().references(() => competitionsTable.id, { onDelete: "cascade" }),
  key: text({ length: 50 }).notNull(),    // "l1", "l2", "mygym_judge_cert"
  name: text({ length: 100 }).notNull(),           // "CrossFit Level 1"
  description: text({ length: 500 }),
  level: integer().default(0),                      // For sorting (L2=2 > L1=1)
  category: text({
    enum: ["crossfit", "medical", "specialty", "custom"],
  }).notNull(),
  sortOrder: integer().default(0),
}, (table) => [
  index("cred_types_comp_idx").on(table.competitionId),
  // System credentials must have unique keys
  uniqueIndex("cred_type_system_key_idx").on(table.key).where(sql`competitionId IS NULL`),
  // Custom credentials must have unique keys per competition
  uniqueIndex("cred_type_comp_key_idx").on(table.competitionId, table.key).where(sql`competitionId IS NOT NULL`),
]);

// Role capability types - what a role can do
// Replaces boolean flags like isJudge, isTeamLead
export const VOLUNTEER_ROLE_CAPABILITIES = {
  JUDGE: "judge",                    // Can be assigned to heats/lanes
  TEAM_LEAD: "team_lead",           // Has leadership responsibilities  
  MEDICAL_CERTIFIED: "medical",      // Has medical certification
  EQUIPMENT_TRAINED: "equipment",    // Trained on equipment
  ATHLETE_BRIEFING: "briefing",      // Can run athlete briefings
} as const;

// =============================================================================
// CORE TABLES
// =============================================================================

// competition_volunteer_roles
// Defines roles like "Judge", "Equipment", "Check-in"h
export const competitionVolunteerRolesTable = sqliteTable("competition_volunteer_roles", {
  id: text().primaryKey().$defaultFn(() => createCompetitionVolunteerRoleId()).notNull(),
  competitionId: text().notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  name: text({ length: 100 }).notNull(), // "Judge", "Equipment Crew", "Head Judge"
  description: text({ length: 500 }),
  parentRoleId: text().references(() => competitionVolunteerRolesTable.id), // For hierarchy
  sortOrder: integer().default(0),
  // NOTE: No boolean flags - use capabilities junction table instead
});

// Junction: roles → capabilities (replaces isJudge, isTeamLead booleans)
// A "Head Judge" role can have BOTH judge AND team_lead capabilities
export const competitionVolunteerRoleCapabilitiesTable = sqliteTable("competition_volunteer_role_capabilities", {
  id: text().primaryKey().$defaultFn(() => createRoleCapabilityId()).notNull(),
  roleId: text().notNull().references(() => competitionVolunteerRolesTable.id, { onDelete: "cascade" }),
  capability: text({
    enum: ["judge", "team_lead", "medical", "equipment", "briefing"],
  }).notNull(),
}, (table) => [
  index("vol_role_cap_role_idx").on(table.roleId),
  index("vol_role_cap_unique_idx").on(table.roleId, table.capability),
]);

// competition_volunteers
// The people helping out
export const competitionVolunteersTable = sqliteTable("competition_volunteers", {
  id: text().primaryKey().$defaultFn(() => createCompetitionVolunteerId()).notNull(),
  competitionId: text().notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  userId: text().references(() => userTable.id, { onDelete: "set null" }), // Optional account link
  email: text({ length: 255 }).notNull(),
  firstName: text({ length: 100 }),
  lastName: text({ length: 100 }),
  status: text({
    enum: ["pending", "approved", "rejected", "invited", "withdrawn"],
  }).default("pending").notNull(),
  shirtSize: text({ length: 10 }), // XS, S, M, L, XL, etc.
  notes: text({ length: 1000 }),   // Internal organizer notes
  availabilityNotes: text({ length: 500 }), // "8am-2pm only", "Hard out @ 4:30"
  // NOTE: No credentials JSON - use credentials junction table instead
});

// Junction: volunteers → credentials (replaces credentials JSON field)
export const competitionVolunteerCredentialsTable = sqliteTable("competition_volunteer_credentials", {
  id: text().primaryKey().$defaultFn(() => createVolunteerCredentialId()).notNull(),
  volunteerId: text().notNull().references(() => competitionVolunteersTable.id, { onDelete: "cascade" }),
  credentialTypeId: text().notNull().references(() => competitionCredentialTypesTable.id, { onDelete: "cascade" }),
  verifiedAt: integer({ mode: "timestamp" }),
  verifiedBy: text().references(() => userTable.id),
  expiresAt: integer({ mode: "timestamp" }), // Some certs expire
}, (table) => [
  index("vol_cred_vol_idx").on(table.volunteerId),
  index("vol_cred_type_idx").on(table.credentialTypeId),
]);

// competition_volunteer_role_assignments
// Which roles is this volunteer willing/approved to do?
export const competitionVolunteerRoleAssignmentsTable = sqliteTable("competition_volunteer_role_assignments", {
  id: text().primaryKey().$defaultFn(() => createRoleAssignmentId()).notNull(),
  volunteerId: text().notNull().references(() => competitionVolunteersTable.id, { onDelete: "cascade" }),
  roleId: text().notNull().references(() => competitionVolunteerRolesTable.id, { onDelete: "cascade" }),
  // NOTE: No isApproved boolean - use status enum instead
  status: text({
    enum: ["pending", "approved", "rejected", "waitlisted"],
  }).default("pending").notNull(),
  statusChangedAt: integer({ mode: "timestamp" }),
  statusChangedBy: text().references(() => userTable.id),
}, (table) => [
  index("vol_role_assign_vol_idx").on(table.volunteerId),
  index("vol_role_assign_role_idx").on(table.roleId),
]);
```

### 1.1.1 Helper Functions

```typescript
// Get volunteer's highest credential level (computed, not stored)
async function getVolunteerCredentialLevel(volunteerId: string): Promise<number> {
  const credentials = await db.query.competitionVolunteerCredentialsTable.findMany({
    where: eq(competitionVolunteerCredentialsTable.volunteerId, volunteerId),
    with: { credentialType: true },
  });
  return Math.max(...credentials.map(c => c.credentialType.level), 0);
}

// Check if role has a capability (replaces role.isJudge checks)
async function roleHasCapability(roleId: string, capability: string): Promise<boolean> {
  const cap = await db.query.competitionVolunteerRoleCapabilitiesTable.findFirst({
    where: and(
      eq(competitionVolunteerRoleCapabilitiesTable.roleId, roleId),
      eq(competitionVolunteerRoleCapabilitiesTable.capability, capability),
    ),
  });
  return !!cap;
}

// Get all roles with judge capability (replaces WHERE isJudge = true)
async function getJudgeRoles(competitionId: string) {
  return db.query.competitionVolunteerRolesTable.findMany({
    where: eq(competitionVolunteerRolesTable.competitionId, competitionId),
    with: {
      capabilities: {
        where: eq(competitionVolunteerRoleCapabilitiesTable.capability, "judge"),
      },
    },
  }).then(roles => roles.filter(r => r.capabilities.length > 0));
}
```

### 1.2 Organizer UI (`/compete/organizer/[id]/volunteers`)
- **Settings/Roles Tab**:
    - CRUD interface for `Volunteer Roles`.
    - Capability assignment (checkboxes for judge, team_lead, etc.).
    - Toggle "Accepting Volunteers" status for the competition.
- **Volunteers List**:
    - Table view of `competition_volunteers`.
    - Columns: Name, Email, Status, Assigned Roles, Credentials (from junction), Availability.
    - Actions: Approve/Reject, Edit details, Assign Roles, Verify Credentials.
    - "Invite Volunteer" button (modal to enter email).
- **Credentials Management**:
    - View/verify volunteer credentials.
    - Filter volunteers by credential type/level.

### 1.3 Public UI (`/compete/[slug]/volunteer`)
- Simple registration form for volunteers.
- Fields: Name, Email, Shirt Size, Credentials (multi-select from seeded types), Role Preferences, Availability Notes.
- Links to existing User account if logged in.

## Phase 2: Heat Scheduling (The Core Requirement)
**Goal:** Allow organizers to assign specific volunteers (primarily judges) to specific heats and lanes.

### 2.1 Database Schema
Add to `volunteers.ts`:

```typescript
// competition_heat_volunteers
// Assigns a volunteer to a specific heat execution
export const competitionHeatVolunteersTable = sqliteTable("competition_heat_volunteers", {
  id: text().primaryKey().$defaultFn(() => createHeatVolunteerId()).notNull(),
  heatId: text().notNull().references(() => competitionHeatsTable.id, { onDelete: "cascade" }),
  volunteerId: text().notNull().references(() => competitionVolunteersTable.id, { onDelete: "cascade" }),
  roleId: text().notNull().references(() => competitionVolunteerRolesTable.id, { onDelete: "cascade" }),
  laneNumber: integer(), // Nullable (Equipment crew might not need a lane)
  position: text({ length: 50 }), // Specific sub-position e.g. "Main Booth", "Floater"
  instructions: text({ length: 2000 }), // Event-specific instructions for this assignment
}, (table) => [
  index("heat_vol_heat_idx").on(table.heatId),
  index("heat_vol_vol_idx").on(table.volunteerId),
]);
```

### 2.2 Organizer UI: Judge Scheduling

The organizer needs a dedicated area to schedule judges for heats. This is **separate from the athlete schedule view** (`/schedule`) to avoid confusion and keep concerns separated.

#### Route Structure

```
/compete/organizer/[competitionId]/volunteers/           # Volunteer list & management (Phase 1)
/compete/organizer/[competitionId]/volunteers/roles      # Role management (Phase 1)
/compete/organizer/[competitionId]/volunteers/judges     # Judge heat scheduling (Phase 2)
/compete/organizer/[competitionId]/volunteers/shifts     # Shift scheduling (Phase 3)
```

#### 2.2.1 Judge Schedule Manager (`/volunteers/judges`)

**Purpose:** Assign judges to heats and lanes for each event. Mirrors the athlete schedule UI pattern but for volunteers.

**Key Insight: Judges Work Multiple Heats**

Unlike athletes (who compete once per event), judges typically work **multiple consecutive heats**. Only large competitions swap judges every heat. Common patterns:
- Same judges for all heats of an event
- Judges shift lanes between heats (add one at top, pop one off bottom)
- Occasional mid-event rotation for breaks

**Design implication:** The UI should make "keep same judges" the easy path, not force per-heat assignment. Don't prebake complex rotation logic - keep it flexible for manual assignment.

**Layout:** Same 3-column grid as athlete schedule - heats on left (2 cols), available judges on right (1 col sticky sidebar).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Judge Schedule                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ Schedule Overview ─────────────────────────────────────────────────────┐ │
│ │ Sat, Mar 15                                                             │ │
│ │ 01  Fran           9:00 AM-10:15 AM    4 heats   12/16 lanes assigned  │ │
│ │ 02  Diane          10:30 AM-11:45 AM   4 heats   8/16 lanes assigned   │ │
│ │ 03  Grace          1:00 PM-2:15 PM     4 heats   0/16 lanes assigned   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Judge Assignments: Draft ─────────────────────────────────────────────┐ │
│ │ [Draft ▼]  Judge assignments for Fran are hidden from volunteers       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Event: [1. Fran ▼]    Venue: [Main Floor ▼]    Cap: [8] min               │
│                                                                             │
│ 4 heats • 12 assigned • 4 unassigned              [+ Add Heat] [+ Add 2]  │
│                                                                             │
│ ┌─────────────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │                                             │ │ Unassigned Judges       │ │
│ │ ┌─ Heat 1 ──────────────────── 4/4 ──────┐ │ │                         │ │
│ │ │ ▼  Heat 1         9:00 AM  Main Floor  │ │ │ [All Credentials ▼]     │ │
│ │ │    RX Division                         │ │ │                         │ │
│ │ ├────────────────────────────────────────┤ │ │ ┌─ 4 selected ────────┐ │
│ │ │ ⠿ L1  Kevin Martinez         L2  ✕    │ │ │ │ [Clear]             │ │
│ │ │ ⠿ L2  Matt Johnson           L2  ✕    │ │ │ └─────────────────────┘ │
│ │ │ ⠿ L3  Becky Thompson         L1  ✕    │ │ │                         │ │
│ │ │ ⠿ L4  JT Williams            L1  ✕    │ │ │ L2 Certified (3)        │ │
│ │ │                                        │ │ │ ┌─────────────────────┐ │
│ │ │ [+ Assign Judge]                       │ │ │ │ ☐ ⠿ Sarah Chen  L2  │ │
│ │ └────────────────────────────────────────┘ │ │ │ ☑ ⠿ Mike Davis  L2  │ │
│ │                                             │ │ │ ☑ ⠿ Lisa Park   L2  │ │
│ │ ┌─ Heat 2 ──────────────────── 4/4 ──────┐ │ │ └─────────────────────┘ │
│ │ │ ▼  Heat 2         9:15 AM  Main Floor  │ │ │                         │ │
│ │ │    RX Division                         │ │ │ L1 Certified (5)        │ │
│ │ ├────────────────────────────────────────┤ │ │ ┌─────────────────────┐ │
│ │ │ ⠿ L1  Scott Anderson         L1  ✕    │ │ │ │ ☑ ⠿ Tom Brown   L1  │ │
│ │ │ ⠿ L2  Amy Wilson             L1  ✕    │ │ │ │ ☑ ⠿ Jane Smith  L1  │ │
│ │ │ ⠿ L3  Chris Lee              L1  ✕    │ │ │ │ ☐ ⠿ Bob Jones   L1  │ │
│ │ │ ⠿ L4  Dana Miller            L1  ✕    │ │ │ │ ☐ ⠿ Kim Taylor  L1  │ │
│ │ │                                        │ │ │ │ ☐ ⠿ Pat Garcia  L1  │ │
│ │ │ [+ Assign Judge]                       │ │ │ └─────────────────────┘ │
│ │ └────────────────────────────────────────┘ │ │                         │ │
│ │                                             │ │                         │ │
│ │ ┌─ Heat 3 ──────────────────── 0/4 ──────┐ │ │                         │ │
│ │ │ ▼  Heat 3         9:30 AM  Main Floor  │ │ │                         │ │
│ │ │    Scaled Division                     │ │ │                         │ │
│ │ ├────────────────────────────────────────┤ │ │                         │ │
│ │ │                                        │ │ │                         │ │
│ │ │    No judges assigned                  │ │ │                         │ │
│ │ │                                        │ │ │                         │ │
│ │ │ [Copy from Heat 2] [+ Assign Judge]    │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │                         │ │
│ │                                             │ │                         │ │
│ │ ┌─ Heat 4 ──────────────────── 0/4 ──────┐ │ │                         │ │
│ │ │ ▶  Heat 4         9:45 AM  Main Floor  │ │ │                         │ │
│ │ │    Scaled Division                     │ │ │                         │ │
│ │ │    0 assigned • [Copy from Heat 3]     │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │                         │ │
│ │                                             │ └─────────────────────────┘ │
│ └─────────────────────────────────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key UI Elements (matching existing athlete schedule patterns):**

1. **Schedule Overview** (`EventOverview` pattern)
   - Shows all events with judge assignment progress
   - Quick visual of which events need attention

2. **Event/Venue Selectors** (same as athlete schedule)
   - Dropdown to select event
   - Dropdown to filter by venue
   - Time cap input for heat duration calculation

3. **Heat Cards** (`HeatCard` pattern - can copy/adapt)
   - Collapsed view shows: heat number, time, venue, division, assignment count
   - Expanded view shows lane-by-lane assignments
   - Each lane slot is a drop target for drag-and-drop
   - Grip handle (⠿) for dragging assigned judges between lanes/heats
   - **"Copy from Previous Heat"** button when empty (primary workflow)
   - **"More Actions"** menu when populated (copy to next, copy to all remaining, clear)

4. **Unassigned Judges Sidebar** (`DraggableAthlete` pattern - can copy/adapt)
   - Sticky sidebar on right
   - Grouped by credential level (L2, L1, etc.)
   - Checkbox selection for multi-select
   - Shift+click for range selection
   - Drag preview shows count when multiple selected
   - Filter dropdown by credential type

#### 2.2.2 Component Reuse Strategy

**Components to COPY and adapt** (from `schedule/_components/`):

| Existing Component | New Component | Changes Needed |
|-------------------|---------------|----------------|
| `heat-schedule-manager.tsx` | `judge-schedule-manager.tsx` | Replace registrations with volunteers, add credential display |
| `heat-card.tsx` | `judge-heat-card.tsx` | Replace athlete display with judge + credential badge |
| `draggable-athlete.tsx` | `draggable-judge.tsx` | Show credential level instead of registration date |
| `event-overview.tsx` | `judge-overview.tsx` | Show judge assignment counts instead of athlete counts |
| `schedule-page-client.tsx` | `judge-schedule-client.tsx` | Wire up volunteer data instead of registration data |

**Components to REUSE as-is:**
- `@atlaskit/pragmatic-drag-and-drop` - Same drag-and-drop library
- `Card`, `Badge`, `Select`, `Dialog` - Same UI primitives
- Lane numbering pattern (L1, L2, L3...)
- Collapsed/expanded heat card pattern
- Multi-select with shift+click pattern

**New Components Needed:**
| Component | Purpose |
|-----------|---------|
| `CredentialBadge` | Shows L1/L2/Medical badge with color coding |
| `JudgeAvailabilityIndicator` | Shows if judge is assigned to overlapping heat |
| `BulkJudgeActions` | Copy from previous heat, clear all |

#### 2.2.3a Bulk Actions for Multi-Heat Judging

Since judges typically work multiple consecutive heats, the primary workflow helper is **"Copy from Previous Heat"**:

```
┌─ Heat 2 ──────────────────── 0/4 ──────┐
│ ▼  Heat 2         9:15 AM  Main Floor  │
│    RX Division                         │
├────────────────────────────────────────┤
│                                        │
│    No judges assigned                  │
│                                        │
│ [Copy from Heat 1] [+ Assign Judge]    │
└────────────────────────────────────────┘
```

**Bulk Actions Menu** (appears when heat has assignments):

```
┌─ Heat 3 ──────────────────── 4/4 ──────┐
│ ▼  Heat 3         9:30 AM  Main Floor  │
│    Scaled Division                     │
├────────────────────────────────────────┤
│ ⠿ L1  Kevin Martinez         L2  ✕    │
│ ⠿ L2  Matt Johnson           L2  ✕    │
│ ⠿ L3  Becky Thompson         L1  ✕    │
│ ⠿ L4  JT Williams            L1  ✕    │
│                                        │
│ [⋮ More Actions]                       │
│ ┌──────────────────────────────────┐   │
│ │ Copy to Next Heat                │   │
│ │ Copy to All Remaining Heats      │   │
│ │ ─────────────────────────────    │   │
│ │ Clear All Assignments            │   │
│ └──────────────────────────────────┘   │
└────────────────────────────────────────┘
```

**Actions:**
| Action | Behavior |
|--------|----------|
| Copy from Previous Heat | Copies all judge assignments from the previous heat to this heat (same lanes) |
| Copy to Next Heat | Copies this heat's assignments to the next heat |
| Copy to All Remaining Heats | Copies this heat's assignments to all subsequent heats in the event |
| Clear All Assignments | Removes all judges from this heat |

**Why no auto-rotation?** Competition organizers have different preferences:
- Some want the same judges all day
- Some rotate judges between events (not heats)
- Some shift lanes (L1→L2→L3→off, new judge at L1)
- Some have specific judges for specific divisions

Rather than guess, we provide simple copy tools and let organizers arrange manually.

#### 2.2.4 Key Differences from Athlete Schedule

| Aspect | Athlete Schedule | Judge Schedule |
|--------|-----------------|----------------|
| Data source | `registrations` | `volunteers` with `judge` capability |
| Sidebar grouping | By division | By credential level |
| Badge display | Registration date | Credential type (L1, L2) |
| Assignment pattern | Each athlete once per event | Same judges across multiple heats |
| Availability | N/A (each athlete once) | Check for time conflicts across events |
| Bulk actions | N/A | Copy from/to heats (primary workflow) |
| Status toggle | Heat visibility (draft/published) | Same pattern |

#### 2.2.5 Data Requirements

**Server functions needed:**
```typescript
// Get volunteers with judge capability for a competition
getJudgeVolunteers(competitionId: string): Promise<JudgeVolunteer[]>

// Get judge assignments for all heats of an event
getJudgeHeatAssignments(trackWorkoutId: string): Promise<JudgeHeatAssignment[]>

// Assign judge to heat lane
assignJudgeToHeat(params: {
  heatId: string
  volunteerId: string
  laneNumber: number
}): Promise<JudgeHeatAssignment>

// Bulk assign judges to heat
bulkAssignJudgesToHeat(params: {
  heatId: string
  assignments: { volunteerId: string; laneNumber: number }[]
}): Promise<JudgeHeatAssignment[]>

// Remove judge from heat
removeJudgeFromHeat(assignmentId: string): Promise<void>

// Move judge between lanes/heats
moveJudgeAssignment(params: {
  assignmentId: string
  targetHeatId: string
  targetLaneNumber: number
}): Promise<void>

// Check for time conflicts
getJudgeConflicts(volunteerId: string, heatId: string): Promise<ConflictInfo | null>

// === BULK COPY OPERATIONS (primary workflow for multi-heat judging) ===

// Copy all judge assignments from one heat to another
copyJudgeAssignmentsToHeat(params: {
  sourceHeatId: string
  targetHeatId: string
}): Promise<JudgeHeatAssignment[]>

// Copy judge assignments to all remaining heats in the event
copyJudgeAssignmentsToRemainingHeats(params: {
  sourceHeatId: string
  trackWorkoutId: string  // Event ID to get remaining heats
}): Promise<{ heatId: string; assignments: JudgeHeatAssignment[] }[]>

// Clear all judge assignments from a heat
clearHeatJudgeAssignments(heatId: string): Promise<void>
```

## Phase 3: General Scheduling (Shifts)
**Goal:** Manage volunteers who aren't tied to specific heat lanes (e.g., Check-in desk 8am-12pm).

### 3.1 Database Schema
```typescript
// competition_volunteer_shifts
// Generic time blocks for non-heat-based volunteer work
export const competitionVolunteerShiftsTable = sqliteTable("competition_volunteer_shifts", {
  id: text().primaryKey().$defaultFn(() => createShiftId()).notNull(),
  competitionId: text().notNull().references(() => competitionsTable.id, { onDelete: "cascade" }),
  name: text({ length: 100 }).notNull(), // "Morning Check-in"
  startTime: integer({ mode: "timestamp" }).notNull(),
  endTime: integer({ mode: "timestamp" }).notNull(),
  roleId: text().references(() => competitionVolunteerRolesTable.id, { onDelete: "set null" }),
  capacity: integer(), // How many people needed?
  location: text({ length: 100 }), // e.g. "Front Desk", "Warm-up Area"
}, (table) => [
  index("vol_shifts_comp_idx").on(table.competitionId),
]);

// competition_shift_assignments
export const competitionShiftAssignmentsTable = sqliteTable("competition_shift_assignments", {
  id: text().primaryKey().$defaultFn(() => createShiftAssignmentId()).notNull(),
  shiftId: text().notNull().references(() => competitionVolunteerShiftsTable.id, { onDelete: "cascade" }),
  volunteerId: text().notNull().references(() => competitionVolunteersTable.id, { onDelete: "cascade" }),
  position: text({ length: 50 }), // Specific sub-position within the shift
  status: text({
    enum: ["assigned", "confirmed", "checked_in", "no_show"],
  }).default("assigned").notNull(),
}, (table) => [
  index("shift_assign_shift_idx").on(table.shiftId),
  index("shift_assign_vol_idx").on(table.volunteerId),
]);
```

### 3.2 Organizer UI: Shift Management (`/volunteers/shifts`)

**Purpose:** Schedule non-judge volunteers (equipment, staff, medical) into time-based shifts.

**Layout:** Similar 3-column grid as judge schedule - shifts on left (2 cols), available volunteers on right (1 col sticky sidebar).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Shift Schedule                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ┌─ Shift Overview ────────────────────────────────────────────────────────┐ │
│ │ Sat, Mar 15                                                             │ │
│ │ Morning Setup       7:00-9:00 AM     3 needed   2/3 assigned           │ │
│ │ Check-in            8:00 AM-12:00 PM 4 needed   4/4 assigned  ✓        │ │
│ │ Event Transitions   9:00 AM-3:00 PM  6 needed   3/6 assigned           │ │
│ │ Teardown            3:00-5:00 PM     4 needed   0/4 assigned           │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Role: [All Roles ▼]    Location: [All Locations ▼]    [+ Add Shift]       │
│                                                                             │
│ 4 shifts • 9 assigned • 8 unassigned                                       │
│                                                                             │
│ ┌─────────────────────────────────────────────┐ ┌─────────────────────────┐ │
│ │                                             │ │ Unassigned Volunteers   │ │
│ │ ┌─ Morning Setup ────────────── 2/3 ─────┐ │ │                         │ │
│ │ │ ▼  7:00 AM - 9:00 AM       Main Floor  │ │ │ [All Roles ▼]           │ │
│ │ │    Equipment Crew                      │ │ │                         │ │
│ │ ├────────────────────────────────────────┤ │ │ ┌─ 2 selected ────────┐ │
│ │ │ ⠿ Dustin Martinez      Equipment  ✕   │ │ │ │ [Clear]             │ │
│ │ │ ⠿ Trevor Johnson       Equipment  ✕   │ │ │ └─────────────────────┘ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │                                        │ │ │ Equipment Crew (4)      │ │
│ │ │ [+ Assign Volunteer]                   │ │ │ ┌─────────────────────┐ │
│ │ └────────────────────────────────────────┘ │ │ │ ☐ ⠿ Alex Chen       │ │
│ │                                             │ │ │ ☑ ⠿ Jordan Davis    │ │
│ │ ┌─ Check-in ─────────────────── 4/4 ─────┐ │ │ │ ☑ ⠿ Casey Park      │ │
│ │ │ ▶  8:00 AM - 12:00 PM     Front Desk   │ │ │ │ ☐ ⠿ Riley Kim       │ │
│ │ │    Staff                               │ │ │ └─────────────────────┘ │
│ │ │    4 assigned • Full ✓                 │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │ Staff (6)               │ │
│ │                                             │ │ ┌─────────────────────┐ │
│ │ ┌─ Event Transitions ────────── 3/6 ─────┐ │ │ │ ☐ ⠿ Morgan Lee      │ │
│ │ │ ▼  9:00 AM - 3:00 PM       All Areas   │ │ │ │ ☐ ⠿ Taylor Swift    │ │
│ │ │    Equipment Crew                      │ │ │ │ ☐ ⠿ Sam Wilson      │ │
│ │ ├────────────────────────────────────────┤ │ │ │ ☐ ⠿ Jamie Brown     │ │
│ │ │ ⠿ Alex Chen            Equipment  ✕   │ │ │ │ ☐ ⠿ Drew Garcia     │ │
│ │ │ ⠿ Jordan Davis         Equipment  ✕   │ │ │ │ ☐ ⠿ Quinn Miller    │ │
│ │ │ ⠿ Casey Park           Equipment  ✕   │ │ │ └─────────────────────┘ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │                                        │ │ │                         │ │
│ │ │ [+ Assign Volunteer]                   │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │                         │ │
│ │                                             │ │                         │ │
│ │ ┌─ Teardown ─────────────────── 0/4 ─────┐ │ │                         │ │
│ │ │ ▼  3:00 PM - 5:00 PM       Main Floor  │ │ │                         │ │
│ │ │    Equipment Crew                      │ │ │                         │ │
│ │ ├────────────────────────────────────────┤ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │                                        │ │ │                         │ │
│ │ │ [+ Assign Volunteer]                   │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │                         │ │
│ │                                             │ └─────────────────────────┘ │
│ └─────────────────────────────────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 3.2.1 Shift Creation Dialog

```
┌─ Create Shift ──────────────────────────────────────────────────┐
│                                                                  │
│ Shift Name         [Morning Setup                    ]          │
│                                                                  │
│ Start Time         [2025-03-15T07:00    ]                       │
│                                                                  │
│ End Time           [2025-03-15T09:00    ]                       │
│                                                                  │
│ Location           [Main Floor                       ]          │
│                                                                  │
│ Capacity           [3    ] volunteers needed                    │
│                                                                  │
│ Role (optional)    [Equipment Crew ▼]                           │
│                    Filters which volunteers can be assigned     │
│                                                                  │
│                                    [Cancel] [Create Shift]      │
└──────────────────────────────────────────────────────────────────┘
```

#### 3.2.2 Component Reuse Strategy

**Components to COPY and adapt** (from `schedule/_components/`):

| Existing Component | New Component | Changes Needed |
|-------------------|---------------|----------------|
| `heat-schedule-manager.tsx` | `shift-schedule-manager.tsx` | Replace heats with shifts, remove lane concept |
| `heat-card.tsx` | `shift-card.tsx` | Replace lanes with capacity slots, show time range |
| `draggable-athlete.tsx` | `draggable-volunteer.tsx` | Show role instead of division |
| `event-overview.tsx` | `shift-overview.tsx` | Show shift fill status |

**Key Differences from Judge Schedule:**

| Aspect | Judge Schedule | Shift Schedule |
|--------|---------------|----------------|
| Time model | Heats (inherit from events) | Custom time ranges |
| Capacity | Lanes (from venue) | Configurable per shift |
| Grouping | By event | By time/location |
| Conflicts | Overlapping heats | Overlapping shifts |

### 3.3 Volunteer Portal (`/compete/[slug]/volunteer/dashboard`)

**Purpose:** Volunteers view their own schedule (both heat assignments and shift assignments).

**Access:** Requires being a member of a volunteer team for this competition.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ My Volunteer Schedule                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Mountain West Throwdown 2025                                               │
│ Saturday, March 15, 2025                                                   │
│                                                                             │
│ ┌─ Your Day at a Glance ──────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │  7:00 AM   Morning Setup          Main Floor      Equipment Crew       │ │
│ │  9:00 AM   Event 1: Fran          Heat 3, Lane 2  Judge                │ │
│ │ 10:30 AM   Event 2: Diane         Heat 1, Lane 5  Judge                │ │
│ │  1:00 PM   Event 3: Grace         Heat 4, Lane 1  Judge                │ │
│ │  3:00 PM   Teardown               Main Floor      Equipment Crew       │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Judging Assignments ───────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ ┌─ Event 1: Fran ─────────────────────────────────────────────────────┐ │ │
│ │ │ Heat 3 • Lane 2 • 9:00 AM • Main Floor                              │ │ │
│ │ │                                                                     │ │ │
│ │ │ 📋 Judge Notes Available                                            │ │ │
│ │ │ 📄 Score Sheet Available                                            │ │ │
│ │ │                                                                     │ │ │
│ │ │ [View Preparation Materials →]                                      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ ┌─ Event 2: Diane ────────────────────────────────────────────────────┐ │ │
│ │ │ Heat 1 • Lane 5 • 10:30 AM • Main Floor                             │ │ │
│ │ │                                                                     │ │ │
│ │ │ 📋 Judge Notes Available                                            │ │ │
│ │ │                                                                     │ │ │
│ │ │ [View Preparation Materials →]                                      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ ┌─ Event 3: Grace ────────────────────────────────────────────────────┐ │ │
│ │ │ Heat 4 • Lane 1 • 1:00 PM • Main Floor                              │ │ │
│ │ │                                                                     │ │ │
│ │ │ [View Preparation Materials →]                                      │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─ Shift Assignments ─────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ ┌─ Morning Setup ─────────────────────────────────────────────────────┐ │ │
│ │ │ 7:00 AM - 9:00 AM • Main Floor                                      │ │ │
│ │ │ Role: Equipment Crew                                                │ │ │
│ │ │ Status: Confirmed ✓                                                 │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │ ┌─ Teardown ──────────────────────────────────────────────────────────┐ │ │
│ │ │ 3:00 PM - 5:00 PM • Main Floor                                      │ │ │
│ │ │ Role: Equipment Crew                                                │ │ │
│ │ │ Status: Assigned                                                    │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- **Day at a Glance** - Chronological timeline of all assignments
- **Judging Assignments** - Detailed cards with prep material links
- **Shift Assignments** - Time blocks with status indicators
- **Mobile-optimized** - Works on phones for day-of reference
- **Status tracking** - Assigned → Confirmed → Checked-in

#### 3.3.1 Data Requirements

**Server functions needed:**
```typescript
// Get volunteer's assignments for a competition
getVolunteerSchedule(params: {
  competitionId: string
  userId: string
}): Promise<{
  heatAssignments: JudgeHeatAssignment[]
  shiftAssignments: ShiftAssignment[]
}>

// Get event prep materials (judge notes, score sheet)
getEventPrepMaterials(trackWorkoutId: string): Promise<{
  judgeNotes: string | null
  scoreSheetUrl: string | null
  scoreSheetFilename: string | null
}>
```

## Technical Implementation Steps

1.  **Scaffold Schema**: 
    - Create `apps/wodsmith/src/db/schemas/volunteers.ts` and export in `schema.ts`.
    - Add ID generators to `common.ts`.
    - Run migrations.
2.  **Seed Credential Types**:
    - Create seed script for credential types (L1, L2, Medical, etc.).
    - Similar pattern to `scripts/seed-entitlements.ts`.
3.  **Server Actions**:
    - `getVolunteerRoles`, `createVolunteerRole`, `updateVolunteerRole`, `deleteVolunteerRole`.
    - `addRoleCapability`, `removeRoleCapability`, `getRolesWithCapability`.
    - `getVolunteers`, `registerVolunteer`, `updateVolunteerStatus`.
    - `addVolunteerCredential`, `verifyCredential`, `getVolunteerCredentialLevel`.
4.  **Frontend (Organizer - Volunteers Tab)**:
    - Build `VolunteerRolesManager` component with capability checkboxes.
    - Build `VolunteersList` component with credential badges.
    - Build `CredentialVerification` component.
    - Integrate into Organizer Sidebar.
5.  **Frontend (Public)**:
    - Build `/volunteer` registration page with credential multi-select.
6.  **Heat Assignment Logic**:
    - Create `assignJudgeToHeat` action (filter by `judge` capability).
    - Update `HeatCard` to support "Judge Mode".
    - Implement Drag & Drop for judges with credential level sorting.

## Schema Design Rationale

### Why No Boolean Columns?

Following the entitlements system pattern, we avoid boolean columns because:

1. **Extensibility**: Adding a new capability (e.g., "equipment_trained") requires no schema migration - just insert a row.
2. **Composability**: A "Head Judge" role can have BOTH `judge` AND `team_lead` capabilities.
3. **Queryability**: `WHERE capability = 'judge'` is clearer than `WHERE isJudge = 1`.
4. **Consistency**: Matches the `plan_feature` junction pattern in entitlements.

### Why Normalize Credentials?

The original `credentials: text() // JSON: ["L1", "Medical"]` approach has problems:

1. **No indexing**: Can't efficiently query "all L2 judges".
2. **No validation**: Any string can be stored.
3. **No metadata**: Can't track verification, expiration.
4. **Redundant**: `credentialLevel` duplicates info in the JSON.

The junction table approach:
- Enables `JOIN` queries for filtering.
- Enforces valid credential types via FK.
- Tracks verification and expiration.
- Computes `credentialLevel` from the data (no duplication).

## Phase 4: Judge Preparation Materials
**Goal:** Provide judges with event-specific notes and score sheet previews to help them prepare before judging.

### 4.1 Overview

Judges need preparation materials for each event:
1. **Judge Notes** - Movement standards, common no-reps, tiebreak procedures
2. **Score Sheet Preview** - Image/PDF of the physical score sheet they'll use during the event

These are stored on the **event record** (`trackWorkoutsTable`) since they apply to all judges for that event, regardless of which heat they're assigned to.

### 4.2 Database Schema

Add to `trackWorkoutsTable` in `apps/wodsmith/src/db/schemas/programming.ts`:

```typescript
// Judge preparation fields (added to existing trackWorkoutsTable)
judgeNotes: text({ length: 5000 }),           // Markdown-formatted notes for judges
scoreSheetUrl: text({ length: 600 }),         // R2 URL to uploaded score sheet (image/PDF)
scoreSheetFilename: text({ length: 255 }),    // Original filename for display
scoreSheetUploadedAt: integer({ mode: "timestamp" }),
scoreSheetUploadedBy: text().references(() => userTable.id, { onDelete: "set null" }),
```

**Why on `trackWorkoutsTable`?**
- `trackWorkoutsTable` IS the event record for competitions (Event 1, Event 2, etc.)
- Already has competition-specific fields: `pointsMultiplier`, `heatStatus`, `eventStatus`, `sponsorId`
- Notes/sheets are per-event, not per-heat or per-volunteer
- Simple to query when displaying event details

### 4.3 File Upload

Extend the existing `/api/upload` route:

```typescript
// Add to ALLOWED_TYPES
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf"  // NEW: for score sheets
]

// Add to PURPOSE_CONFIG
const PURPOSE_CONFIG = {
  // ... existing purposes ...
  "event-scoresheet": { maxSizeMb: 10, pathPrefix: "competitions/scoresheets" },
}
```

**R2 Storage Path:** `competitions/scoresheets/{competitionId}/{eventId}/{timestamp}.{ext}`

**Authorization:** Requires `MANAGE_PROGRAMMING` permission on the organizing team.

### 4.4 Organizer UI

**Location:** `/compete/organizer/[competitionId]/events/[eventId]` (existing event edit page)

Add a new "Judge Preparation" card to `EventDetailsForm`:

```
┌─ Judge Preparation ────────────────────────────────┐
│                                                     │
│ Judge Notes                                         │
│ ┌─────────────────────────────────────────────────┐ │
│ │ ## Movement Standards                            │ │
│ │ - Thrusters: Full hip extension, bar overhead   │ │
│ │ - Pull-ups: Chin clearly over bar               │ │
│ │                                                  │ │
│ │ ## Common No-Reps                                │ │
│ │ - Incomplete lockout on thrusters               │ │
│ │ - Kipping before arms are fully extended        │ │
│ │                                                  │ │
│ │ ## Tiebreak                                      │ │
│ │ - Time at completion of round of 15             │ │
│ └─────────────────────────────────────────────────┘ │
│ Markdown supported. Visible to all volunteers.      │
│                                                     │
│ Score Sheet Preview                                 │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📄 event1-scoresheet.pdf              [Delete]  │ │
│ └─────────────────────────────────────────────────┘ │
│ or                                                  │
│ [Upload Image/PDF] (Max 10MB)                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Components:**
- `<ScoreSheetUpload>` - File input with drag-drop, shows current file with delete option
- Textarea for judge notes with markdown support

### 4.5 Volunteer/Judge View

**Access:** All volunteers can view judge preparation materials for all events (helps them prepare even before heat assignments are finalized).

**Option A: Inline on Event Details**
Add a "Judge Info" section to the public event view at `/compete/[slug]/workouts` that shows:
- Judge notes (rendered as markdown)
- Score sheet link (opens in new browser tab)

**Option B: Dedicated Judge Info Page** (future)
Create `/compete/[slug]/events/[eventId]/judge-info` with:
- Full judge notes display
- Score sheet viewer/download
- Link from volunteer dashboard

**PDF Handling:** Opens in new browser tab using native PDF viewer (simple, works everywhere). Embedded viewer can be added later if needed.

### 4.6 Data Flow

```
Organizer edits event
    ↓
EventDetailsForm (Judge Preparation card)
    ↓
ScoreSheetUpload → POST /api/upload (purpose="event-scoresheet")
    ↓
R2 bucket: competitions/scoresheets/{competitionId}/{eventId}/{timestamp}.{ext}
    ↓
Form state updated with URL + filename
    ↓
saveCompetitionEventAction → saveCompetitionEvent()
    ↓
trackWorkoutsTable updated with judgeNotes, scoreSheetUrl, etc.
    ↓
Volunteers view via event details or judge-info page
```

### 4.7 Schema Updates Summary

**`trackWorkoutsTable`** (5 new fields):
| Field | Type | Description |
|-------|------|-------------|
| `judgeNotes` | `text(5000)` | Markdown-formatted notes for judges |
| `scoreSheetUrl` | `text(600)` | R2 URL to uploaded file |
| `scoreSheetFilename` | `text(255)` | Original filename for display |
| `scoreSheetUploadedAt` | `timestamp` | When the file was uploaded |
| `scoreSheetUploadedBy` | `text` (FK→users) | Who uploaded the file |

**Migration:** `pnpm db:generate add-judge-notes-and-scoresheet`

### 4.8 Implementation Checklist

- [ ] Add 5 fields to `trackWorkoutsTable` schema
- [ ] Generate and apply migration
- [ ] Update `/api/upload` route (add PDF type, new purpose)
- [ ] Update `saveCompetitionEvent` server function
- [ ] Update `saveCompetitionEventSchema` action schema
- [ ] Update `competitionEventSchema` form schema
- [ ] Create `ScoreSheetUpload` component
- [ ] Add Judge Preparation card to `EventDetailsForm`
- [ ] Update `getCompetitionEvent` to return new fields
- [ ] Add judge info display to public event view
- [ ] Test upload/save/display flow

## Future Considerations
- **Check-in/Check-out**: Add `checkedInAt`, `checkedOutAt` to shift assignments.
- **Communication**: Email blasts to volunteers with specific capabilities or credentials.
- **Self-Scheduling**: Allow volunteers to claim open shifts (respects credential requirements).
- **Credential Expiration**: Background job to flag expired credentials.
- **Embedded PDF Viewer**: Add `react-pdf` for inline score sheet preview (currently opens in new tab).
- **Division-Specific Score Sheets**: Support different score sheets per division if needed.
