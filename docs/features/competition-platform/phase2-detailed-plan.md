# Phase 2: Competition Platform - Detailed Implementation Plan

## Executive Summary

**Scope:** Event & Series Creation (Admin) + Registration System (Public)
**Approach:** Complete feature implementation with simple registration workflow
**Timeline:** 4-5 weeks (25-30 development days)
**Strategy:** Incremental milestones + Pattern reuse + Robust validation

## User Preferences Applied

✅ **Priority:** Complete - All features from the start (polished, production-ready)
✅ **Workouts:** Defer to Phase 3 (no competition linking now)
✅ **Registration:** Simple - Just register (no status/payment/waiver complexity)
✅ **Forms:** Full page forms (not dialogs) for better UX

## Implementation Philosophy

1. **Build in Testable Increments** - Each milestone is independently deployable
2. **Maximize Pattern Reuse** - Copy existing admin patterns (programming tracks, scaling groups)
3. **Database-First Validation** - Server functions with robust error handling before UI
4. **Quality Over Speed** - Complete, polished features rather than quick prototypes

## Database Status

✅ **Phase 1 Complete** - All tables created:
- `competition_groups` - Series/groups for organizing events
- `competitions` - Individual competition events with slug, dates, settings
- `competition_registrations` - Athlete registrations with division tracking

✅ **No Migrations Needed** - Current schema supports Phase 2 requirements perfectly

---

## Implementation Roadmap

### Part 1: Competition Series/Groups Management (Week 1)

#### Milestone 1: Competition Groups Backend (Days 1-2) ✅ COMPLETE

**Goal:** Implement server functions for creating and managing competition groups/series

**Tasks:**
1. Create Zod validation schemas in `src/schemas/competitions.ts`
2. Implement `createCompetitionGroup()` - With HOST_COMPETITIONS entitlement check
3. Implement `getCompetitionGroups()` - With competition counts via SQL aggregation
4. Implement `getCompetitionGroup()` - Single group lookup
5. Implement `updateCompetitionGroup()` - With slug conflict detection
6. Implement `deleteCompetitionGroup()` - With safety checks for existing competitions

**Pattern Reference:** `src/server/programming-tracks.ts`

---

#### Milestone 2: Competition Groups Admin UI (Days 3-4) ✅ COMPLETE

**Goal:** Build admin interface for creating and managing series

**Tasks:**
1. Create server actions in `src/actions/competition-actions.ts`
2. Create series list page at `/admin/teams/[teamId]/competitions/series`
3. Create series creation page at `/admin/teams/[teamId]/competitions/series/new`
4. Build `CompetitionGroupsList` component with card grid
5. Build `CompetitionGroupForm` with auto-slug generation

**Features Implemented:**
- Full page forms with cancel navigation
- Auto-slug generation from name
- Delete confirmation with safety warnings
- Toast notifications for all actions

---

### Part 2: Competition Creation & Management (Week 2)

#### Milestone 3: Competition Creation Backend (Days 5-7)  ✅ COMPLETE

**Goal:** Implement server functions for competition CRUD

**Tasks:**
1. Add competition validation schemas to `src/schemas/competitions.ts`:
   ```typescript
   export const createCompetitionSchema = z.object({
     organizingTeamId: z.string().startsWith('team_'),
     name: z.string().min(1).max(255),
     slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(255),
     startDate: z.coerce.date(),
     endDate: z.coerce.date(),
     description: z.string().max(2000).optional(),
     registrationOpensAt: z.coerce.date().optional(),
     registrationClosesAt: z.coerce.date().optional(),
     groupId: z.string().startsWith('cgrp_').optional(),
   }).refine(data => data.startDate < data.endDate, {
     message: 'Start date must be before end date'
   })
   ```

2. Implement `createCompetition()` in `src/server/competitions.ts`:
   - Validate HOST_COMPETITIONS entitlement
   - Validate slug is globally unique (across ALL competitions)
   - Create competition_event team (type='competition_event', parentOrganizationId=organizingTeamId)
   - Add creator as owner of competition_event team
   - Insert competition record with competitionTeamId
   - Return { competitionId, competitionTeamId }

