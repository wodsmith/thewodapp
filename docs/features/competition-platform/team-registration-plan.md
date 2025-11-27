# Team Registration Implementation Plan (Revised)

## Overview
Implement team-based competition registration leveraging the **existing team infrastructure** rather than creating a separate teammates table. When a captain registers a team, we create a new team of type `competition_team` and use the existing `teamInvitationTable` to invite teammates.

## Key Insight: Reuse Existing Infrastructure

**Current (implemented but to be revised):**
- `competitionRegistrationTeammatesTable` duplicates team invite logic
- Separate invite tokens, status tracking, email handling

**Revised approach:**
- New team type: `COMPETITION_TEAM` for athlete squads
- Use existing `teamInvitationTable` for invites
- Use existing `teamMembershipTable` for roster
- Registration links to the athlete team via `athleteTeamId`

**Benefits:**
1. Reuses battle-tested invite flow (`inviteUserToTeam`, `acceptTeamInvitation`)
2. Competition teams become first-class entities
3. Enables future features: team chat, multi-competition team history
4. Less code to maintain

---

## Database Schema Changes

### 1. Add Competition Team Type and Captain Role
**File**: `src/db/schemas/teams.ts`

```typescript
export const TEAM_TYPE_ENUM = {
  GYM: "gym",
  COMPETITION_EVENT: "competition_event",
  COMPETITION_TEAM: "competition_team", // NEW: Athlete squads
  PERSONAL: "personal",
} as const

// Add CAPTAIN to system roles
export const SYSTEM_ROLES_ENUM = {
  OWNER: "owner",
  ADMIN: "admin",
  CAPTAIN: "captain", // NEW: Competition team captain
  MEMBER: "member",
  GUEST: "guest",
} as const
```

**Team Hierarchy:**
```
gym (organizing team)
└── competition_event (manages competition)
    └── competition_team (athlete squad for a registration)
        ├── CAPTAIN (registered the team, can manage roster)
        └── MEMBER (teammates who accepted invite)
```

**Captain Role Permissions:**
For now, CAPTAIN has the same permissions as OWNER. This simplifies implementation and can be refined later if needed. In `src/utils/team-auth.ts`, add CAPTAIN to permission checks alongside OWNER.

### 2. Update Competition Registrations Table
**File**: `src/db/schemas/competitions.ts`

Add `athleteTeamId` to link registration to the athlete team:

```typescript
export const competitionRegistrationsTable = sqliteTable(
  "competition_registrations",
  {
    // ... existing fields ...

    // NEW: For team registrations, the athlete team
    // NULL for individual registrations (teamSize=1)
    athleteTeamId: text().references(() => teamTable.id, { onDelete: "set null" }),

    // Keep teamName for display (also stored on team.name)
    teamName: text({ length: 255 }),

    // Keep captainUserId for quick lookups
    captainUserId: text().references(() => userTable.id, { onDelete: "set null" }),

    // Pending teammates stored as JSON until they accept
    // Format: [{ email, firstName?, lastName?, affiliateName? }, ...]
    pendingTeammates: text({ length: 5000 }), // JSON array
  }
)
```

**Note**: `pendingTeammates` is a denormalized cache for UI display. Source of truth is `teamInvitationTable`.

### 3. Deprecate competitionRegistrationTeammatesTable
This table was already created via migration locally and needs **manual deprecation**.

**Action Required**:
1. Remove the table definition from `src/db/schemas/competitions.ts`
2. Remove from `src/db/schema.ts` exports
3. Generate migration: `pnpm db:generate deprecate-competition-teammates`
4. Run: `pnpm db:migrate:dev`

The migration will drop the table since it's no longer defined.

### 4. Create Affiliates Table
**File**: `src/db/schemas/competitions.ts`

