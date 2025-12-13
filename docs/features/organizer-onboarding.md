# Organizer Onboarding with Approval Workflow

## Overview

Replace hidden settings toggle with proper onboarding flow at `/compete/organizer/onboard`. Users request organizer access, immediately get ability to create private competitions, then need admin approval to publish.

## Flow

```
User → /compete/organizer/onboard → Fill form → Submit
                                           ↓
                    ┌──────────────────────┴──────────────────────┐
                    ↓                                             ↓
        Grant HOST_COMPETITIONS feature              Set MAX_PUBLISHED_COMPETITIONS = 0
                    ↓                                             ↓
        Can create private competitions              Can't publish (visibility=public)
                    ↓
              Email admins → Admin reviews at /admin/organizer-requests
                                           ↓
                            Approve: Set limit = -1 (unlimited)
                                           ↓
                              Email user → Can publish
```

## Phase 1: Database Schema

### 1.1 Add limit constant
**File:** `apps/wodsmith/src/config/limits.ts`
```typescript
MAX_PUBLISHED_COMPETITIONS: "max_published_competitions",
```

### 1.2 Create organizer requests table
**File:** `apps/wodsmith/src/db/schemas/organizer-requests.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | `oreq_${createId()}` |
| teamId | text FK | to teamTable |
| userId | text FK | requester |
| reason | text | why they want to organize |
| status | enum | pending / approved / rejected |
| adminNotes | text? | admin feedback |
| reviewedBy | text? FK | admin who reviewed |
| reviewedAt | timestamp? | |
| createdAt, updatedAt | timestamps | |

### 1.3 Export in schema.ts & generate migration
```bash
pnpm db:generate add-organizer-requests
```

### 1.4 Seed the limit
Add `MAX_PUBLISHED_COMPETITIONS` to `limitTable` via seed.

---

## Phase 2: Server Logic

### 2.1 Create `server/organizer-onboarding.ts`
Functions:
- `submitOrganizerRequest({ teamId, userId, reason })` - Creates request, grants HOST_COMPETITIONS, sets limit=0
- `getOrganizerRequest(teamId)` - Get request status
- `getPendingOrganizerRequests()` - Admin list
- `approveOrganizerRequest({ requestId, adminUserId, adminNotes? })` - Set limit=-1, send email
- `rejectOrganizerRequest({ requestId, adminUserId, adminNotes? })` - Optionally revoke feature, send email

### 2.2 Add to `server/entitlements.ts`
```typescript
export async function setTeamLimitOverride(teamId: string, limitKey: string, value: number): Promise<void>
```

### 2.3 Modify `server/competitions.ts` - `updateCompetition()` (line 744)
Add check when visibility changes to public:
```typescript
if (updates.visibility === 'public' && existingCompetition.visibility !== 'public') {
  const limit = await getTeamLimit(existingCompetition.organizingTeamId, LIMITS.MAX_PUBLISHED_COMPETITIONS)
  if (limit === 0) {
    throw new Error("Your organizer application is pending approval")
  }
  // If limit > 0, count published competitions and check
}
```

---

## Phase 3: Email Templates

### 3.1 `react-email/organizer/request-submitted.tsx`
To: all users with `role === 'admin'`
Content: Team name, requester info, reason, link to `/admin/organizer-requests`

### 3.2 `react-email/organizer/request-approved.tsx`
To: requester
Content: Approval message, link to organizer dashboard

### 3.3 `react-email/organizer/request-rejected.tsx`
To: requester
Content: Rejection message, admin notes, support contact

### 3.4 Add send functions to `utils/email.tsx`

---

## Phase 4: Actions

### 4.1 `actions/organizer-onboarding-actions.ts`
- `submitOrganizerRequestAction`
- `getOrganizerRequestStatusAction`

### 4.2 `app/(admin)/admin/_actions/organizer-admin-actions.ts`
- `getPendingOrganizerRequestsAction`
- `approveOrganizerRequestAction`
- `rejectOrganizerRequestAction`

---

## Phase 5: Onboard Pages

### 5.1 `/compete/organizer/onboard/page.tsx`
- Check if already approved → redirect to `/compete/organizer`
- Check if pending → redirect to pending page
- Show form: team selector + reason textarea + submit

### 5.2 `/compete/organizer/onboard/pending/page.tsx`
- "Application Under Review" message
- Show submitted reason
- Link to `/compete/organizer` to create private competitions

### 5.3 `_components/onboard-form.tsx`
- Team selector with two modes:
  - Dropdown of user's existing teams
  - "Create new team" option → inline fields (team name, slug)
- Reason textarea
- Submit button with loading state

---

## Phase 6: Admin UI

### 6.1 `/admin/organizer-requests/page.tsx`
- Table: Team, Requester, Reason, Date, Actions
- Approve/Reject buttons with optional notes dialog

### 6.2 Add nav link to admin sidebar
**File:** Check admin navigation component

---

## Phase 7: Update Existing Components

### 7.1 Update `EnableCompetitionOrganizing` component
**File:** `apps/wodsmith/src/app/(settings)/settings/teams/[teamSlug]/_components/enable-competition-organizing.tsx`
- Not enabled → direct to `/compete/organizer/onboard`
- Pending (limit=0) → show "Pending Approval"
- Approved (limit=-1) → show enabled state

### 7.2 Update organizer layout
**File:** `apps/wodsmith/src/app/(compete)/compete/organizer/layout.tsx`
- When limit=0, show banner: "Application pending. Create private competitions while you wait."
- Update the "No Organizing Access" block to link to onboard page

### 7.3 Competition edit form
- Disable "Public" visibility option when limit=0
- Show tooltip explaining approval needed

---

## Files Summary

**New Files:**
- `db/schemas/organizer-requests.ts`
- `server/organizer-onboarding.ts`
- `actions/organizer-onboarding-actions.ts`
- `app/(admin)/admin/_actions/organizer-admin-actions.ts`
- `app/(compete)/compete/organizer/onboard/page.tsx`
- `app/(compete)/compete/organizer/onboard/pending/page.tsx`
- `app/(compete)/compete/organizer/onboard/_components/onboard-form.tsx`
- `app/(admin)/admin/organizer-requests/page.tsx`
- `react-email/organizer/request-submitted.tsx`
- `react-email/organizer/request-approved.tsx`
- `react-email/organizer/request-rejected.tsx`

**Modified Files:**
- `config/limits.ts` - add MAX_PUBLISHED_COMPETITIONS
- `db/schema.ts` - export new table
- `server/competitions.ts` - add publish limit check
- `server/entitlements.ts` - add setTeamLimitOverride helper
- `utils/email.tsx` - add email send functions
- `app/(settings)/.../enable-competition-organizing.tsx` - deprecate toggle
- `app/(compete)/compete/organizer/layout.tsx` - add pending banner

---

## Decisions

- **Email recipients**: All site admins (query users with `role === 'admin'`)
- **Team creation**: Allow inline creation in onboard form (team name + slug)
