# PRD Claims Verification Report

**Date**: 2026-01-17
**PRD Verified**: `docs/tasks/homepage-rewrite-26-01-17.md`
**Codebase**: `apps/wodsmith-start`

---

## Executive Summary

| Feature Area | Status | Summary |
|--------------|--------|---------|
| Division/Heat View | **PARTIAL** | "My Heats" exists, no auto-filter to athlete's division |
| Push Notifications | **MISSING** | Zero push infrastructure |
| Tie-Breaker Transparency | **PARTIAL** | Values shown, no explanation of calculation |
| Digital Appeals | **MISSING** | Zero implementation |
| Volunteer/Judge Scheduling | **PARTIAL** | Core scheduling works, credential verification missing |
| Score Verification | **PARTIAL** | Entry works, no photos/audit/verification state |

---

## 1. Division/Heat View for Athletes

### Status: PARTIAL

### What EXISTS
- **"My Heats" section** on schedule page filters heats where current user is assigned
  - File: `src/components/schedule-page-content.tsx` (lines 307-371)
- **Search bar** to find heats by competitor name, division, or affiliate
- **Day tabs** for multi-day event navigation
- **`userDivision`** loaded in parent route but never used for auto-filtering
  - File: `src/routes/compete/$slug.tsx` (lines 93-96)

### What's MISSING
- **No auto-personalization** to athlete's registered division
- Athletes still see all divisions' heats in the full schedule view
- Manual dropdown required on workouts/leaderboard pages
- Division selectors default to first division, not athlete's division

### Key Gap
> PRD: "Athletes can open the app and see only my division's workouts/heats—instantly."
> Reality: Athletes must manually select their division from dropdowns on each page.

---

## 2. Push Notifications

### Status: MISSING

### What EXISTS
- Heat publishing infrastructure (organizers can publish/unpublish heats)
- Email notifications only (registration, payments, teammate joins)
- `schedulePublishedAt` field in heats table

### What's MISSING
- No push library (`web-push`, `firebase-admin`, FCM)
- No service worker
- No device/subscription tables
- No scheduled job infrastructure
- No athlete notification preference UI
- No 60/30/10 minute reminder logic

### Key Gap
> PRD Goal: "> 80% of athletes enable notifications; > 95% delivery success"
> Reality: Zero push infrastructure exists. Completely unimplemented.

---

## 3. Tie-Breaker Transparency

### Status: PARTIAL

### What EXISTS
- **Tie-breaker values displayed** in leaderboard: `(TB: 8:30.123)`
  - File: `src/components/competition-leaderboard-table.tsx` (lines 121-125, 288-292)
- **Calculation logic** for countback and head-to-head methods
  - File: `src/lib/scoring/tiebreakers.ts`
- Database stores tie-breaker scheme and values

### What's MISSING
- **No explanation** of HOW tie-breaker was calculated
- No breakdown showing which events determined tie-breaker
- No countback display (e.g., "3 first places, 2 second places")
- **No audit trail** for score changes
- No "who entered, who verified, when, why" tracking

### Key Gap
> PRD: "Show tie-breaker logic and computed values ('show me the math')"
> Reality: Only final value shown, not the reasoning or method.

---

## 4. Digital Appeals

### Status: MISSING

### What EXISTS
Nothing. Zero implementation.

### What's MISSING (from PRD requirements)
- Appeals table/schema
- Appeal submission form
- Evidence attachment (photo/video)
- Status tracking (pending/approved/rejected)
- Decision with rule reference + explanation
- Organizer review dashboard
- Athlete appeal status view

### Key Gap
> PRD: "100% of appeal decisions include a recorded rationale and rule reference"
> Reality: No appeals infrastructure exists at all.

---

## 5. Volunteer/Judge Scheduling

### Status: PARTIAL

### What EXISTS
- **11 volunteer roles**: JUDGE, HEAD_JUDGE, SCOREKEEPER, EQUIPMENT, MEDICAL, CHECK_IN, STAFF, EMCEE, FLOOR_MANAGER, MEDIA, GENERAL
  - File: `src/db/schemas/volunteers.ts`
- **Availability tracking**: morning/afternoon/all_day
- **Judge rotation system** with lane shift patterns
  - File: `src/server-fns/judge-rotation-fns.ts`
- Rotation conflict detection (double-booking, buffer violations)
- Version control for judge assignments
- Role add/remove/bulk operations

### What's MISSING
- **No credential verification status** (verified/pending/rejected)
- Credentials stored as freetext only (`credentials: "L2 Judge"`)
- No credential expiry tracking
- No issuing authority tracking
- No backend enforcement by credential level
- Display-only credential badges (parsed from freetext)

### Key Gap
> PRD: "Filter by credential + availability"
> Reality: Credentials are freetext, not verified or structured.

---

## 6. Score Verification Workflow

### Status: PARTIAL (50% complete)

### What EXISTS
- **Score entry form** with Tab/Enter navigation, auto-save, visual feedback
  - File: `src/components/organizer/results/results-entry-form.tsx`
- **Validation**: Range checks, format validation, outlier detection
  - File: `src/utils/score-parser-new.ts`
- **Publish control**: Per-event + per-division publish toggle
  - File: `src/server-fns/division-results-fns.ts`
- Score statuses: `scored`, `cap`, `dq`, `withdrawn`

### What's MISSING
- **No scorecard photo upload** - cannot attach evidence
- **No "pending verification" state** - scores go straight to final status
- **No audit trail** - no `enteredBy`, `verifiedBy`, `approvedBy` fields
- **No score history** - no changelog table for edit tracking
- **No verification workflow** - no approval/rejection mechanism

### Key Gap
> PRD: "Scorecard photos attached to entries... 'Pending verification' state before leaderboard publishes"
> Reality: Scores auto-save directly without verification step or photo evidence.

---

## Recommendations

### High Priority (MVP blockers)
1. **Push Notifications**: Add web-push library, service worker, subscription management, scheduled reminders
2. **Digital Appeals**: Create schema, submission form, evidence upload, decision tracking
3. **Score Verification**: Add `pendingVerification` status, photo upload, audit fields

### Medium Priority (Trust features)
4. **Tie-Breaker Explanation**: Add modal showing calculation breakdown
5. **Audit Trail**: Add score history table with who/when/why tracking
6. **Credential Verification**: Structured credential table with verification workflow

### Low Priority (Nice-to-have)
7. **Division Auto-Filter**: Default selectors to athlete's registered division
8. **Score Entry Photos**: File upload for scorecard evidence

---

## Files Referenced

### Schemas
- `src/db/schemas/competitions.ts` - Heats, registrations, venues
- `src/db/schemas/scores.ts` - Score entry (no audit fields)
- `src/db/schemas/volunteers.ts` - Roles, availability, freetext credentials

### Components
- `src/components/schedule-page-content.tsx` - "My Heats" section
- `src/components/competition-leaderboard-table.tsx` - Tie-breaker display
- `src/components/organizer/results/results-entry-form.tsx` - Score entry

### Server Functions
- `src/server-fns/division-results-fns.ts` - Publish control
- `src/server-fns/judge-rotation-fns.ts` - Judge scheduling
- `src/server-fns/volunteer-fns.ts` - Volunteer management

### Routes
- `src/routes/compete/$slug/schedule.tsx` - Athlete schedule view
- `src/routes/compete/organizer/$competitionId/results.tsx` - Score entry page