```typescript
// Verification status enum for affiliates
export const affiliateVerificationStatus = [
  "unverified",
  "verified",
  "claimed",
] as const
export type AffiliateVerificationStatus =
  (typeof affiliateVerificationStatus)[number]

// Affiliates Table - Normalized gym/affiliate data
export const affiliatesTable = sqliteTable(
  "affiliates",
  {
    ...commonColumns,
    id: text()
      .primaryKey()
      .$defaultFn(() => createAffiliateId())
      .notNull(),
    name: text({ length: 255 }).notNull().unique(), // "CrossFit Downtown"
    // Optional metadata
    location: text({ length: 255 }), // "Austin, TX"
    // Verification status: unverified (default), verified (admin verified), claimed (gym owner linked)
    verificationStatus: text({ enum: affiliateVerificationStatus })
      .default("unverified")
      .notNull(),
    // When claimed, links to the team that owns this affiliate
    ownerTeamId: text().references(() => teamTable.id, { onDelete: "set null" }),
  },
  (table) => [
    index("affiliates_name_idx").on(table.name),
    index("affiliates_owner_team_idx").on(table.ownerTeamId),
  ]
)
```

**Helper Function** (`src/server/affiliates.ts`):
```typescript
// Find or create affiliate by name (case-insensitive, normalized)
export async function findOrCreateAffiliate(name: string): Promise<string> {
  const normalized = toTitleCase(name.trim()) // "crossfit hq" → "Crossfit HQ"

  const existing = await db.query.affiliatesTable.findFirst({
    where: eq(affiliatesTable.name, normalized)
  })

  if (existing) return existing.id

  const [created] = await db.insert(affiliatesTable)
    .values({ name: normalized })
    .returning()

  return created.id
}
```

---

## Registration Flow (Revised)

