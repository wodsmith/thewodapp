# Team Registration Implementation Plan

## Overview
Implement team-based competition registration where divisions determine if registration is individual (teamSize=1) or team (teamSize>1). All registration data lives within the existing `competition_registrations` table structure with additional tables for teammates and affiliates.

## Core Design Principles
1. **Dynamic registration**: Division's `teamSize` drives whether form shows individual vs team fields
2. **Single registration entity**: One registration per team/individual, displayed once on leaderboard
3. **One team per athlete**: Each athlete can only be on one team per competition
4. **Normalized affiliates**: Prevent duplicate gym names, enable autocomplete
5. **Unclaimed teammates**: Support inviting teammates who haven't signed up yet

---

## Database Schema Changes

### 1. Add Team Size to Scaling Levels
**File**: `src/db/schemas/scaling.ts`

Add `teamSize` field to `scalingLevelsTable`:

```typescript
export const scalingLevelsTable = sqliteTable(
  "scaling_levels",
  {
    // ... existing fields ...
    teamSize: integer().default(1).notNull(), // 1 = individual, 2+ = team
  }
)
```

**Migration**: `pnpm db:generate add-team-size-to-scaling-levels`

### 2. Extend Competition Registrations Table
**File**: `src/db/schemas/competitions.ts`

Add team-related fields to `competitionRegistrationsTable`:

```typescript
export const competitionRegistrationsTable = sqliteTable(
  "competition_registrations",
  {
    // ... existing fields ...

    // Team info (NULL for individual registrations)
    teamName: text({ length: 255 }),
    captainUserId: text(), // References user.id - who created the registration

    // Metadata as JSON (flexible for future expansion)
    metadata: text({ length: 10000 }), // JSON: { teammates: [...], notes: "..." }
  }
)
```

**Note**: For individual registrations (teamSize=1):
- `captainUserId` = `userId` (same person)
- `teamName` = NULL
- `metadata` = NULL or minimal

For team registrations (teamSize>1):
- `captainUserId` = user who created the registration
- `teamName` = required
- `metadata` stores captain notes, etc.

### 3. Create Registration Teammates Table
**File**: `src/db/schemas/competitions.ts`

New table to track team roster:

```typescript
export const competitionRegistrationTeammatesTable = sqliteTable(
  "competition_registration_teammates",
  {
    ...commonColumns,
    id: text()
      .primaryKey()
      .$defaultFn(() => `crmt_${createId()}`)
      .notNull(),

    registrationId: text()
      .notNull()
      .references(() => competitionRegistrationsTable.id, { onDelete: "cascade" }),

    // User reference (NULL until teammate claims their spot)
    userId: text().references(() => userTable.id, { onDelete: "set null" }),

    // Teammate info (always stored, even before claim)
    email: text({ length: 255 }).notNull(),
    firstName: text({ length: 255 }),
    lastName: text({ length: 255 }),

    // Affiliate (per-teammate)
    affiliateId: text().references(() => affiliatesTable.id, { onDelete: "set null" }),

    // Invite tracking
    inviteToken: text({ length: 255 }), // NULL once accepted
    invitedAt: integer({ mode: "timestamp" }),
    acceptedAt: integer({ mode: "timestamp" }),

    // Team structure
    position: integer().notNull(), // Display order (1, 2, 3...)
    isCaptain: integer().notNull().default(0), // 1 for captain

    // Status
    status: text().notNull().default("pending"), // 'pending' | 'accepted' | 'declined'
  },
  (table) => [
    // One email per registration
    uniqueIndex("crm_teammates_reg_email_idx").on(table.registrationId, table.email),

    // One user per registration (if claimed)
    uniqueIndex("crm_teammates_reg_user_idx").on(table.registrationId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),

    // Unique invite tokens
    uniqueIndex("crm_teammates_invite_token_idx").on(table.inviteToken)
      .where(sql`${table.inviteToken} IS NOT NULL`),

    index("crm_teammates_reg_idx").on(table.registrationId),
    index("crm_teammates_user_idx").on(table.userId),
    index("crm_teammates_email_idx").on(table.email),
  ]
)
```

