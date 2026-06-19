# Manual Test Checklist - Stub Implementations

**Date:** 2026-01-02
**Branch:** `implement-more-stubbed-functionality`
**Epic:** Implement Stubbed Functionality from Audit Report

---

## Test Status Legend

- [ ] Not tested
- [x] Passed
- [!] Failed (add notes)
- [-] Skipped (add reason)

---

## 1. Authentication (CRITICAL)

### Test 1.1: Session retrieval for unauthenticated users
- [x] Open app in incognito window (logged out)
- [x] Navigate to `/compete`
- [x] Verify public competitions list displays
- [x] Verify "authenticated only" UI elements are hidden/disabled

### Test 1.2: Session retrieval for authenticated users
- [x] Log in with a valid account
- [x] Navigate to `/compete`
- [x] Verify authenticated UI elements appear (registration buttons, user-specific actions)

**Notes:**
```

```

---

## 2. Team Invite Email (HIGH)

### Test 2.1: Competition team invite sends email
- [ ] Log in as a competition organizer
- [ ] Go to a competition you organize
- [ ] Navigate to team management
- [ ] Create or select a team registered for an event
- [ ] Invite a new teammate by email
- [ ] Check invited email inbox for:
  - [ ] Email received with subject "Join [TeamName] for [CompetitionName]"
  - [ ] Email contains team name and division info
  - [ ] Email contains invite link
- [ ] Click invite link in email
- [ ] Verify it navigates to invite acceptance page

**Notes:**
```

```

---

## 3. Team Member Joins Flow (HIGH + MEDIUM)

### Test 3.1: Accepting invitation adds user to team
- [ ] Use invite link from Test 2.1 (or create new invite)
- [ ] Accept the invitation as the invited user
- [ ] Verify user is added to competition event team (check team roster)

### Test 3.2: Team notification on join
- [ ] After accepting invite, check team captain's notifications/email
- [ ] Verify "teammate joined" notification received

**Notes:**
```

```

---

## 4. Inline Signup on Invite Page (MEDIUM)

### Test 4.1: New user signup from invite page
- [ ] Generate an invite link for a team
- [ ] Open link in incognito window (not logged in)
- [ ] Verify signup form appears inline (not redirect to separate page)
- [ ] Fill out signup form:
  - Email: _______________
  - Password: (8+ chars, uppercase, lowercase, number)
- [ ] Submit the form
- [ ] Verify account is created
- [ ] Verify user is automatically logged in
- [ ] Verify page refreshes/redirects back to invite page
- [ ] Verify user can now accept the invite

### Test 4.2: Validation errors display properly
- [ ] Try submitting with invalid password (e.g., "short")
- [ ] Verify error message appears inline
- [ ] Try submitting with existing email
- [ ] Verify appropriate error message displays

**Notes:**
```

```

---

## 5. Workout Details Display (MEDIUM)

### Test 5.1: Workout with full details
- [ ] Navigate to a competition with published workouts: `/compete/[slug]/workouts`
- [ ] Find a workout that has movements, tags, AND sponsor
- [ ] Verify workout card displays:
  - [ ] List of movements (e.g., "21-15-9 Thrusters, Pull-ups")
  - [ ] Tags (if any assigned)
  - [ ] "Presented by [Sponsor]" with sponsor logo

### Test 5.2: Workout without optional data
- [ ] Test a workout without sponsor assigned
- [ ] Verify no sponsor section appears (no empty "Presented by")
- [ ] Test a workout without movements
- [ ] Verify graceful handling (no crash, appropriate fallback)

**Competition slug used:** _______________

**Notes:**
```

```

---

## 6. Error Toast in Rotation Timeline (MEDIUM)

### Test 6.1: Failed rotation update shows toast
- [ ] Log in as a competition organizer
- [ ] Navigate to judge scheduling for a competition with heats
- [ ] Open the rotation timeline view
- [ ] Trigger a failure (disconnect network, then try to update rotation)
- [ ] Verify toast notification appears with "Failed to update rotation"
- [ ] Verify toast appears in expected location
- [ ] Verify toast auto-dismisses after a few seconds

**Note:** This may be difficult to trigger - consider using browser DevTools to throttle/disable network.

**Notes:**
```

```

---

## 7. Judge Scheduling (MEDIUM - Cleanup Verification)

### Test 7.1: Judge scheduling functionality intact
- [ ] Log in as a competition organizer
- [ ] Navigate to a competition with events/heats
- [ ] Go to judge scheduling section
- [ ] Verify UI loads without errors
- [ ] Verify can view existing judge assignments
- [ ] Verify can create/modify judge rotations

**Notes:**
```

```

---

## 8. Scaling Migration (MEDIUM - Code Verification)

### Test 8.1: Migration helper file structure
- [ ] Verify `src/db/migrations/helpers/global-default-scaling.ts` exists
- [ ] Verify it exports `GLOBAL_DEFAULT_SCALING_GROUP_ID`
- [ ] Verify it exports deterministic level IDs:
  - [ ] `slvl_global_rx_plus`
  - [ ] `slvl_global_rx`
  - [ ] `slvl_global_scaled`
- [ ] Verify `scaling-migration.ts` imports from the new file

**No UI test needed** - this ensures migration consistency.

**Notes:**
```

```

---

## 9. Admin Reports Button Removed (LOW)

### Test 9.1: Disabled button no longer visible
- [ ] Log in as an admin user
- [ ] Navigate to `/admin`
- [ ] Verify NO disabled "View Reports" button is visible
- [ ] Verify NO "Coming soon" text related to reports
- [ ] Verify page otherwise loads correctly

**Notes:**
```

```

---

## Quick Smoke Test Summary

| Path | Status | Notes |
|------|--------|-------|
| `/compete` - loads, shows competitions | [ ] | |
| `/compete` - auth state correct | [ ] | |
| Invite flow - email sent | [ ] | |
| Invite flow - inline signup works | [ ] | |
| Invite flow - can accept invite | [ ] | |
| `/compete/[slug]/workouts` - details display | [ ] | |
| `/admin` - no reports button | [ ] | |
| Judge scheduling - loads without errors | [ ] | |

---

## Browser Console Checks

While testing, keep browser console open and verify:

- [ ] No `cloudflare:workers` resolution errors
- [ ] No uncaught exceptions
- [ ] No hydration mismatches
- [ ] Network requests completing successfully

**Console errors observed:**
```

```

---

## Overall Test Results

| Category | Passed | Failed | Skipped |
|----------|--------|--------|---------|
| Authentication | /2 | | |
| Team Invite Email | /7 | | |
| Team Member Joins | /2 | | |
| Inline Signup | /10 | | |
| Workout Details | /6 | | |
| Error Toast | /4 | | |
| Judge Scheduling | /4 | | |
| Scaling Migration | /4 | | |
| Admin Reports | /3 | | |
| **TOTAL** | /42 | | |

---

## Sign-off

- Tested by: _______________
- Date: _______________
- Overall result: [ ] PASS / [ ] FAIL
- Blocking issues:

```

```

---

## Follow-up Items

Issues discovered during testing that need separate tickets:

1.
2.
3.