### Step 1: User Selects Division
**UI Flow**:
1. User lands on `/compete/[slug]/register`
2. Sees division selector (from competition's scaling group)
3. On division selection, fetch division details including `teamSize`
4. If `teamSize === 1`: Show individual registration form
5. If `teamSize > 1`: Show team registration form with teammate inputs

### Step 2: Team Registration Form
Form collects:
- Team name (required for teamSize > 1)
- Captain's affiliate (optional)
- Teammate emails + optional names/affiliates

### Step 3: Create Registration (Server)
**File**: `src/server/competitions.ts`

```typescript
export async function registerForCompetition(params: {
  competitionId: string
  userId: string // Captain
  divisionId: string
  teamName?: string
  affiliateName?: string
  teammates?: Array<{
    email: string
    firstName?: string
    lastName?: string
    affiliateName?: string
  }>
}) {
  const db = getDb()

  // 1. Get division to check teamSize
  const division = await db.query.scalingLevelsTable.findFirst({
    where: eq(scalingLevelsTable.id, params.divisionId)
  })

  if (!division) throw new Error("Division not found")
  const isTeam = division.teamSize > 1

  // 2. Validate team data
  if (isTeam) {
    if (!params.teamName) throw new Error("Team name required")
    if (!params.teammates || params.teammates.length !== division.teamSize - 1) {
      throw new Error(`Team requires ${division.teamSize - 1} teammate(s)`)
    }
  }

  // 3. Get competition
  const competition = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.id, params.competitionId)
  })

  if (!competition) throw new Error("Competition not found")

  // 4. Check user not already registered
  const existingReg = await checkExistingRegistration(params.userId, params.competitionId)
  if (existingReg) throw new Error("Already registered for this competition")

  // 5. Check teammates not already registered
  if (isTeam && params.teammates) {
    await validateTeammatesNotRegistered(params.teammates, params.competitionId)
  }

  let athleteTeamId: string | null = null

  // 6. For team registrations, create the athlete team
  if (isTeam) {
    const teamSlug = generateTeamSlug(params.teamName!, params.competitionId)

    // Create competition_team
    const [athleteTeam] = await db.insert(teamTable).values({
      name: params.teamName!,
      slug: teamSlug,
      type: TEAM_TYPE_ENUM.COMPETITION_TEAM,
      parentOrganizationId: competition.competitionTeamId, // Parent is the event team
      competitionMetadata: JSON.stringify({
        competitionId: params.competitionId,
        divisionId: params.divisionId,
      }),
    }).returning()

    athleteTeamId = athleteTeam.id

    // Add captain with CAPTAIN role
    await db.insert(teamMembershipTable).values({
      teamId: athleteTeamId,
      userId: params.userId,
      roleId: SYSTEM_ROLES_ENUM.CAPTAIN,
      isSystemRole: 1,
      joinedAt: new Date(),
      isActive: 1,
    })
  }

  // 7. Add captain to competition_event team (for competition access)
  const [teamMember] = await db.insert(teamMembershipTable).values({
    teamId: competition.competitionTeamId,
    userId: params.userId,
    roleId: SYSTEM_ROLES_ENUM.MEMBER,
    isSystemRole: 1,
    joinedAt: new Date(),
    isActive: 1,
  }).returning()

  // 8. Create registration
  const [registration] = await db.insert(competitionRegistrationsTable).values({
    eventId: params.competitionId,
    userId: params.userId,
    teamMemberId: teamMember.id,
    divisionId: params.divisionId,
    teamName: params.teamName || null,
    captainUserId: params.userId,
    athleteTeamId,
    pendingTeammates: isTeam ? JSON.stringify(params.teammates) : null,
    registeredAt: new Date(),
  }).returning()

  // 9. For team registrations, invite teammates using existing team infrastructure
  if (isTeam && params.teammates && athleteTeamId) {
    for (const teammate of params.teammates) {
      await inviteUserToTeamInternal({
        teamId: athleteTeamId,
        email: teammate.email,
        roleId: SYSTEM_ROLES_ENUM.MEMBER,
        isSystemRole: true,
        invitedBy: params.userId,
        competitionContext: {
          competitionId: params.competitionId,
          competitionSlug: competition.slug,
          teamName: params.teamName!,
          divisionName: division.label,
        },
      })
    }
  }

  // 10. Update captain's sessions
  await updateAllSessionsOfUser(params.userId)

  return {
    registrationId: registration.id,
    teamMemberId: teamMember.id,
    athleteTeamId,
  }
}
```

### Step 4: Invite Flow (Reusing Existing)
**File**: `src/server/team-members.ts`

Add a variant that handles competition team invites:

```typescript
/**
 * Internal invite function for competition teams
 * Bypasses permission checks since captain is inviting during registration
 */
export async function inviteUserToTeamInternal({
  teamId,
  email,
  roleId,
  isSystemRole = true,
  invitedBy,
  competitionContext,
}: {
  teamId: string
  email: string
  roleId: string
  isSystemRole?: boolean
  invitedBy: string
  competitionContext?: {
    competitionId: string
    competitionSlug: string
    teamName: string
    divisionName: string
  }
}) {
  const db = getDb()

  // Check if user already exists
  const existingUser = await db.query.userTable.findFirst({
    where: eq(userTable.email, email.toLowerCase())
  })

  if (existingUser) {
    // User exists - add directly to team
    await db.insert(teamMembershipTable).values({
      teamId,
      userId: existingUser.id,
      roleId,
      isSystemRole: isSystemRole ? 1 : 0,
      invitedBy,
      invitedAt: new Date(),
      joinedAt: new Date(),
      isActive: 1,
    })

    // Also add to competition_event team
    if (competitionContext) {
      await addToCompetitionEventTeam(existingUser.id, competitionContext.competitionId)
    }

    await updateAllSessionsOfUser(existingUser.id)
    return { userJoined: true, userId: existingUser.id }
  }

  // User doesn't exist - create invitation
  const token = createId()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30) // 30 days for competition invites

  await db.insert(teamInvitationTable).values({
    teamId,
    email: email.toLowerCase(),
    roleId,
    isSystemRole: isSystemRole ? 1 : 0,
    token,
    invitedBy,
    expiresAt,
  })

  // Send competition team invite email
  if (competitionContext) {
    await sendCompetitionTeamInviteEmail({
      email,
      inviteToken: token,
      ...competitionContext,
    })
  }

  return { invitationSent: true, token }
}
```

### Step 5: Accept Invite (Minimal Changes)
The existing `acceptTeamInvitation` mostly works. Add logic to:
1. Detect if team is type `competition_team`
2. If so, also add user to the parent `competition_event` team

```typescript
export async function acceptTeamInvitation(token: string) {
  // ... existing logic ...

  // After adding to team, check if it's a competition team
  const team = await db.query.teamTable.findFirst({
    where: eq(teamTable.id, invitation.teamId)
  })

  if (team?.type === TEAM_TYPE_ENUM.COMPETITION_TEAM) {
    // Get competition from team metadata
    const metadata = JSON.parse(team.competitionMetadata || '{}')
    if (metadata.competitionId) {
      await addToCompetitionEventTeam(session.userId, metadata.competitionId)

      // Clear from pendingTeammates on registration
      await clearPendingTeammate(metadata.competitionId, session.user.email)
    }
  }

  // ... rest of existing logic ...
}
```

---

## UI Components

### 1. Team Registration Form
**File**: `src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx`

Dynamic form based on division's `teamSize`:

```tsx
{teamSize > 1 ? (
  <>
    <FormField name="teamName" label="Team Name" required />
    <FormField name="affiliateName" label="Your Affiliate" optional />

    {/* Teammate slots based on division.teamSize */}
    {Array.from({ length: teamSize - 1 }).map((_, i) => (
      <Card key={i}>
        <CardHeader>Teammate {i + 1}</CardHeader>
        <CardContent>
          <FormField name={`teammates.${i}.email`} required />
          <FormField name={`teammates.${i}.firstName`} optional />
          <FormField name={`teammates.${i}.lastName`} optional />
          <FormField name={`teammates.${i}.affiliateName`} optional />
        </CardContent>
      </Card>
    ))}
  </>
) : (
  <IndividualRegistrationFields form={form} />
)}
```

### 2. Team Management Page
**Route**: `/compete/[slug]/teams/[registrationId]`

Shows roster from `teamMembershipTable` + pending from `teamInvitationTable`:

```typescript
export async function getTeamRoster(registrationId: string) {
  const registration = await db.query.competitionRegistrationsTable.findFirst({
    where: eq(competitionRegistrationsTable.id, registrationId),
  })

  if (!registration?.athleteTeamId) return { members: [], pending: [] }

  // Get confirmed members
  const members = await db.query.teamMembershipTable.findMany({
    where: eq(teamMembershipTable.teamId, registration.athleteTeamId),
    with: { user: true }
  })

  // Get pending invitations
  const pending = await db.query.teamInvitationTable.findMany({
    where: and(
      eq(teamInvitationTable.teamId, registration.athleteTeamId),
      isNull(teamInvitationTable.acceptedAt)
    )
  })

  return { members, pending }
}
```

### 3. Copy Invite Link
Uses team invitation tokens with compete-specific route:

```tsx
<Button onClick={() => {
  const url = `${window.location.origin}/compete/invite/${inviteToken}`
  navigator.clipboard.writeText(url)
  toast.success("Link copied!")
}}>
  Copy Invite Link
</Button>
```

---

## Migration Strategy

### Phase 1: Database Schema ✅ `71c1ed6`
1. **Deprecate `competitionRegistrationTeammatesTable`** (already exists locally)
   - Remove table definition from `src/db/schemas/competitions.ts`
   - Remove exports from `src/db/schema.ts`
   - Remove relations
2. **Update `src/db/schemas/teams.ts`**:
   - Add `COMPETITION_TEAM` to `TEAM_TYPE_ENUM`
   - Add `CAPTAIN` to `SYSTEM_ROLES_ENUM`
3. **Create `affiliatesTable`** in `src/db/schemas/competitions.ts`
4. **Update `competitionRegistrationsTable`**:
   - Add `athleteTeamId` column
   - Add `pendingTeammates` JSON column
5. **Add ID generator** `createAffiliateId()` to `src/db/schemas/common.ts`
6. Run: `pnpm db:generate team-registration-v2`
7. Run: `pnpm db:migrate:dev`

### Phase 2: Server Logic ✅ `96453f4`
1. Create `src/server/affiliates.ts` with `findOrCreateAffiliate()`
2. Update `registerForCompetition()` in `src/server/competitions.ts`:
   - Create `competition_team` for team registrations
   - Add captain with CAPTAIN role
   - Invite teammates via team infrastructure
3. Add `inviteUserToTeamInternal()` to `src/server/team-members.ts`
4. Extend `acceptTeamInvitation()` to handle `competition_team` type
5. Add `getTeamRoster()` helper function

### Phase 3: Registration UI ✅ `a6d2d2f`
1. Update division selector to show team size badge
2. Build dynamic team registration form (teammate inputs)
3. Add affiliate autocomplete input
4. Update form validation schema
5. Wire up to updated server action

### Phase 4: Team Management ✅ `60574b0`
1. Create `/compete/[slug]/teams/[registrationId]` page
2. Show roster from `teamMembershipTable`
3. Show pending invites from `teamInvitationTable`
4. Add copy invite link button
5. Add resend invite functionality

### Phase 5: Invite Accept Flow ✅ `38612f7`
Create dedicated `/compete/invite/[token]` route to keep all competition flows under `/compete`.

**Route**: `/compete/invite/[token]`
**File**: `src/app/(compete)/compete/invite/[token]/page.tsx`

**Authentication States to Handle:**

1. **Already logged in, email matches invite**
   - Show invite details (team name, competition, division, current roster)
   - "Accept Invitation" button
   - On accept → add to team → redirect to competition page

2. **Already logged in, email doesn't match**
   - Show error: "This invite was sent to {inviteEmail}. You're logged in as {userEmail}."
   - Offer to sign out and try again

3. **Not logged in, account exists for invite email**
   - Show invite details
   - "Sign in to accept" button → redirect to sign in with return URL
   - After sign in → return to invite page → show accept button

4. **Not logged in, no account exists**
   - Show invite details
   - "Create account to accept" button
   - Redirect to sign up with:
     - Pre-filled email (from invite)
     - Return URL back to invite page
   - After account creation → return to invite page → auto-accept or show accept button

**Implementation:**

```typescript
// Page component logic
export default async function CompeteInvitePage({ params }) {
  const { token } = params
  const session = await getSessionFromCookie()

  // Get invite details
  const invite = await getTeamInviteByToken(token)
  if (!invite) return <InviteNotFound />
  if (invite.acceptedAt) return <InviteAlreadyAccepted />
  if (invite.expiresAt < new Date()) return <InviteExpired />

  // Get competition context from team metadata
  const team = await getTeamById(invite.teamId)
  const metadata = JSON.parse(team.competitionMetadata || '{}')
  const competition = await getCompetitionById(metadata.competitionId)

  return (
    <InviteAcceptForm
      invite={invite}
      team={team}
      competition={competition}
      session={session}
    />
  )
}
```

**Sign Up/Sign In Return Flow:**
- Store invite token in URL param: `/auth/signup?returnTo=/compete/invite/{token}&email={inviteEmail}`
- After auth, redirect back to invite page
- Invite page detects logged-in user and shows accept button

### Phase 6: Filter Competition Teams from Main Site ✅ `81dfbc8`
Filter `competition_event` and `competition_team` types from the team switcher dropdown in the main site nav. These teams are only relevant in `/compete` routes.

**File**: Team switcher component (in `src/components/nav/active-team-switcher.tsx`)

```typescript
// Filter out competition-related teams from the dropdown
const selectableTeams = teams.filter(team =>
  team.type !== 'competition_event' &&
  team.type !== 'competition_team'
)
```

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Teammate storage | `teamMembershipTable` | Reuses existing team infrastructure |
| Invite tokens | `teamInvitationTable.token` | Existing 7-day expiry, email flow |
| Team type | `competition_team` | First-class entity enables future features |
| Affiliate per-teammate | Stored on user profile or registration | Simpler than junction table |

---

## Files to Modify

### Database Schema
- **src/db/schemas/teams.ts** - Add `COMPETITION_TEAM` to `TEAM_TYPE_ENUM`, add `CAPTAIN` to `SYSTEM_ROLES_ENUM`
- **src/db/schemas/competitions.ts**:
  - Remove `competitionRegistrationTeammatesTable` and relations
  - Add `affiliatesTable` with relations
  - Add `athleteTeamId`, `pendingTeammates` to `competitionRegistrationsTable`
- **src/db/schemas/common.ts** - Add `createAffiliateId()` generator
- **src/db/schema.ts** - Update exports (remove teammates, add affiliates)

### Server Logic
- **src/server/affiliates.ts** - NEW: `findOrCreateAffiliate()`, `getAffiliates()`
- **src/server/competitions.ts** - Update `registerForCompetition()`, add `getTeamRoster()`
- **src/server/team-members.ts** - Add `inviteUserToTeamInternal()`, extend `acceptTeamInvitation()`

### Utils
- **src/utils/team-auth.ts** - Add `CAPTAIN` to permission checks (same permissions as `OWNER`)

### Validation Schemas
- **src/schemas/competitions.ts** - Update registration schema with team fields

### Actions
- **src/actions/competition-actions.ts** - Update `registerForCompetitionAction`

### UI Components
- **src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx** - Team form fields
- **src/app/(compete)/compete/[slug]/register/_components/division-selector.tsx** - Team size badge
- **src/app/(compete)/compete/[slug]/teams/[registrationId]/page.tsx** - NEW: Team roster page
- **src/app/(compete)/compete/invite/[token]/page.tsx** - NEW: Competition team invite accept page
- **src/components/nav/active-team-switcher.tsx** - Filter out `competition_event` and `competition_team` types

### Email
- **src/utils/email.tsx** - Add `sendCompetitionTeamInviteEmail()`
- **src/react-email/competition-team-invite.tsx** - NEW: Email template

---

## Testing Checklist

### Team Registration
- [ ] Select team division → shows team form
- [ ] Submit creates `competition_team` in team table
- [ ] Captain added with CAPTAIN role to athlete team
- [ ] Captain added to competition_event team
- [ ] Invitations created in `teamInvitationTable`

### Teammate Auto-Join (Existing User)
- [ ] Teammate email matches existing user → added directly
- [ ] User appears in athlete team roster immediately
- [ ] User added to competition_event team

### Teammate Invite (New User)
- [ ] Invitation created with token
- [ ] Email sent (or logged)

### Invite Page Auth Flows
- [ ] Logged in, email matches → shows accept button → accepts successfully
- [ ] Logged in, email doesn't match → shows error with option to sign out
- [ ] Not logged in, account exists → shows sign in button → redirects back after sign in
- [ ] Not logged in, no account → shows create account button → pre-fills email → redirects back after signup
- [ ] After accept, user in athlete team + competition_event team
- [ ] After accept, redirects to competition page

### Edge Cases
- [ ] Teammate already registered → error
- [ ] Captain already registered → error
- [ ] Expired invite → error
- [ ] Wrong email accepts → error

---

## Success Criteria

1. Captain can register team using existing team infrastructure
2. Teammates receive invites via existing `teamInvitationTable`
3. Accepted teammates appear in `teamMembershipTable`
4. One athlete per team per competition enforced
5. Athlete teams are queryable as first-class entities
6. Existing invite UI/email infrastructure reused