**Key Features**:
- Captain is BOTH in `competition_registrations.captainUserId` AND has a teammate record with `isCaptain=1`
- `userId` nullable = supports "unclaimed" teammates
- Email always required for invites
- Invite token for URL-based claiming

### 4. Create Affiliates Table
**File**: `src/db/schemas/competitions.ts` (or new `src/db/schemas/affiliates.ts`)

```typescript
export const affiliatesTable = sqliteTable(
  "affiliates",
  {
    ...commonColumns,
    id: text()
      .primaryKey()
      .$defaultFn(() => `aff_${createId()}`)
      .notNull(),

    name: text({ length: 255 }).notNull().unique(), // "CrossFit Downtown"

    // Optional metadata
    location: text({ length: 255 }), // "Austin, TX"
    verified: integer().default(0).notNull(), // 1 if officially verified
  },
  (table) => [
    index("affiliates_name_idx").on(table.name),
  ]
)
```

**Helper Function** (`src/server/affiliates.ts`):
```typescript
// Find or create affiliate by name (case-insensitive, normalized)
async function findOrCreateAffiliate(name: string): Promise<string> {
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

### 5. Update Common ID Generators
**File**: `src/db/schemas/common.ts`

```typescript
export const createCompetitionRegistrationTeammateId = () => `crmt_${createId()}`
export const createAffiliateId = () => `aff_${createId()}`
```

---

## Registration Flow

### Step 1: User Selects Division
**UI Flow**:
1. User lands on `/compete/[slug]/register`
2. Sees division selector (from competition's scaling group)
3. On division selection, fetch division details including `teamSize`
4. If `teamSize === 1`: Show individual registration form
5. If `teamSize > 1`: Show team registration form

### Step 2: Team Registration Form
**File**: `src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx`

Form fields (conditional on `teamSize > 1`):
```tsx
{teamSize > 1 && (
  <>
    <FormField name="teamName" required />
    <FormField name="affiliateName" optional />

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
)}
```

**Validation** (`src/schemas/competitions.ts`):
```typescript
const registerForCompetitionSchema = z.object({
  competitionId: z.string().startsWith("comp_"),
  divisionId: z.string().startsWith("slvl_"),

  // Team fields (validated based on division.teamSize)
  teamName: z.string().min(1).max(255).optional(),
  affiliateName: z.string().max(255).optional(),
  teammates: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    affiliateName: z.string().optional(),
  })).optional(),
}).superRefine((data, ctx) => {
  // Server will validate teamSize requirements
})
```

### Step 3: Create Registration (Server)
**File**: `src/server/competitions.ts`

Extend `registerForCompetition()`:

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

  // 3. Check user not already registered (one team per athlete rule)
  const existingReg = await db.query.competitionRegistrationsTable.findFirst({
    where: and(
      eq(competitionRegistrationsTable.eventId, params.competitionId),
      eq(competitionRegistrationsTable.userId, params.userId)
    )
  })

  if (existingReg) {
    throw new Error("You are already registered for this competition")
  }

  // 4. For team registrations, check teammates not already registered
  if (isTeam && params.teammates) {
    for (const teammate of params.teammates) {
      const teammateUser = await db.query.userTable.findFirst({
        where: eq(userTable.email, teammate.email.toLowerCase())
      })

      if (teammateUser) {
        const teammateReg = await db.query.competitionRegistrationsTable.findFirst({
          where: and(
            eq(competitionRegistrationsTable.eventId, params.competitionId),
            eq(competitionRegistrationsTable.userId, teammateUser.id)
          )
        })

        if (teammateReg) {
          throw new Error(`${teammate.email} is already registered for this competition`)
        }
      }
    }
  }

  // 5. Create team membership in competition_event team (existing pattern)
  const [teamMember] = await db.insert(teamMembershipTable)
    .values({
      teamId: competition.competitionTeamId,
      userId: params.userId,
      roleId: SYSTEM_ROLES_ENUM.MEMBER,
      isSystemRole: 1,
      joinedAt: new Date(),
      isActive: 1,
    })
    .returning()

  // 6. Create registration
  const [registration] = await db.insert(competitionRegistrationsTable)
    .values({
      eventId: params.competitionId,
      userId: params.userId,
      teamMemberId: teamMember.id,
      divisionId: params.divisionId,
      teamName: params.teamName || null,
      captainUserId: params.userId,
      registeredAt: new Date(),
    })
    .returning()

  // 7. For team registrations, create teammate records
  if (isTeam && params.teammates) {
    // Create captain's teammate record
    const captainUser = await db.query.userTable.findFirst({
      where: eq(userTable.id, params.userId)
    })

    let captainAffiliateId = null
    if (params.affiliateName) {
      captainAffiliateId = await findOrCreateAffiliate(params.affiliateName)
    }

    await db.insert(competitionRegistrationTeammatesTable).values({
      registrationId: registration.id,
      userId: params.userId,
      email: captainUser!.email,
      firstName: captainUser!.firstName,
      lastName: captainUser!.lastName,
      affiliateId: captainAffiliateId,
      position: 1,
      isCaptain: 1,
      status: 'accepted',
      acceptedAt: new Date(),
    })

    // Create teammate records (unclaimed initially)
    for (let i = 0; i < params.teammates.length; i++) {
      const teammate = params.teammates[i]
      const inviteToken = createId()

      let affiliateId = null
      if (teammate.affiliateName) {
        affiliateId = await findOrCreateAffiliate(teammate.affiliateName)
      }

      // Check if user exists
      const existingUser = await db.query.userTable.findFirst({
        where: eq(userTable.email, teammate.email.toLowerCase())
      })

      await db.insert(competitionRegistrationTeammatesTable).values({
        registrationId: registration.id,
        userId: existingUser?.id || null,
        email: teammate.email.toLowerCase(),
        firstName: teammate.firstName || null,
        lastName: teammate.lastName || null,
        affiliateId,
        inviteToken,
        invitedAt: new Date(),
        position: i + 2, // Captain is position 1
        isCaptain: 0,
        status: existingUser ? 'pending' : 'pending',
      })

      // Send invite email (commented out for now)
      // await sendCompetitionTeamInviteEmail({
      //   email: teammate.email,
      //   inviteToken,
      //   teamName: params.teamName!,
      //   competitionName: competition.name,
      //   captainName: `${captainUser.firstName} ${captainUser.lastName}`,
      //   divisionName: division.label,
      // })
    }
  }

  return {
    registrationId: registration.id,
    teamMemberId: teamMember.id,
  }
}
```

