# Stub Audit Report

**Generated:** 2026-01-02
**Scope:** wodsmith-start application
**Files Scanned:** 319 files across server/, server-fns/, components/, routes/, lib/, utils/, db/, schemas/, types/, config/, state/, hooks/

---

## Executive Summary

| Severity  | Count  | Description                                   |
| --------- | ------ | --------------------------------------------- |
| CRITICAL  | 2      | Blocking issues that break core functionality |
| HIGH      | 2      | Important stubs that impact key features      |
| MEDIUM    | 6      | Partial implementations or placeholders       |
| LOW       | 1      | Minor cosmetic or future-planned items        |
| **TOTAL** | **11** |                                               |

### Key Findings

- **Authentication vulnerability**: `isAuthenticated = false` hardcoded in compete route
- **Session handling stub**: `getSessionFn` returns null with TODO marker
- **6 schedule admin routes** are unimplemented redirects
- **Email notifications** not wired up for team invites

---

## CRITICAL (2)

### 1. Hardcoded Authentication Bypass

**Location:** `src/routes/compete/index.tsx:89`
**Description:** `isAuthenticated = false` is hardcoded, bypassing actual authentication checks. This likely breaks protected competition functionality.
**Recommended Action:** Wire up actual authentication check using `getSessionFromCookie()` or equivalent auth utility. Verify all downstream components handle unauthenticated state correctly.

### 2. Session Function Returns Null

**Location:** `src/server-fns/auth-fns.ts:200`
**Function:** `getSessionFn`
**Description:** Contains TODO marker and returns null, meaning session retrieval is non-functional.
**Recommended Action:** Implement proper session retrieval from cookie/header. This is foundational - many features depend on valid session data.

---

## HIGH (2)

### 1. Competition Team Invite Email Not Sent

**Location:** `src/server/registration.ts:228`
**Function:** `inviteToCompetitionTeam`
**Description:** `TODO: Send competition team invite email` - invitation logic exists but email notification is missing.
**Recommended Action:** Implement email sending using existing react-email templates. Check `src/react-email/team-invite.tsx` for template.

### 2. Missing addToCompetitionEventTeam Import

**Location:** `src/server/team-members.ts:345`
**Function:** `acceptInvitation`
**Description:** `TODO: Import addToCompetitionEventTeam` - accepting invitations may not properly add users to competition teams.
**Recommended Action:** Add the import and wire up the function call within the invitation acceptance flow.

---

## MEDIUM (6)

### 1. Missing notifyTeammateJoined Import

**Location:** `src/server/team-members.ts:369`
**Function:** `acceptInvitation`
**Description:** `TODO: Import notifyTeammateJoined` - team members not notified when someone joins.
**Recommended Action:** Import notification function and call it after successful team join.

### 2. Inline Signup Not Implemented

**Location:** `src/routes/compete/invite/-components/invite-signup-form.tsx:42`
**Description:** `TODO: Implement inline signup` - users may need to navigate away to create accounts.
**Recommended Action:** Implement inline account creation within the invitation flow.

### 3. Workout Detail TODOs

**Location:** `src/routes/compete/$slug/workouts.tsx:114-119`
**Description:** Multiple TODOs for movements, tags, and sponsor display.
**Recommended Action:** Implement workout detail sections: movement list, tags display, and sponsor information.

### 4. Missing Error Toast in Rotation Timeline

**Location:** `src/routes/compete/organizer/$competitionId/-components/judges/rotation-timeline.tsx:382`
**Description:** `TODO: Show error toast` - errors may fail silently without user feedback.
**Recommended Action:** Add toast notification using existing toast system when errors occur.

### 5. Judge Scheduling Placeholder

**Location:** `src/routes/compete/organizer/$competitionId/-components/judge-scheduling-container.tsx:33`
**Description:** Contains placeholder with note "full impl to be ported" - partial functionality only.
**Recommended Action:** Port complete judge scheduling implementation from previous version.

### 6. Scaling Migration Hardcoded Values

**Location:** `src/db/migrations/helpers/scaling-migration.ts:4-46`
**Description:** TODO marker with hardcoded placeholder values in migration helper.
**Recommended Action:** Replace hardcoded values with proper data sources or configuration.

---

## LOW (1)

### 1. Disabled Admin Reports

**Location:** `src/routes/admin/index.tsx:82,90`
**Description:** "View Reports" button disabled with "Coming soon" text - cosmetic placeholder.
**Recommended Action:** Implement reports feature or remove the button/text until ready. Low priority if reports are not in current roadmap.

---

## Recommended Priority Order

1. **CRITICAL items first** - Authentication bypass and session stub break core functionality
2. **HIGH auth-related** - Team invite emails and competition team imports (HIGH #1-2)
3. **HIGH credits stub** - May affect billing/usage features (HIGH #11)
4. **MEDIUM notifications** - notifyTeammateJoined import (MEDIUM #1)
5. **MEDIUM user-facing** - Error toasts, inline signup, workout details (MEDIUM #4-6)
6. **HIGH schedule routes** - Decide: implement or remove from navigation (HIGH #3-8)
7. **LOW/cosmetic** - Reports button, dashboard stats (LOW #1, MEDIUM #2-3)

---

## Notes

- **Components directory** had no critical stubs - well-implemented
- **6 schedule routes** are all unimplemented - consider feature flag or route removal
- **Email notifications** are a recurring gap - may need dedicated sprint
- Many stubs are TanStack Start migration artifacts that need completion
