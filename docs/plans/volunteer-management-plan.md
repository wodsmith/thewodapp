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

Volunteers are members of the existing **competition_team** with a `volunteer` system role. Role types (judge, equipment, medical) are **organizational labels** stored in metadata - they help admins organize volunteers but don't gate permissions.

```
Competition (e.g., "Mountain West Throwdown 2025")
└── Competition Team (competition_team type, already exists per competition)
    ├── Athletes: roleId="member" (existing flow)
    └── Volunteers: roleId="volunteer" (system role) with volunteerRoleTypes[] in metadata
        ├── Zara: volunteerRoleTypes=["judge"] + has score_access entitlement
        ├── Marcus: volunteerRoleTypes=["head_judge"] + has score_access entitlement
        ├── Kenji: volunteerRoleTypes=["judge", "equipment"] (no score access)
        └── Rashid: volunteerRoleTypes=["medical"]
```

**Key points:**
- Volunteers use the `volunteer` system role for base membership
- `volunteerRoleTypes` is an **array** - a single volunteer can have multiple role labels
- Role types are for **organization**, not permissions (all volunteers can do the same things)
- **Score input access** is the only gated capability, controlled via entitlements

### Why Reuse competition_team?

1. **No schema changes** - `competition_team` already exists, linked to competitions via `competitionTeamId`
2. **Reuse invite flow** - `teamInvitationTable` already handles email invites with tokens
3. **Reuse membership** - `teamMembershipTable` tracks who's on the team
4. **Permission system** - Existing `teamRoleTable` defines volunteer-specific roles with permissions
5. **Single team per competition** - Simpler model, no need for multiple volunteer teams
6. **Role-based access** - Volunteers get different permissions based on their custom role

### New System Role: Volunteer

Add to `SYSTEM_ROLES_ENUM` in `teams.ts`:

```typescript
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner",
  ADMIN: "admin",
  CAPTAIN: "captain",    // Competition team captain
  MEMBER: "member",
  GUEST: "guest",
  VOLUNTEER: "volunteer", // NEW: For competition volunteers
} as const
```

### Volunteer Role Types (Organizational Only)

Role types are **labels for organizing volunteers**, not permission gates. For MVP, all volunteers have the same base access.

| Role Type | Description |
|-----------|-------------|
| `judge` | Lane judge for competition heats |
| `head_judge` | Lead judge coordinating other judges |
| `equipment` | Equipment setup and transitions |
| `medical` | Medical/first aid support |
| `check_in` | Registration desk |
| `staff` | General helper |

**All volunteers can:**
- View the competition schedule
- View athlete info (names, divisions, heat assignments)
- Get assigned to any heat or shift
- View event details and judge notes

### Score Input Access (Entitlement-Gated)

The only gated capability is **score input**. This uses the existing entitlements system to grant specific volunteers the ability to input/edit scores.

```typescript
// Grant score input access to a volunteer
await createEntitlement({
  userId: volunteerId,
  teamId: competitionTeamId,
  entitlementTypeId: "volunteer_score_access",
  sourceType: "MANUAL",
  sourceId: adminUserId,
  metadata: {
    competitionId: competition.id,
    grantedBy: adminUserId,
  },
  expiresAt: competition.endDate, // Auto-revoke after competition
});

// Check when volunteer tries to input score
const canInputScores = await hasEntitlement(
  userId,
  "volunteer_score_access",
  competitionTeamId
);
```

**Why entitlements for score input?**
1. **Audit trail** - Track who granted access and when
2. **Auto-expiration** - Access can expire after competition ends
3. **Granular control** - Not all judges need score input (some just count reps verbally)
4. **Revocable** - Easy to revoke if needed
5. **Existing infrastructure** - Reuses the proven entitlements system

### Volunteer Membership Structure

Volunteers use `teamMembershipTable` with:
- `teamId` = competition's `competitionTeamId`
- `roleId` = "volunteer" (system role) - grants base volunteer permissions
- `isSystemRole` = 1
- `volunteerRoleTypes` (plural) stored in membership metadata - supports multiple roles

### Volunteer Role Types via Metadata

The `teamMembershipTable` already has flexible fields we can leverage. We store volunteer role types as an **array** in the metadata field, allowing a single volunteer to have multiple roles:

```typescript
// teamMembershipTable already exists - we add a metadata field
export const teamMembershipTable = sqliteTable("team_membership", {
  // ... existing fields ...
  
  // NEW: JSON metadata for extensible membership properties
  metadata: text({ length: 5000 }), // JSON: { volunteerRoleTypes: ["judge", "equipment"], ... }
});

// Volunteer role type values
type VolunteerRoleType = "judge" | "head_judge" | "equipment" | "medical" | "check_in" | "staff";

// TypeScript type for volunteer membership metadata
interface VolunteerMembershipMetadata {
  // Array of role types - volunteer can have multiple roles
  volunteerRoleTypes: VolunteerRoleType[];
  
  // Credentials (freeform, whatever the organizer inputs)
  credentials?: string[];           // ["L2", "CPR", "First Aid"]
  
  // Volunteer details
  shirtSize?: string;               // "S", "M", "L", "XL"
  availabilityNotes?: string;       // "Available 8am-2pm only"
  emergencyContact?: {
    name: string;
    phone: string;
  };
}
```

**Example:** A volunteer who judges morning heats and helps with equipment in the afternoon:
```json
{
  "volunteerRoleTypes": ["judge", "equipment"],
  "credentials": ["L2"],
  "shirtSize": "L",
  "availabilityNotes": "Available all day"
}
```

### Why Metadata?

1. **No new tables** - Reuses existing `teamMembershipTable` structure
2. **Multiple roles** - Array supports volunteers wearing multiple hats
3. **Flexible** - Can add new volunteer-specific fields without migrations
4. **Co-located** - All volunteer info is on the membership record
5. **Queryable** - SQLite JSON functions allow filtering by role type

### Volunteer Flow

1. **Organizer invites volunteers** using existing `inviteUserToTeam()` flow
   - Sends email with token link
   - Invitation uses `roleId` = "volunteer" (system role)
   - `isSystemRole` = 1
   