3. Implement `getCompetitions(organizingTeamId)` - List all competitions for organizing team

4. Implement `getCompetition(idOrSlug)` - Get single competition by ID or slug

5. Implement `updateCompetition()` - Update competition details

6. Implement `deleteCompetition()` - Delete competition and cascade

**Critical Implementation Details:**
- **Team Creation Pattern:** Copy from `src/server/teams.ts` `createTeam()`
- **Slug Uniqueness:** GLOBAL check across all competitions (not per-team like groups)
- **Team Type:** Set to `TEAM_TYPE_ENUM.COMPETITION_EVENT`
- **Parent Org:** Set `parentOrganizationId` to organizing team ID
- **Team Slug:** Generate as `${competitionSlug}-team` or similar

**Pattern Reference:** `src/server/teams.ts` (for team creation logic)

---

#### Milestone 4: Competition Admin UI (Days 8-11) ✅ COMPLETE

**Goal:** Build complete admin UI for competition management

**Tasks:**
1. Add competition server actions to `src/actions/competition-actions.ts`

2. Create competition list page: `/admin/teams/[teamId]/competitions/page.tsx`
   - Table/grid showing all competitions
   - Columns: name, dates, # registrations, series, status
   - "Create Competition" button navigates to `/competitions/new`
   - Row actions: view, edit, delete

3. Create competition creation page: `/admin/teams/[teamId]/competitions/new/page.tsx`
   - Full page form with all fields
   - Date pickers for start/end/registration dates
   - Series dropdown (optional, populated from getCompetitionGroups)
   - Auto-slug generation
   - Cancel and submit buttons

4. Create competition detail page: `/admin/teams/[teamId]/competitions/[competitionId]/page.tsx`
   - Overview stats: registrations, divisions, dates
   - Quick actions: Edit, Delete, View Public Page
   - Links to: Athletes, Divisions tabs

5. Create competition edit page: `/admin/teams/[teamId]/competitions/[competitionId]/edit/page.tsx`
   - Full page form pre-populated with current values
   - Same fields as creation

**UI Components Needed:**
- Date picker (shadcn calendar + popover)
- Series dropdown
- Status badge

**Pattern Reference:**
- Forms: Settings pages pattern
- List: `programming/page.tsx`

---

### Part 3: Division Management (Week 3)

#### Milestone 5: Division Setup (Days 12-14)

**Goal:** Link competitions to scaling groups for divisions

**Tasks:**
1. Define CompetitionSettings TypeScript interface:
   ```typescript
   interface CompetitionSettings {
     divisions?: {
       scalingGroupId: string
     }
   }
   ```

2. Add scaling group selector to competition create/edit forms:
   - Dropdown populated from team's scaling groups
   - Store in competition.settings as JSON

3. Create divisions view page: `/admin/teams/[teamId]/competitions/[competitionId]/divisions/page.tsx`
   - Display selected scaling group name
   - List all levels with registration counts
   - "Change Divisions" button to update settings
   - Link to scaling group editor

**Implementation Notes:**
- **NO new database tables** - Reuse scaling_groups and scaling_levels
- Store only scalingGroupId reference in settings
- At registration, athlete selects a scalingLevelId (division)

**Pattern Reference:** `src/app/(admin)/admin/teams/[teamId]/scaling/`

---

### Part 4: Registration System (Week 4)

#### Milestone 6: Registration Backend (Days 15-17)

**Goal:** Implement athlete registration system

**Tasks:**
1. Add registration schemas to `src/schemas/competitions.ts`

2. Implement `registerForCompetition()` in `src/server/competitions.ts`:
   - Validate competition exists
   - Check registration window (registrationOpensAt <= now <= closesAt)
   - Validate division belongs to competition's scaling group
   - Check for duplicate registration (unique constraint)
   - Validate user profile complete (gender, dateOfBirth)
   - Create team_membership in competition_event team (role='member', isSystemRole=1)
   - Create competition_registration record
   - Update all user sessions
   - Return { registrationId, teamMemberId }

3. Implement `getUserCompetitionRegistration()` - Check if user already registered

4. Implement `getCompetitionRegistrations()` - List all athletes for competition