---

## Invite & Claiming Flow

### Accept Invite Page
**Route**: `/compete/[slug]/join/[inviteToken]`

**File**: `src/app/(compete)/compete/[slug]/join/[inviteToken]/page.tsx`

```typescript
export default async function JoinTeamPage({ params }) {
  const { inviteToken } = params

  // Get teammate record
  const teammate = await db.query.competitionRegistrationTeammatesTable.findFirst({
    where: eq(competitionRegistrationTeammatesTable.inviteToken, inviteToken),
    with: {
      registration: {
        with: {
          competition: true,
          division: true,
        }
      }
    }
  })

  if (!teammate) return <NotFound />
  if (teammate.status === 'accepted') return <AlreadyAccepted />

  const session = await getSessionFromCookie()

  return (
    <AcceptInviteForm
      teammate={teammate}
      isAuthenticated={!!session}
    />
  )
}
```

### Accept Invite Action
**File**: `src/server/competitions.ts`

```typescript
export async function acceptTeamInvite(params: {
  inviteToken: string
  userId: string
}) {
  const db = getDb()

  // 1. Find teammate record
  const teammate = await db.query.competitionRegistrationTeammatesTable.findFirst({
    where: eq(competitionRegistrationTeammatesTable.inviteToken, inviteToken),
    with: { registration: true }
  })

  if (!teammate) throw new Error("Invite not found")
  if (teammate.status === 'accepted') throw new Error("Invite already accepted")

  // 2. Verify email match
  const user = await db.query.userTable.findFirst({
    where: eq(userTable.id, params.userId)
  })

  if (user!.email.toLowerCase() !== teammate.email.toLowerCase()) {
    throw new Error("This invite is for a different email address")
  }

  // 3. Check user not already registered (one team rule)
  const existingReg = await db.query.competitionRegistrationsTable.findFirst({
    where: and(
      eq(competitionRegistrationsTable.eventId, teammate.registration.eventId),
      eq(competitionRegistrationsTable.userId, params.userId)
    )
  })

  if (existingReg) {
    throw new Error("You are already registered for this competition")
  }

  // 4. Update teammate record
  await db.update(competitionRegistrationTeammatesTable)
    .set({
      userId: params.userId,
      status: 'accepted',
      acceptedAt: new Date(),
      inviteToken: null, // Clear token
    })
    .where(eq(competitionRegistrationTeammatesTable.id, teammate.id))

  // 5. Add user to competition team
  await db.insert(teamMembershipTable).values({
    teamId: teammate.registration.competition.competitionTeamId,
    userId: params.userId,
    roleId: SYSTEM_ROLES_ENUM.MEMBER,
    isSystemRole: 1,
    joinedAt: new Date(),
    isActive: 1,
  })

  // 6. Update sessions
  await updateAllSessionsOfUser(params.userId)

  return {
    success: true,
    registrationId: teammate.registrationId,
  }
}
```