2. **Volunteer accepts invite and self-reports info**
   - Invite acceptance form includes:
     - Credentials (self-reported): "L2", "CPR", etc.
     - Shirt size
     - Availability notes
     - Role preferences (what they'd like to help with)
   - Creates `teamMembershipTable` entry with:
     - `roleId` = "volunteer" (system role)
     - `isSystemRole` = 1
     - `metadata` = `{ volunteerRoleTypes: [], credentials: ["L2"], shirtSize: "L", ... }`
   - Volunteer is now a member of the competition team
   
3. **Organizer reviews and assigns**
   - Can edit any metadata (credentials, availability, etc.)
   - Assigns `volunteerRoleTypes` based on volunteer preferences and needs
   - Updates credentials, availability, etc. in metadata
   - A volunteer can have multiple role types (e.g., `["judge", "equipment"]`)

4. **Organizer grants score input access** (if needed)
   - Uses entitlements system to grant `volunteer_score_access` to specific volunteers
   - Typically granted to judges who will input scores, not all volunteers

5. **Access checks**
   - Volunteer access: Check if user has `volunteer` role on competition team
   - Score input: Check if user has `volunteer_score_access` entitlement

### Helper Functions

```typescript
// Get volunteer role types from membership metadata
function getVolunteerRoleTypes(membership: TeamMembership): VolunteerRoleType[] {
  if (!membership.metadata) return [];
  const meta = JSON.parse(membership.metadata) as VolunteerMembershipMetadata;
  return meta.volunteerRoleTypes ?? [];
}

// Check if membership is a volunteer (has volunteerRoleTypes in metadata)
function isVolunteer(membership: TeamMembership): boolean {
  return getVolunteerRoleTypes(membership).length > 0;
}

// Check if volunteer has a specific role type
function hasRoleType(membership: TeamMembership, roleType: VolunteerRoleType): boolean {
  return getVolunteerRoleTypes(membership).includes(roleType);
}

// Get all volunteers for a competition
async function getCompetitionVolunteers(competitionTeamId: string) {
  const memberships = await db.query.teamMembershipTable.findMany({
    where: eq(teamMembershipTable.teamId, competitionTeamId),
    with: { user: true },
  });
  
  return memberships.filter(m => isVolunteer(m));
}

// Get volunteers by role type (includes volunteers with multiple roles)
async function getVolunteersByRoleType(competitionTeamId: string, roleType: VolunteerRoleType) {
  const volunteers = await getCompetitionVolunteers(competitionTeamId);
  return volunteers.filter(v => hasRoleType(v, roleType));
}

// Get all volunteers who can judge (judge or head_judge role types)
async function getJudgeVolunteers(competitionTeamId: string) {
  const volunteers = await getCompetitionVolunteers(competitionTeamId);
  return volunteers.filter(v => {
    const roleTypes = getVolunteerRoleTypes(v);
    return roleTypes.includes("judge") || roleTypes.includes("head_judge");
  });
}

// Add a role type to a volunteer
async function addVolunteerRoleType(membershipId: string, roleType: VolunteerRoleType) {
  const membership = await db.query.teamMembershipTable.findFirst({
    where: eq(teamMembershipTable.id, membershipId),
  });
  if (!membership) throw new Error("Membership not found");
  
  const meta = membership.metadata 
    ? JSON.parse(membership.metadata) as VolunteerMembershipMetadata
    : { volunteerRoleTypes: [] };
  
  if (!meta.volunteerRoleTypes.includes(roleType)) {
    meta.volunteerRoleTypes.push(roleType);
  }
  
  await db.update(teamMembershipTable)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(teamMembershipTable.id, membershipId));
}

// Remove a role type from a volunteer
async function removeVolunteerRoleType(membershipId: string, roleType: VolunteerRoleType) {
  const membership = await db.query.teamMembershipTable.findFirst({
    where: eq(teamMembershipTable.id, membershipId),
  });
  if (!membership?.metadata) return;
  
  const meta = JSON.parse(membership.metadata) as VolunteerMembershipMetadata;
  meta.volunteerRoleTypes = meta.volunteerRoleTypes.filter(r => r !== roleType);
  
  await db.update(teamMembershipTable)
    .set({ metadata: JSON.stringify(meta) })
    .where(eq(teamMembershipTable.id, membershipId));
}

// =============================================================================
// SCORE INPUT ACCESS (Entitlement-based)
// =============================================================================

// Grant score input access to a volunteer
async function grantScoreAccess(
  volunteerId: string, 
  competitionTeamId: string, 
  competitionId: string,
  grantedBy: string,
  expiresAt?: Date
) {
  return createEntitlement({
    userId: volunteerId,
    teamId: competitionTeamId,
    entitlementTypeId: "volunteer_score_access",
    sourceType: "MANUAL",
    sourceId: grantedBy,
    metadata: {
      competitionId,
      grantedBy,
    },
    expiresAt,
  });
}

// Check if volunteer can input scores
async function canInputScores(userId: string, competitionTeamId: string): Promise<boolean> {
  return hasEntitlement(userId, "volunteer_score_access", competitionTeamId);
}

// Revoke score input access
async function revokeScoreAccess(userId: string, competitionTeamId: string) {
  // Use soft delete via entitlements system
  return revokeEntitlement(userId, "volunteer_score_access", competitionTeamId);
}
```

## Phase 1: Foundation (Roles & Volunteer Pool)
**Goal:** Enable organizers to define volunteer roles and build a database of volunteers for their competition.

### 1.1 Database Schema

The volunteer system reuses existing infrastructure with minimal new tables:

#### Existing Tables (Reused)
- `teamTable` - Competition team already exists (`type: "competition_team"`)
- `teamMembershipTable` - Volunteers are members with custom roles
- `teamRoleTable` - Custom volunteer roles with permissions
- `teamInvitationTable` - Invite flow for volunteers

#### Schema Prerequisites (Must Be Added First)

Before implementing volunteer management, the following schema changes are required:

**1. Add `volunteer` to `SYSTEM_ROLES_ENUM`** (teams.ts)

The `volunteer` system role does not currently exist in the codebase. Add it:

```typescript
// In src/db/schemas/teams.ts - update SYSTEM_ROLES_ENUM
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner",
  ADMIN: "admin",
  CAPTAIN: "captain",
  MEMBER: "member",
  GUEST: "guest",
  VOLUNTEER: "volunteer", // ADD THIS
} as const
```

**2. Add `metadata` field to `teamMembershipTable`** (teams.ts)

The `teamMembershipTable` currently has no metadata field. Add it:

```typescript
// In src/db/schemas/teams.ts - add to teamMembershipTable
metadata: text({ length: 5000 }), // JSON for extensible properties
```

Then run migration: `pnpm db:generate add-team-membership-metadata`

**3. Seed `volunteer_score_access` entitlement type**

The entitlement type must be seeded before any score access grants, or FK constraints will fail.

Create `scripts/seed-volunteer-entitlements.ts`:

```typescript
import { db } from "@/db"
import { entitlementTypeTable } from "@/db/schema"

await db.insert(entitlementTypeTable).values({
  id: "volunteer_score_access",
  name: "Volunteer Score Access", 
  description: "Allows volunteer to input and edit scores for a competition",
  category: "competition",
}).onConflictDoNothing()

console.log("Seeded volunteer_score_access entitlement type")
```

Run: `pnpm tsx scripts/seed-volunteer-entitlements.ts`

#### Additional Schema Updates

For MVP, all volunteers have the same base access:
- View competition schedule
- View athlete info (names, divisions)
- Get assigned to any activity (heats, shifts)

The only gated capability is **score input**, which uses the entitlements system (see below).

#### Volunteer Membership Metadata Schema

```typescript
// Volunteer role type values
type VolunteerRoleType = "judge" | "head_judge" | "equipment" | "medical" | "check_in" | "staff";

// TypeScript interface for volunteer membership metadata
interface VolunteerMembershipMetadata {
  // Role types for organization (ARRAY - can have multiple)
  volunteerRoleTypes: VolunteerRoleType[];
  
  // Credentials - freeform strings, store whatever organizer inputs
  credentials?: string[];           // ["L2", "CPR", "First Aid"]
  
  // Volunteer details
  shirtSize?: string;               // "S", "M", "L", "XL"
  availabilityNotes?: string;       // "Available 8am-2pm only"
  dietaryRestrictions?: string;     // For volunteer meals
  
  // Emergency contact
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  };
  
  // Organizer notes (not visible to volunteer)
  internalNotes?: string;
}
```

### 1.1.1 Helper Functions

```typescript
// Get all volunteers for a competition
async function getCompetitionVolunteers(competitionTeamId: string) {
  const memberships = await db.query.teamMembershipTable.findMany({
    where: and(
      eq(teamMembershipTable.teamId, competitionTeamId),
      eq(teamMembershipTable.roleId, "volunteer")
    ),
    with: { user: true },
  });
  return memberships;
}

// Get volunteers by role type
async function getVolunteersByRoleType(competitionTeamId: string, roleType: string) {
  const volunteers = await getCompetitionVolunteers(competitionTeamId);
  return volunteers.filter(m => {
    if (!m.metadata) return false;
    const meta = JSON.parse(m.metadata) as VolunteerMembershipMetadata;
    return meta.volunteerRoleTypes?.includes(roleType);
  });
}
```

### 1.2 Organizer UI (`/compete/organizer/[id]/volunteers`)

- **Volunteers List**:
    - Table view of team memberships with `volunteerRoleTypes` in metadata.
    - Columns: Name, Email, Role Types (badges), Credentials, Score Access (yes/no), Availability.
    - Actions: Edit details, Add/Remove Role Types, Grant/Revoke Score Access.
    - "Invite Volunteer" button (uses existing team invite flow).
- **Score Access Toggle**:
    - Quick toggle to grant/revoke `volunteer_score_access` entitlement.
    - Shows who currently has score input access.
- **Bulk Actions**:
    - Grant score access to all judges.
    - Filter by role type or credential.

### 1.3 Volunteer Invite Acceptance Form

When a volunteer clicks their invite link, they see a form to self-report their info:

**Fields:**
- Credentials (freeform text input or common suggestions): "L2", "L1", "CPR", "First Aid", etc.
- Shirt size
- Availability notes: "Available 8am-2pm only"
- Role preferences: What they'd like to help with (judge, equipment, etc.)
- Emergency contact (optional)

This data is stored in the membership `metadata` when they accept the invite. Organizers can review and edit later.

## Phase 2: Heat Scheduling (The Core Requirement)
**Goal:** Allow organizers to assign specific volunteers (primarily judges) to specific heats and lanes.

### 2.1 Database Schema

Add to `competitions.ts` (or new `volunteers.ts` file):

```typescript
// competition_heat_volunteers
// Assigns a volunteer (team member) to a specific heat execution
export const competitionHeatVolunteersTable = sqliteTable("competition_heat_volunteers", {
  id: text().primaryKey().$defaultFn(() => createHeatVolunteerId()).notNull(),
  heatId: text().notNull().references(() => competitionHeatsTable.id, { onDelete: "cascade" }),
  // References the team membership (volunteer is a member of the competition team)
  membershipId: text().notNull().references(() => teamMembershipTable.id, { onDelete: "cascade" }),
  laneNumber: integer(), // Nullable (Equipment crew might not need a lane)
  position: text({ length: 50 }), // Specific sub-position e.g. "Main Booth", "Floater"
  instructions: text({ length: 2000 }), // Event-specific instructions for this assignment
}, (table) => [
  index("heat_vol_heat_idx").on(table.heatId),
  index("heat_vol_member_idx").on(table.membershipId),
  // A volunteer can only be assigned once per heat
  uniqueIndex("heat_vol_unique_idx").on(table.heatId, table.membershipId),
]);
```

**Note:** We reference `teamMembershipTable.id` instead of a separate volunteers table. The volunteer's role (judge, equipment, etc.) is determined by their `roleId` on the membership record and `volunteerRoleType` in metadata.

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
│ │ │ ⠿ L1  Marcus Chen            L2  ✕    │ │ │ │ [Clear]             │ │
│ │ │ ⠿ L2  Priya Okonkwo          L2  ✕    │ │ │ └─────────────────────┘ │
│ │ │ ⠿ L3  Zara Lindqvist         L1  ✕    │ │ │                         │ │
│ │ │ ⠿ L4  Theo Nakamura          L1  ✕    │ │ │ L2 Certified (3)        │ │
│ │ │                                        │ │ │ ┌─────────────────────┐ │
│ │ │ [+ Assign Judge]                       │ │ │ │ ☐ ⠿ Ingrid Patel L2 │ │
│ │ └────────────────────────────────────────┘ │ │ │ ☑ ⠿ Kofi Müller  L2 │ │
│ │                                             │ │ │ ☑ ⠿ Lena Obi     L2 │ │
│ │ ┌─ Heat 2 ──────────────────── 4/4 ──────┐ │ │ └─────────────────────┘ │
│ │ │ ▼  Heat 2         9:15 AM  Main Floor  │ │ │                         │ │
│ │ │    RX Division                         │ │ │ L1 Certified (5)        │ │
│ │ ├────────────────────────────────────────┤ │ │ ┌─────────────────────┐ │
│ │ │ ⠿ L1  Olga Fernandez         L1  ✕    │ │ │ │ ☑ ⠿ Raj Novak   L1  │ │
│ │ │ ⠿ L2  Hiroshi Kim            L1  ✕    │ │ │ │ ☑ ⠿ Nia Santos  L1  │ │
│ │ │ ⠿ L3  Amara Johansson        L1  ✕    │ │ │ │ ☐ ⠿ Erik Diaz   L1  │ │
│ │ │ ⠿ L4  Viktor Osei            L1  ✕    │ │ │ │ ☐ ⠿ Yara Petrov L1  │ │
│ │ │                                        │ │ │ │ ☐ ⠿ Jin Larsson L1  │ │
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
│ ⠿ L1  Marcus Chen            L2  ✕    │
│ ⠿ L2  Priya Okonkwo          L2  ✕    │
│ ⠿ L3  Zara Lindqvist         L1  ✕    │
│ ⠿ L4  Theo Nakamura          L1  ✕    │
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
| Data source | `registrations` | `teamMembership` with `volunteerRoleType: "judge"` in metadata |
| Sidebar grouping | By division | By credential level (from membership metadata) |
| Badge display | Registration date | Credential type (L1, L2 from metadata) |
| Assignment pattern | Each athlete once per event | Same judges across multiple heats |
| Availability | N/A (each athlete once) | Check for time conflicts across events |
| Bulk actions | N/A | Copy from/to heats (primary workflow) |
| Status toggle | Heat visibility (draft/published) | Same pattern |

#### 2.2.5 Data Requirements

**Server functions needed:**
```typescript
// Get team members with judge role type for a competition
getJudgeVolunteers(competitionTeamId: string): Promise<JudgeMembership[]>

// Get judge assignments for all heats of an event
getJudgeHeatAssignments(trackWorkoutId: string): Promise<JudgeHeatAssignment[]>

// Assign judge (team member) to heat lane
assignJudgeToHeat(params: {
  heatId: string
  membershipId: string  // Team membership ID
  laneNumber: number
}): Promise<JudgeHeatAssignment>

// Bulk assign judges to heat
bulkAssignJudgesToHeat(params: {
  heatId: string
  assignments: { membershipId: string; laneNumber: number }[]
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
getJudgeConflicts(membershipId: string, heatId: string): Promise<ConflictInfo | null>

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
  // Optional: restrict shift to specific volunteer role types
  requiredRoleType: text({ length: 50 }), // "equipment", "check_in", etc. (matches volunteerRoleType)
  capacity: integer(), // How many people needed?
  location: text({ length: 100 }), // e.g. "Front Desk", "Warm-up Area"
}, (table) => [
  index("vol_shifts_comp_idx").on(table.competitionId),
]);

// competition_shift_assignments
export const competitionShiftAssignmentsTable = sqliteTable("competition_shift_assignments", {
  id: text().primaryKey().$defaultFn(() => createShiftAssignmentId()).notNull(),
  shiftId: text().notNull().references(() => competitionVolunteerShiftsTable.id, { onDelete: "cascade" }),
  // References the team membership (volunteer)
  membershipId: text().notNull().references(() => teamMembershipTable.id, { onDelete: "cascade" }),
  position: text({ length: 50 }), // Specific sub-position within the shift
  status: text({
    enum: ["assigned", "confirmed", "checked_in", "no_show"],
  }).default("assigned").notNull(),
}, (table) => [
  index("shift_assign_shift_idx").on(table.shiftId),
  index("shift_assign_member_idx").on(table.membershipId),
  // A volunteer can only be assigned once per shift
  uniqueIndex("shift_assign_unique_idx").on(table.shiftId, table.membershipId),
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
│ │ │ ⠿ Kenji Adebayo        Equipment  ✕   │ │ │ │ [Clear]             │ │
│ │ │ ⠿ Fatima Sørensen      Equipment  ✕   │ │ │ └─────────────────────┘ │
│ │ │    [Empty slot]                   +   │ │ │                         │ │
│ │ │                                        │ │ │ Equipment Crew (4)      │ │
│ │ │ [+ Assign Volunteer]                   │ │ │ ┌─────────────────────┐ │
│ │ └────────────────────────────────────────┘ │ │ │ ☐ ⠿ Dmitri Okafor   │ │
│ │                                             │ │ │ ☑ ⠿ Aisha Bergman   │ │
│ │ ┌─ Check-in ─────────────────── 4/4 ─────┐ │ │ │ ☑ ⠿ Tomás Nguyen    │ │
│ │ │ ▶  8:00 AM - 12:00 PM     Front Desk   │ │ │ │ ☐ ⠿ Freya Tanaka    │ │
│ │ │    Staff                               │ │ │ └─────────────────────┘ │
│ │ │    4 assigned • Full ✓                 │ │ │                         │ │
│ │ └────────────────────────────────────────┘ │ │ Staff (6)               │ │
│ │                                             │ │ ┌─────────────────────┐ │
│ │ ┌─ Event Transitions ────────── 3/6 ─────┐ │ │ │ ☐ ⠿ Suki Andersen   │ │
│ │ │ ▼  9:00 AM - 3:00 PM       All Areas   │ │ │ │ ☐ ⠿ Emeka Holm      │ │
│ │ │    Equipment Crew                      │ │ │ │ ☐ ⠿ Liam Oduya      │ │
│ │ ├────────────────────────────────────────┤ │ │ │ ☐ ⠿ Rosa Kimura     │ │
│ │ │ ⠿ Dmitri Okafor        Equipment  ✕   │ │ │ │ ☐ ⠿ Nils Mensah     │ │
│ │ │ ⠿ Aisha Bergman        Equipment  ✕   │ │ │ │ ☐ ⠿ Hana Eriksson   │ │
│ │ │ ⠿ Tomás Nguyen         Equipment  ✕   │ │ │ └─────────────────────┘ │
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

### Why Role Types in Metadata (Not Permissions)?

For MVP, we use role types as organizational labels, not permission gates:

1. **Simplicity** - All volunteers can do the same things (view schedule, get assigned, etc.)
2. **Flexibility** - Admins can assign anyone anywhere without permission conflicts
3. **Single gated capability** - Only score input needs access control, handled via entitlements
4. **Extensibility** - Can add fine-grained permissions later if needed

### Why Store Credentials in Metadata?

Credentials are freeform strings - just store whatever the organizer inputs:

```typescript
credentials?: string[];  // ["L2", "CPR", "First Aid"]
```

**Benefits:**
1. **Simple** - No tables, no validation, no logic
2. **Flexible** - Organizers enter whatever makes sense for their competition
3. **Display only** - Used for filtering/display in the UI, not access control

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