5. Implement `cancelCompetitionRegistration()`:
   - Remove team_membership
   - Delete competition_registration
   - Update sessions

**Validation Rules:**
- Window: `registrationOpensAt <= now <= registrationClosesAt`
- Unique: (eventId, userId) enforced by DB
- Division: Must be in competition's scaling group
- Profile: Require gender and dateOfBirth

**Pattern Reference:** `src/server/team-members.ts` (team membership creation)

---

#### Milestone 7: Public Registration UI (Days 18-20)

**Goal:** Build public-facing competition pages and registration flow

**Tasks:**
1. Create `/compete/page.tsx` - Competition discovery
   - List all public competitions
   - Filter by date
   - Card layout

2. Create `/compete/[slug]/page.tsx` - Competition detail
   - Overview, dates, description
   - Registration button (if window open)
   - Division info
   - "Already registered" badge

3. Create `/compete/[slug]/register/page.tsx` - Registration form
   - Full page form
   - Auth check (redirect to sign-in if needed)
   - Division dropdown
   - Profile completion check
   - Submit and cancel buttons

4. Create `/compete/profile/page.tsx` - Profile completion
   - Form for gender and dateOfBirth if missing
   - Redirect back to registration after completion

**User Flow:**
```
/compete → /compete/{slug} → /compete/{slug}/register
  → Check auth → Check profile → Select division → Submit
    → /compete/my-events
```

---

#### Milestone 8: Athlete Dashboard (Days 21-22)

**Goal:** Post-registration athlete view

**Tasks:**
1. Create `/compete/my-events/page.tsx` - List user's competitions
   - Grouped: Upcoming, In Progress, Completed
   - Show: name, dates, division
   - Link to detail page

2. Enhance `/compete/[slug]/page.tsx` for registered athletes:
   - "You're registered in [Division]" badge
   - Cancel registration button

3. Create `/compete/profile/page.tsx` - Athlete profile
   - Display profile info
   - Edit button
   - List of competitions

---

### Part 5: Admin Athlete Management (Week 5)

#### Milestone 9: Competition Athletes Admin (Days 23-24)

**Goal:** Admin tools for managing athlete registrations

**Tasks:**
1. Create `/admin/teams/[teamId]/competitions/[competitionId]/athletes/page.tsx`
   - Data table with all registrations
   - Filter by division
   - Search by name/email
   - Export to CSV

2. Create `/admin/teams/[teamId]/competitions/[competitionId]/athletes/new/page.tsx`
   - Full page form
   - Search for user or enter email
   - Send invitation if user doesn't exist
   - Select division
   - Create registration

**Pattern Reference:** `src/app/(admin)/admin/_components/users/users-table.tsx`

---

### Part 6: Polish & Integration (Week 5)

#### Milestone 10: Navigation & Routes (Days 25-26)

**Goal:** Complete navigation structure

**Tasks:**
1. Update admin sidebar - Add "Competitions" section
2. Update main nav - Add "Compete" link
3. Create competition admin layout with tabs
4. Create public competition layout

---

#### Milestone 11: Testing & Documentation (Days 27-30)

**Goal:** Comprehensive testing and documentation

**Tasks:**
1. End-to-end testing (admin and athlete flows)
2. Error handling validation
3. Performance testing
4. Seed script for demo data
5. Update documentation

---

## Key Implementation Patterns

### Pattern 1: Server Functions
```typescript
export async function createCompetition(params: CreateCompetitionParams) {
  const db = getDb()

  // 1. Validate entitlements
  await requireFeature(params.organizingTeamId, FEATURES.HOST_COMPETITIONS)

  // 2. Validate slug uniqueness (GLOBAL)
  const existing = await db.query.competitionsTable.findFirst({
    where: eq(competitionsTable.slug, params.slug)
  })
  if (existing) throw new Error('Slug already taken')

  // 3. Create competition_event team
  const competitionTeam = await db.insert(teamTable).values({
    name: `${params.name} (Competition)`,
    slug: `${params.slug}-competition-team`,
    type: TEAM_TYPE_ENUM.COMPETITION_EVENT,
    parentOrganizationId: params.organizingTeamId,
  }).returning()

  // 4. Add creator as owner
  await db.insert(teamMembershipTable).values({
    teamId: competitionTeam[0].id,
    userId: session.userId,
    roleId: SYSTEM_ROLES_ENUM.OWNER,
    isSystemRole: 1,
    joinedAt: new Date(),
  })

  // 5. Create competition
  const competition = await db.insert(competitionsTable).values({
    ...params,
    competitionTeamId: competitionTeam[0].id,
  }).returning()

  return {
    competitionId: competition[0].id,
    competitionTeamId: competitionTeam[0].id
  }
}
```