### Copy Invite URL
**Component**: Team management page shows invite links

```tsx
<Card>
  <CardHeader>Invite Teammates</CardHeader>
  <CardContent>
    {teammates.filter(t => t.status === 'pending').map(teammate => (
      <div key={teammate.id}>
        <p>{teammate.email} - {teammate.status}</p>
        <Button onClick={() => {
          const url = `${window.location.origin}/compete/${slug}/join/${teammate.inviteToken}`
          navigator.clipboard.writeText(url)
          toast.success("Link copied!")
        }}>
          Copy Invite Link
        </Button>
      </div>
    ))}
  </CardContent>
</Card>
```

---

## Leaderboard Display

### Query for Leaderboard
**File**: `src/server/competitions.ts`

```typescript
export async function getCompetitionLeaderboard(competitionId: string) {
  const db = getDb()

  const registrations = await db.query.competitionRegistrationsTable.findMany({
    where: eq(competitionRegistrationsTable.eventId, competitionId),
    with: {
      division: true,
      user: {
        columns: {
          firstName: true,
          lastName: true,
        }
      },
      teammates: {
        where: eq(competitionRegistrationTeammatesTable.status, 'accepted'),
        with: {
          user: {
            columns: { firstName: true, lastName: true }
          },
          affiliate: true,
        },
        orderBy: asc(competitionRegistrationTeammatesTable.position),
      }
    },
    orderBy: [
      asc(competitionRegistrationsTable.divisionId),
      asc(competitionRegistrationsTable.teamName),
    ]
  })

  return registrations.map(reg => ({
    id: reg.id,
    teamName: reg.teamName || `${reg.user.firstName} ${reg.user.lastName}`,
    division: reg.division.label,
    teammates: reg.teammates.map(t => ({
      name: `${t.firstName || t.user?.firstName} ${t.lastName || t.user?.lastName}`,
      affiliate: t.affiliate?.name,
    })),
  }))
}
```

**Display Logic**:
- Individual registrations: Show athlete name (from `user`)
- Team registrations: Show `teamName` with accepted teammates listed below
- Only show **accepted** teammates (hide pending)

---

## UI Components