### Pattern 2: Server Actions
```typescript
export const createCompetitionAction = createServerAction()
  .input(createCompetitionSchema)
  .handler(async ({ input }) => {
    await requireTeamPermission(
      input.organizingTeamId,
      TEAM_PERMISSIONS.MANAGE_PROGRAMMING
    )

    const result = await createCompetition(input)

    revalidatePath('/admin/teams/[teamSlug]/competitions')
    revalidatePath('/compete')

    return { success: true, data: result }
  })
```

### Pattern 3: Full Page Forms
```typescript
'use client'

export default function CompetitionCreatePage({ params }: Props) {
  const router = useRouter()
  const form = useForm<FormValues>({
    resolver: zodResolver(createCompetitionSchema),
    defaultValues: { organizingTeamId: params.teamId }
  })

  const { execute, isPending } = useServerAction(createCompetitionAction, {
    onSuccess: (data) => {
      toast.success('Competition created!')
      router.push(`/admin/teams/${params.teamId}/competitions/${data.competitionId}`)
    },
    onError: (error) => {
      toast.error(error.err?.message)
    }
  })

  const handleCancel = () => {
    router.push(`/admin/teams/${params.teamId}/competitions`)
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-3xl font-bold mb-6">Create Competition</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(execute)} className="space-y-6">
          {/* Form fields */}
          <div className="flex gap-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating...' : 'Create Competition'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
```

---

## Timeline Summary

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Competition Groups | ✅ Admin can create series |
| 2 | Competition Creation | Admin can create competitions |
| 3 | Division Management | Competitions have divisions |
| 4 | Registration System | Athletes can register |
| 5 | Polish & Testing | Production-ready Phase 2 |

**Total Effort:** 25-30 development days

---

## Critical Files Reference

### Files to Read Before Implementation

1. `src/db/schemas/competitions.ts` - Complete competition schema
2. `src/db/schemas/teams.ts` - Team types and structure
3. `src/db/schemas/scaling.ts` - Division system
4. `src/server/teams.ts` - Team creation pattern
5. `src/server/team-members.ts` - Team membership pattern
6. `src/actions/programming-actions.ts` - Server action pattern
7. `src/app/(settings)/settings/` - Full page form patterns

### Files Created (~30 new files)

**Backend:**
- `src/schemas/competitions.ts` ✅
- `src/actions/competition-actions.ts` ✅

**Admin UI:**
- Series list and creation pages ✅
- Competition list, create, detail, edit pages
- Athletes management pages
- Division management pages

**Public UI:**
- Competition discovery and detail pages
- Registration pages
- Athlete dashboard pages

### Files to Modify

- `src/server/competitions.ts` - Implement remaining functions
- `src/app/(admin)/admin/_components/admin-sidebar.tsx` - Add nav
- Main navigation - Add "Compete" link

---

## Success Criteria

### Functional Requirements
- [x] Admin can create competition series/groups
- [x] Admin can list and delete series
- [ ] Admin can create competitions
- [ ] Admin can assign divisions
- [ ] Athletes can browse competitions
- [ ] Athletes can register
- [ ] Registration validation enforced

### Technical Requirements
- [x] Type-safe schemas
- [x] Server functions with entitlement checks
- [x] Full page forms
- [x] Path revalidation
- [ ] All 11 server functions complete
- [ ] All UI pages complete

---

## Notes

- Phase 1 completed all database migrations
- All operations require HOST_COMPETITIONS feature
- Pattern reuse proven successful in Milestones 1-2
- Full page forms provide better mobile UX
- Competition slugs are globally unique
- Series slugs are unique per team