### 1. Division Selector (Updated)
**File**: `src/app/(compete)/compete/[slug]/register/_components/division-selector.tsx`

```tsx
<RadioGroup onValueChange={(divisionId) => {
  const division = divisions.find(d => d.id === divisionId)
  setSelectedDivision(division)
  setTeamSize(division.teamSize)
}}>
  {divisions.map(division => (
    <div key={division.id}>
      <RadioGroupItem value={division.id} />
      <Label>
        {division.label}
        {division.teamSize > 1 && (
          <Badge>Team of {division.teamSize}</Badge>
        )}
      </Label>
    </div>
  ))}
</RadioGroup>
```

### 2. Team Registration Form
Dynamic form that shows/hides team fields based on `teamSize`:

```tsx
{teamSize > 1 ? (
  <TeamRegistrationFields
    teamSize={teamSize}
    form={form}
  />
) : (
  <IndividualRegistrationFields form={form} />
)}
```

### 3. Team Management Page
**Route**: `/compete/[slug]/teams/[registrationId]`

Shows:
- Team name and division
- Roster with status indicators:
  - ✅ Accepted (green badge)
  - ⏳ Pending (yellow badge)
- Copy invite link for pending teammates
- Ability to resend emails (future)

---

## Email Infrastructure (Commented Out for Now)

### Email Template
**File**: `src/react-email/competition-team-invite.tsx`

```tsx
export function CompetitionTeamInviteEmail({
  teamName,
  competitionName,
  captainName,
  divisionName,
  inviteUrl,
}) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Heading>Join {teamName}!</Heading>
          <Text>
            {captainName} has invited you to join <strong>{teamName}</strong> for the{" "}
            <strong>{competitionName}</strong> ({divisionName} division).
          </Text>
          <Button href={inviteUrl}>Accept Invitation</Button>
          <Text>Or copy this link: {inviteUrl}</Text>
        </Container>
      </Body>
    </Html>
  )
}
```

### Email Sending
**File**: `src/utils/email.tsx`

```typescript
export async function sendCompetitionTeamInviteEmail(params: {
  email: string
  inviteToken: string
  teamName: string
  competitionName: string
  captainName: string
  divisionName: string
}) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/compete/${competitionSlug}/join/${params.inviteToken}`

  // TODO: Uncomment when email service is configured
  // const html = await render(CompetitionTeamInviteEmail({
  //   teamName: params.teamName,
  //   competitionName: params.competitionName,
  //   captainName: params.captainName,
  //   divisionName: params.divisionName,
  //   inviteUrl,
  // }))
  //
  // await sendEmail({
  //   to: params.email,
  //   subject: `Join ${params.teamName} for ${params.competitionName}`,
  //   html,
  // })

  // For now, just log the invite URL
  console.log(`\n📧 Team invite for ${params.email}:\n${inviteUrl}\n`)
}
```

---

## Migration Strategy

### Phase 1: Database Schema (Day 1)
1. Add `teamSize` to `scalingLevelsTable` (default 1)
2. Add `teamName`, `captainUserId`, `metadata` to `competitionRegistrationsTable`
3. Create `competitionRegistrationTeammatesTable`
4. Create `affiliatesTable`
5. Run: `pnpm db:generate team-registration-schema`
6. Run: `pnpm db:migrate:dev`

### Phase 2: Server Logic (Day 1-2)
1. Create `src/server/affiliates.ts` - findOrCreateAffiliate()
2. Extend `src/server/competitions.ts` - registerForCompetition()
3. Add `src/server/competitions.ts` - acceptTeamInvite()
4. Update schemas in `src/schemas/competitions.ts`
5. Update types in `src/types/competitions.ts`

### Phase 3: Registration UI (Day 2-3)
1. Update division selector to show teamSize
2. Create team registration form component
3. Add teammate input fields (dynamic based on teamSize)
4. Add affiliate autocomplete
5. Update form validation
6. Test registration flow

### Phase 4: Invite Flow (Day 3-4)
1. Create `/compete/[slug]/join/[token]` page
2. Add accept invite action
3. Create team management page
4. Add copy invite link functionality
5. Build email template (commented out)
6. Test invite acceptance

### Phase 5: Leaderboard (Day 4)
1. Update leaderboard query to join teammates
2. Update leaderboard display component
3. Show team names and accepted teammates
4. Test display logic

### Phase 6: Polish & Edge Cases (Day 5)
1. Handle expired invites
2. Prevent duplicate registrations
3. Error messages and validation
4. Mobile responsive design
5. Loading states

---

## Testing Checklist

### Individual Registration (teamSize=1)
- [ ] Select individual division → shows individual form
- [ ] Register → creates registration with teamName=NULL
- [ ] Displays on leaderboard as individual

### Team Registration (teamSize>1)
- [ ] Select team division → shows team form
- [ ] Fill team name + teammates → creates registration
- [ ] Creates captain teammate record (status='accepted')
- [ ] Creates other teammate records (status='pending')
- [ ] Generates invite tokens

### Invite Acceptance
- [ ] Click invite link → redirects to sign in if not authenticated
- [ ] Sign in with matching email → accepts invite
- [ ] Sign in with wrong email → error
- [ ] Accept already-accepted invite → error
- [ ] User already registered → error (one team rule)

### Affiliates
- [ ] Enter "crossfit hq" → normalized to "Crossfit HQ"
- [ ] Re-enter "Crossfit HQ" → reuses existing affiliate
- [ ] Autocomplete shows existing affiliates

### Leaderboard
- [ ] Individual registrations show athlete name
- [ ] Team registrations show team name
- [ ] Only accepted teammates shown
- [ ] Pending teammates hidden from public

---

## Key Files to Modify

### Database Schema
- **src/db/schemas/scaling.ts** - Add `teamSize` field to scalingLevelsTable
- **src/db/schemas/competitions.ts** - Add `teamName`, `captainUserId`, `metadata` to competitionRegistrationsTable; create competitionRegistrationTeammatesTable and affiliatesTable
- **src/db/schemas/common.ts** - Add ID generators for teammates and affiliates
- **src/db/schema.ts** - Export new tables

### Server Logic
- **src/server/affiliates.ts** - NEW: findOrCreateAffiliate(), getAffiliates()
- **src/server/competitions.ts** - Extend registerForCompetition() to handle teams; add acceptTeamInvite(), getTeamRegistration()

### Validation & Types
- **src/schemas/competitions.ts** - Update registerForCompetitionSchema with team fields
- **src/types/competitions.ts** - Add CompetitionRegistrationTeammate, Affiliate types

### Actions
- **src/actions/competition-actions.ts** - Update registerForCompetitionAction, add acceptTeamInviteAction

### UI Components
- **src/app/(compete)/compete/[slug]/register/_components/registration-form.tsx** - Add team fields, dynamic form based on teamSize
- **src/app/(compete)/compete/[slug]/join/[inviteToken]/page.tsx** - NEW: Accept invite page
- **src/app/(compete)/compete/[slug]/teams/[registrationId]/page.tsx** - NEW: Team management page
- **src/components/compete/leaderboard.tsx** - Update to show teams and teammates

### Email (Commented Out)
- **src/react-email/competition-team-invite.tsx** - NEW: Invite email template
- **src/utils/email.tsx** - Add sendCompetitionTeamInviteEmail() (commented out send call)

---

## Success Criteria

1. ✅ Captain can register team by selecting team division
2. ✅ Dynamic form shows correct fields based on division teamSize
3. ✅ Teammates receive invite (logged, not emailed)
4. ✅ Teammates can accept invite via URL
5. ✅ One athlete per team per competition enforced
6. ✅ Leaderboard displays teams correctly
7. ✅ Affiliates normalized and autocomplete works
8. ✅ Email infrastructure ready (commented out) for future activation
