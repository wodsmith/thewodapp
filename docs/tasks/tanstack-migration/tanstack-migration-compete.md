# TanStack Start Migration - Competition Platform (Compete)

**Epic:** wodsmith-monorepo--tuyyc-mjj5sm20ou2
**Status:** In Progress (42% Complete)
**Complexity:** CRITICAL - Largest feature area in the application
**Last Updated:** December 24, 2025

## Overview

The Competition Platform is the most complex feature area in WODsmith, encompassing the entire competition lifecycle from organizer onboarding through athlete registration, scheduling, judging, scoring, and leaderboards. This represents approximately 40% of the application's total functionality.

**Key Subsystems:**

- Public competition discovery and detail pages
- Multi-step registration flow with team management
- Organizer dashboard with competition CRUD
- Complex heat scheduling with drag-and-drop
- Judge assignment and rotation scheduling
- Live scoring and results entry
- Leaderboard with real-time updates
- Volunteer management and scheduling
- Athlete portal with profile, sponsors, invoices
- Series management for multi-event competitions
- Stripe Connect integration for payments
- Revenue tracking and payout management

---

## Step 0: Test Coverage Requirements

Before migrating any competition routes, we need comprehensive test coverage to ensure functional parity between Next.js and TanStack implementations.

### Testing Trophy Philosophy

```
       /\
      /  \  E2E (5-10 critical path tests)
     /----\  Registration → Payment → Success
    / INT  \ Integration (SWEET SPOT)
   /--------\ Heat scheduling, scoring, judge rotation
  |  UNIT  | Unit (fast, focused)
  |________| Score calculations, ranking algorithms
   STATIC   TypeScript + Biome
```

**Priority:** Integration tests are the SWEET SPOT for compete features. They catch multi-component interactions, database constraints, and business logic bugs without the brittleness of E2E tests.

---

### 🎯 EXISTING TEST COVERAGE

#### Competition Leaderboard (`test/server/competition-leaderboard.test.ts` - 1513 lines)

| Area | Tests | Status | Notes |
|------|-------|--------|-------|
| `calculatePoints` | 17 | ✅ Complete | fixed_step, winner_takes_more, even_spread scoring |
| `assignRanksWithTies` | 25 | ✅ Complete | Two-way, three-way, multiple ties |
| Capped scores | 8 | ✅ Complete | secondaryValue matching, time cap handling |
| Tiebreaker values | 6 | ✅ Complete | tiebreakValue matching logic |
| Scheme-specific sorting | 12 | ✅ Complete | time/reps/load ascending/descending |
| Overall ranking tiebreakers | 8 | ✅ Complete | 1st/2nd place count tiebreakers |
| Integration scenarios | 7 | ✅ Complete | CrossFit Open-style, multi-event |
| `areScoresEqual` edge cases | 15 | ✅ Complete | null handling, status matching |

**Total:** 98 tests covering all leaderboard calculation logic

#### Sponsors (`test/server/sponsors.test.ts` - 1070 lines, 47 tests)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `getSponsor` | 2 | ✅ Complete | Get by ID, not found |
| `getCompetitionSponsors` | 2 | ✅ Complete | Grouped/ungrouped organization |
| `getCompetitionSponsorGroups` | 2 | ✅ Complete | Ordered list, empty state |
| `getUserSponsors` | 2 | ✅ Complete | Ordered list for athlete sponsors |
| `createSponsorGroup` | 4 | ✅ Complete | Auto-order, explicit order, validation |
| `updateSponsorGroup` | 4 | ✅ Complete | Name, display order, not found |
| `deleteSponsorGroup` | 3 | ✅ Complete | Delete, idempotent, validation |
| `reorderSponsorGroups` | 3 | ✅ Complete | Multiple groups, empty list |
| `createSponsor` | 6 | ✅ Complete | Competition/user sponsors, group assignment |
| `updateSponsor` | 5 | ✅ Complete | Name, group, logo URL updates |
| `deleteSponsor` | 3 | ✅ Complete | Clears workout references |
| `reorderSponsors` | 3 | ✅ Complete | Within competition, between groups |
| `assignWorkoutSponsor` | 5 | ✅ Complete | Assign, clear, validation |
| `getWorkoutSponsor` | 3 | ✅ Complete | Get sponsor, no sponsor, not found |

**Total:** 47 tests covering full sponsor lifecycle (TDD migrated Dec 24, 2025)

#### Volunteers (`test/server/volunteers.test.ts` - 918 lines)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `getVolunteerRoleTypes` | 7 | ✅ Complete | Metadata parsing, all role types |
| `isVolunteer` | 7 | ✅ Complete | Role checking, system role validation |
| `hasRoleType` | 5 | ✅ Complete | Role type matching |
| `getVolunteerAvailability` | 4 | ✅ Complete | morning/afternoon/all_day |
| `isVolunteerAvailableFor` | 8 | ✅ Complete | Availability matching |
| `filterVolunteersByAvailability` | 8 | ✅ Complete | Time slot filtering |
| `isDirectInvite` | 6 | ✅ Complete | Direct vs application detection |
| `calculateInviteStatus` | 10 | ✅ Complete | accepted/expired/pending |
| Metadata integration | 6 | ✅ Complete | Status workflow, legacy compatibility |

**Total:** 61 tests covering volunteer management

#### Judge Rotation (`test/lib/judge-rotation-utils.test.ts` - 735 lines)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `expandRotationToAssignments` | 10 | ✅ Complete | STAY, SHIFT_RIGHT patterns |
| `calculateCoverage` | 12 | ✅ Complete | Gaps, overlaps, percentage |
| `filterRotationsByAvailability` | 10 | ✅ Complete | morning/afternoon/all_day filtering |
| Varying lane counts | 3 | ✅ Complete | Per-heat lane count handling |

**Total:** 35 tests covering judge rotation logic

#### Judge Scheduling (`test/server/judge-scheduling.test.ts` - 110 lines)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `calculateRequiredJudges` | 9 | ✅ Complete | Basic, varying lanes, rotation length |

**Total:** 9 tests covering judge capacity calculations

#### Stripe Connect (`test/server/stripe-connect.test.ts` - 631 lines)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `parseOAuthState` | 8 | ✅ Complete | Base64 parsing, validation |
| `getOAuthAuthorizeUrl` | 4 | ✅ Complete | URL generation, CSRF |
| `handleOAuthCallback` | 6 | ✅ Complete | Code exchange, account status |
| `syncAccountStatus` | 4 | ✅ Complete | PENDING → VERIFIED transitions |
| Security tests | 5 | ✅ Complete | CSRF, session, permissions |

**Total:** 27 tests covering Stripe Connect onboarding

#### Scoring Library (`test/lib/scoring/` - 9 files)

| File | Tests | Status | Notes |
|------|-------|--------|-------|
| `validate.test.ts` | ~30 | ✅ Complete | Input validation, tiebreaks, time caps |
| `parse.test.ts` | ~25 | ✅ Complete | Time, reps, load parsing |
| `format.test.ts` | ~20 | ✅ Complete | Display formatting |
| `encode.test.ts` | ~15 | ✅ Complete | Sort key encoding |
| `decode.test.ts` | ~15 | ✅ Complete | Sort key decoding |
| `aggregate.test.ts` | ~10 | ✅ Complete | Multi-round aggregation |
| `sort.test.ts` | ~10 | ✅ Complete | Leaderboard sorting |
| `time-cap-tiebreak.test.ts` | ~15 | ✅ Complete | Cap/tiebreak handling |
| `multi-round.test.ts` | ~10 | ✅ Complete | Multi-round scoring |

**Total:** ~150 tests covering all scoring schemes

#### Commerce (`test/server/commerce/fee-calculation.test.ts`)

| Area | Tests | Status | Notes |
|------|-------|--------|-------|
| Fee calculation | ~20 | ✅ Complete | 4 pricing models, edge cases |

**Total:** ~20 tests covering registration pricing

#### Organizer Onboarding (`test/server/organizer-onboarding.test.ts`)

| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| Organizer onboarding flow | ~15 | ✅ Complete | Stripe Connect integration |

**Total:** ~15 tests

#### Action Tests (Partial Coverage)

| File | Tests | Status | Notes |
|------|-------|--------|-------|
| `test/actions/organizer-onboarding-actions.test.ts` | ~10 | ✅ Complete | Permission checks, validation |
| `test/actions/organizer-admin-actions.test.ts` | ~8 | ✅ Complete | Admin operations |
| `test/actions/volunteer-profile-actions.test.ts` | ~12 | ✅ Complete | Volunteer profile CRUD |

**Total:** ~30 action tests

#### E2E Tests

| File | Tests | Status | Notes |
|------|-------|--------|-------|
| `e2e/auth.spec.ts` | 8 | ✅ Complete | Auth flows (not compete-specific) |
| `e2e/workout.spec.ts` | ~5 | ✅ Complete | Workout flows (not compete-specific) |

**Total:** 0 compete-specific E2E tests

---

### ❌ MISSING TEST COVERAGE - REQUIRED FOR MIGRATION

#### E2E Tests (Critical Path) - `e2e/compete/`

| Test File | Priority | Routes Covered | Acceptance Criteria | Status |
|-----------|----------|----------------|---------------------|--------|
| `registration.spec.ts` | **P0** | `/compete/[slug]/register`, `/register/success` | Full registration flow in <30s | ❌ Missing |
| `payment-flow.spec.ts` | **P0** | Stripe checkout integration | Test mode payment completes | ❌ Missing |
| `organizer-onboard.spec.ts` | **P0** | `/compete/organizer/onboard`, Stripe Connect OAuth | Account linked, can create competitions | ❌ Missing |
| `competition-create.spec.ts` | **P0** | `/compete/organizer/new`, competition CRUD | Competition appears in public listing | ❌ Missing |
| `leaderboard-live.spec.ts` | **P1** | `/compete/[slug]/leaderboard` | Score updates reflect in <2s | ❌ Missing |

**E2E Test Requirements:**

1. **Registration Flow** (revenue path - CRITICAL)
   ```typescript
   test("athlete can register for competition", async ({ page }) => {
     // Navigate to competition detail
     await page.goto("/compete/test-throwdown");
     
     // Click register, select division
     await page.click('text="Register"');
     await page.selectOption('[name="divisionId"]', "rx-men");
     
     // Fill registration form
     await page.fill('[name="firstName"]', "John");
     await page.fill('[name="lastName"]', "Doe");
     await page.click('[name="registrationType"][value="individual"]');
     
     // Complete Stripe checkout (test mode)
     await page.click('text="Proceed to Payment"');
     await page.fill('[name="cardNumber"]', "4242424242424242");
     await page.fill('[name="expiry"]', "12/34");
     await page.fill('[name="cvc"]', "123");
     await page.click('text="Pay $50.00"');
     
     // Verify success page
     await expect(page).toHaveURL(/\/register\/success/);
     await expect(page.locator("text=Registration Complete")).toBeVisible();
     
     // Verify team invite link exists
     await expect(page.locator('[data-testid="invite-link"]')).toBeVisible();
   });
   ```

2. **Organizer Onboarding** (revenue enablement)
   ```typescript
   test("organizer can complete Stripe Connect onboarding", async ({ page }) => {
     // Sign up as organizer
     await page.goto("/compete/organizer/onboard");
     
     // Fill onboarding form
     await page.fill('[name="organizationName"]', "Test Gym");
     await page.click('text="Connect Stripe Account"');
     
     // Complete Stripe Connect OAuth (test mode)
     await expect(page).toHaveURL(/connect.stripe.com/);
     await page.fill('[name="email"]', "test@example.com");
     await page.click('text="Authorize"');
     
     // Verify redirect back to app
     await expect(page).toHaveURL(/\/compete\/organizer/);
     await expect(page.locator("text=Account Connected")).toBeVisible();
     
     // Verify can create competitions
     await page.click('text="Create Competition"');
     await expect(page).toHaveURL(/\/compete\/organizer\/new/);
   });
   ```

3. **Competition Management**
   ```typescript
   test("organizer can create and publish competition", async ({ page }) => {
     // Create competition
     await page.goto("/compete/organizer/new");
     await page.fill('[name="name"]', "Test Throwdown 2025");
     await page.fill('[name="slug"]', "test-throwdown-2025");
     await page.fill('[name="startDate"]', "2025-06-01");
     await page.fill('[name="endDate"]', "2025-06-02");
     await page.click('text="Create"');
     
     // Configure divisions
     await page.click('text="Divisions"');
     await page.click('text="Add Division"');
     await page.fill('[name="name"]', "RX Men");
     await page.click('text="Save"');
     
     // Configure pricing
     await page.click('text="Pricing"');
     await page.fill('[name="individualPrice"]', "50");
     await page.click('text="Save"');
     
     // Publish
     await page.click('text="Publish Competition"');
     
     // Verify appears in public listing
     await page.goto("/compete");
     await expect(page.locator("text=Test Throwdown 2025")).toBeVisible();
   });
   ```

#### Integration Tests - `test/integration/compete/`

| Test File | Priority | Coverage | Acceptance Criteria | Status |
|-----------|----------|----------|---------------------|--------|
| `heat-scheduling.test.ts` | **P0** | Heat CRUD, drag-and-drop reorder | Heat capacity enforced, D1 param limits respected | ❌ Missing |
| `judge-assignment.test.ts` | **P0** | Judge → heat assignment flow | Coverage gaps detected, rotation patterns work | ❌ Missing |
| `score-entry.test.ts` | **P0** | Score submission, leaderboard update | Leaderboard ranks correctly, ties resolved | ❌ Missing |
| `division-management.test.ts` | **P1** | Division CRUD, template import | Templates apply correctly, events assigned | ❌ Missing |
| `event-management.test.ts` | **P1** | Event/workout assignment | Workouts link to events, scoring schemes set | ❌ Missing |
| `volunteer-signup.test.ts` | **P1** | Public signup, approval workflow | Invites sent, status transitions work | ❌ Missing |
| `team-registration.test.ts` | **P1** | Team invite, roster management | Team members added, captain assigned | ❌ Missing |

**Integration Test Requirements:**

1. **Heat Scheduling** (15+ components, high complexity)
   ```typescript
   describe("Heat Scheduling Integration", () => {
     it("creates heats for an event with correct capacity", async () => {
       const competition = await createCompetition();
       const event = await createEvent({ competitionId: competition.id });
       const division = await createDivision({ competitionId: competition.id });
       
       const heat = await createHeat({
         eventId: event.id,
         divisionId: division.id,
         capacity: 10,
         laneCount: 5
       });
       
       expect(heat.capacity).toBe(10);
       expect(heat.laneCount).toBe(5);
     });
     
     it("prevents over-capacity athlete assignment", async () => {
       const heat = await createHeat({ capacity: 2 });
       const athletes = await createAthletes(3);
       
       await assignAthleteToHeat(heat.id, athletes[0].id);
       await assignAthleteToHeat(heat.id, athletes[1].id);
       
       await expect(
         assignAthleteToHeat(heat.id, athletes[2].id)
       ).rejects.toThrow("Heat is at capacity");
     });
     
     it("handles D1 parameter limits with autochunk", async () => {
       const heat = await createHeat();
       const athletes = await createAthletes(150); // > 100 param limit
       
       // Should use autochunk internally
       const assignments = await assignAthletesToHeat(
         heat.id,
         athletes.map(a => a.id)
       );
       
       expect(assignments).toHaveLength(150);
     });
   });
   ```

2. **Judge Rotation**
   ```typescript
   describe("Judge Assignment Integration", () => {
     it("assigns judges to heats with rotation pattern", async () => {
       const judges = await createJudges(5);
       const heats = await createHeats(10);
       
       const rotation = await createRotation({
         pattern: "SHIFT_RIGHT",
         judges: judges.map(j => j.id),
         heats: heats.map(h => h.id)
       });
       
       const assignments = await expandRotationToAssignments(rotation);
       
       expect(assignments).toHaveLength(50); // 5 judges * 10 heats
       expect(assignments[0].judgeId).toBe(judges[0].id);
       expect(assignments[1].judgeId).toBe(judges[1].id);
     });
     
     it("detects coverage gaps", async () => {
       const judges = await createJudges(3);
       const heats = await createHeats(10);
       
       const rotation = await createRotation({
         pattern: "STAY",
         judges: judges.map(j => j.id),
         heats: heats.slice(0, 5).map(h => h.id) // Only 5 heats
       });
       
       const coverage = await calculateCoverage(rotation, heats);
       
       expect(coverage.percentage).toBe(50); // 5/10 heats covered
       expect(coverage.gaps).toHaveLength(5);
     });
   });
   ```

3. **Scoring/Results**
   ```typescript
   describe("Score Entry Integration", () => {
     it("submits score and updates leaderboard", async () => {
       const competition = await createCompetition();
       const event = await createEvent({ competitionId: competition.id });
       const athlete = await createAthlete();
       
       await submitScore({
         eventId: event.id,
         athleteId: athlete.id,
         scheme: "time",
         value: "5:30",
         status: "completed"
       });
       
       const leaderboard = await getLeaderboard(event.id);
       
       expect(leaderboard[0].athleteId).toBe(athlete.id);
       expect(leaderboard[0].rank).toBe(1);
       expect(leaderboard[0].displayValue).toBe("5:30");
     });
     
     it("resolves ties with tiebreaker", async () => {
       const event = await createEvent({ scheme: "time" });
       const athletes = await createAthletes(2);
       
       await submitScore({
         eventId: event.id,
         athleteId: athletes[0].id,
         value: "5:30",
         tiebreakValue: "100" // reps
       });
       
       await submitScore({
         eventId: event.id,
         athleteId: athletes[1].id,
         value: "5:30",
         tiebreakValue: "95" // fewer reps
       });
       
       const leaderboard = await getLeaderboard(event.id);
       
       expect(leaderboard[0].athleteId).toBe(athletes[0].id); // More reps wins
       expect(leaderboard[1].athleteId).toBe(athletes[1].id);
     });
   });
   ```

#### Action Tests - `test/actions/compete/`

| Action File | Tests Needed | Priority | Acceptance Criteria | Status |
|-------------|--------------|----------|---------------------|--------|
| `competition-actions.ts` | CRUD, registration, events | P0 | All actions validate permissions, return correct types | ❌ Missing |
| `competition-division-actions.ts` | Division CRUD | P0 | Template import works, events assigned | ❌ Missing |
| `competition-heat-actions.ts` | Heat CRUD, athlete assignment | P0 | Capacity enforced, reordering works | ❌ Missing |
| `competition-score-actions.ts` | Score entry, validation | P0 | Schemes validated, leaderboard updates | ❌ Missing |
| `judge-scheduling-actions.ts` | Judge availability | P1 | Availability filters work | ❌ Missing |
| `judge-rotation-actions.ts` | Rotation patterns | P1 | STAY/SHIFT_RIGHT patterns work | ❌ Missing |
| `judge-assignment-actions.ts` | Judge-heat assignments | P1 | Assignments created, coverage calculated | ❌ Missing |
| `volunteer-actions.ts` | Volunteer CRUD, invites | P1 | Invites sent, status transitions work | ❌ Missing |
| `commerce.action.ts` | Pricing, purchases | P0 | Fee calculation correct, Stripe integration works | ❌ Missing |
| `sponsors.actions.ts` | Sponsor CRUD | P2 | ⚠️ Partial (server tests exist, action tests missing) | ⚠️ Partial |
| `stripe-connect.action.ts` | OAuth, status sync | P0 | ⚠️ Partial (server tests exist, action tests missing) | ⚠️ Partial |

**Action Test Requirements:**

```typescript
// Example: test/actions/compete/competition-actions.test.ts
describe("Competition Actions", () => {
  describe("createCompetitionAction", () => {
    it("creates competition with valid data", async () => {
      const session = await createTestSession({ teamId: "team-1" });
      const result = await createCompetitionAction({
        name: "Test Throwdown",
        slug: "test-throwdown",
        startDate: "2025-06-01",
        endDate: "2025-06-02",
        teamId: "team-1"
      }, session);
      
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Test Throwdown");
    });
    
    it("requires EDIT_TEAM_SETTINGS permission", async () => {
      const session = await createTestSession({ 
        teamId: "team-1",
        permissions: [] // No permissions
      });
      
      await expect(
        createCompetitionAction({ name: "Test" }, session)
      ).rejects.toThrow("FORBIDDEN");
    });
    
    it("validates slug uniqueness", async () => {
      await createCompetition({ slug: "test-throwdown" });
      
      await expect(
        createCompetitionAction({ slug: "test-throwdown" })
      ).rejects.toThrow("Slug already exists");
    });
  });
});
```

---

### 📊 TEST COVERAGE SUMMARY

| Category | Existing | Missing | Priority | Notes |
|----------|----------|---------|----------|-------|
| **E2E (Critical Path)** | 0 | 5 specs | P0-P1 | Registration, payment, onboarding |
| **Integration** | 0 | 7 files | P0-P1 | Heat scheduling, scoring, judge rotation |
| **Server Functions** | ~450 tests | Complete | ✅ | Leaderboard, scoring, volunteers, judges |
| **Actions** | ~30 tests | 11 files | P0-P2 | Competition CRUD, scoring, volunteers |
| **Components** | 0 | ~115 components | P1-P2 | Defer to post-migration |

**Total Existing:** ~480 tests (mostly unit/server functions)
**Total Missing:** ~200 tests (integration + actions + E2E)

---

### ✅ ACCEPTANCE CRITERIA FOR MIGRATION COMPLETE

**Before migrating any route:**

1. ✅ Existing server function tests pass (~450 tests)
2. ✅ Scoring library tests pass (~150 tests)
3. ⚠️ **BLOCKER:** Action tests must be created for the route
4. ⚠️ **BLOCKER:** Integration test for multi-component flows

**After migrating route:**

1. ✅ All existing tests still pass
2. ✅ New TanStack Start route renders correctly
3. ✅ Data fetching works with TanStack Router loaders
4. ✅ Forms submit correctly via server actions
5. ⚠️ E2E test passes for critical paths (P0 routes only)

**Migration-Blocking Tests (Must Create First):**

| Test File | Blocks Migration Of | Reason |
|-----------|---------------------|--------|
| `e2e/compete/registration.spec.ts` | Registration routes | Revenue path - CRITICAL |
| `test/integration/compete/heat-scheduling.test.ts` | Schedule page | 15+ components, high complexity |
| `test/actions/competition-actions.test.ts` | All competition pages | Core CRUD operations |
| `test/actions/competition-score-actions.test.ts` | Results/leaderboard | Scoring integrity |
| `test/integration/compete/score-entry.test.ts` | Results entry | Leaderboard calculation |

---

### 🔧 TEST INFRASTRUCTURE REQUIREMENTS

**Existing Infrastructure:**
- ✅ Vitest + jsdom for unit/integration
- ✅ Playwright for E2E
- ✅ FakeDatabase for D1 mocking (respects 100 param limit)
- ✅ Factory functions in `@repo/test-utils`
- ✅ Existing fixtures: `createSponsor`, `createSponsorGroup`

**Required New Factories:**

```typescript
// packages/test-utils/src/factories/compete.ts

export function createCompetition(overrides?: Partial<Competition>) {
  return {
    id: cuid2(),
    name: "Test Throwdown",
    slug: "test-throwdown",
    startDate: "2025-06-01",
    endDate: "2025-06-02",
    teamId: "team-1",
    status: "draft",
    ...overrides
  };
}

export function createDivision(overrides?: Partial<Division>) {
  return {
    id: cuid2(),
    name: "RX Men",
    competitionId: "comp-1",
    ...overrides
  };
}

export function createHeat(overrides?: Partial<Heat>) {
  return {
    id: cuid2(),
    eventId: "event-1",
    divisionId: "div-1",
    capacity: 10,
    laneCount: 5,
    startTime: "2025-06-01T09:00:00Z",
    ...overrides
  };
}

export function createScore(overrides?: Partial<Score>) {
  return {
    id: cuid2(),
    eventId: "event-1",
    athleteId: "athlete-1",
    scheme: "time",
    value: "5:30",
    status: "completed",
    ...overrides
  };
}

export function createVolunteerMembership(overrides?: Partial<VolunteerMembership>) {
  return {
    id: cuid2(),
    competitionId: "comp-1",
    userId: "user-1",
    roles: ["judge"],
    availability: "all_day",
    status: "accepted",
    ...overrides
  };
}

export function createAthletes(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: cuid2(),
    firstName: `Athlete${i}`,
    lastName: `Test${i}`,
    email: `athlete${i}@test.com`
  }));
}

export function createJudges(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: cuid2(),
    firstName: `Judge${i}`,
    lastName: `Test${i}`,
    availability: "all_day"
  }));
}
```

**Test Data Seeds:**

```typescript
// test/fixtures/compete-seed.ts

export async function seedCompetitionData(db: Database) {
  // Competition with 3 divisions, 5 events
  const competition = await db.insert(competitions).values({
    name: "Test Throwdown 2025",
    slug: "test-throwdown-2025",
    startDate: "2025-06-01",
    endDate: "2025-06-02",
    teamId: "team-1"
  });
  
  // Divisions
  const divisions = await db.insert(competitionDivisions).values([
    { name: "RX Men", competitionId: competition.id },
    { name: "RX Women", competitionId: competition.id },
    { name: "Scaled", competitionId: competition.id }
  ]);
  
  // Events
  const events = await db.insert(competitionEvents).values([
    { name: "Event 1", competitionId: competition.id, scheme: "time" },
    { name: "Event 2", competitionId: competition.id, scheme: "reps" },
    { name: "Event 3", competitionId: competition.id, scheme: "load" },
    { name: "Event 4", competitionId: competition.id, scheme: "time" },
    { name: "Event 5", competitionId: competition.id, scheme: "reps" }
  ]);
  
  // 50 athletes across divisions
  const athletes = await createAthletes(50);
  
  // Heat schedule with judge rotations
  const heats = await db.insert(competitionHeats).values(
    events.flatMap(event => 
      divisions.map(division => ({
        eventId: event.id,
        divisionId: division.id,
        capacity: 10,
        laneCount: 5
      }))
    )
  );
  
  // Sample scores for leaderboard testing
  await db.insert(competitionScores).values(
    athletes.slice(0, 10).map((athlete, i) => ({
      eventId: events[0].id,
      athleteId: athlete.id,
      value: `${5 + i}:30`,
      status: "completed"
    }))
  );
}
```

---

### 🎯 TEST CREATION PRIORITY ORDER

**Phase 1: Migration Blockers (Create FIRST)**

1. `test/actions/competition-actions.test.ts` - Core CRUD
2. `test/integration/compete/heat-scheduling.test.ts` - Scheduling complexity
3. `test/actions/competition-score-actions.test.ts` - Scoring integrity
4. `e2e/compete/registration.spec.ts` - Revenue path

**Phase 2: P0 Route Support**

5. `test/actions/competition-division-actions.test.ts`
6. `test/actions/competition-heat-actions.test.ts`
7. `test/integration/compete/score-entry.test.ts`
8. `e2e/compete/organizer-onboard.spec.ts`

**Phase 3: P1 Route Support**

9. `test/actions/judge-scheduling-actions.test.ts`
10. `test/actions/volunteer-actions.test.ts`
11. `test/integration/compete/division-management.test.ts`
12. `test/integration/compete/event-management.test.ts`

**Phase 4: Post-Migration Validation**

13. `e2e/compete/competition-create.spec.ts`
14. `e2e/compete/leaderboard-live.spec.ts`
15. Component tests (defer to post-migration)

---

## ⚠️ PATH CORRECTION

**IMPORTANT:** All routes are in `apps/wodsmith/src/app/(compete)/compete/`, NOT `(main)/compete/`.

## 📊 PUBLIC ROUTES (Athlete/Spectator Experience)

### Competition Discovery & Detail

| Route                  | Next.js Path                                                    | Status  | Priority | Actions                                          | Components                                                                                      | Notes                               |
| ---------------------- | --------------------------------------------------------------- | ------- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Landing Page**       | `(compete)/compete/(public)/page.tsx`                           | ✅ DONE | P0       | competition-fns.ts                               | competition-search.tsx, competition-section.tsx, competition-row.tsx                            | Competition search and listing      |
| **Competition Detail** | `(compete)/compete/(public)/[slug]/(tabs)/page.tsx`             | ✅ DONE | P0       | competition-fns.ts, competition-detail-fns.ts    | competition-hero.tsx, competition-tabs.tsx, registration-sidebar.tsx, event-details-content.tsx | Layout with hero, tabs, overview    |
| **Leaderboard Tab**    | `(compete)/compete/(public)/[slug]/(tabs)/leaderboard/page.tsx` | ✅ DONE | P0       | leaderboard-fns.ts, competition-divisions-fns.ts | leaderboard-page-content.tsx                                                                    | Leaderboard with division filtering |
| **Workouts Tab**       | `(compete)/compete/(public)/[slug]/(tabs)/workouts/page.tsx`    | ✅ DONE | P1       | competition-workouts-fns.ts                      | workout-card.tsx                                                                                | Competition workouts display        |
| **Schedule Tab**       | `(compete)/compete/(public)/[slug]/(tabs)/schedule/page.tsx`    | ✅ DONE | P1       | competition-heats-fns.ts                         | schedule-page-content.tsx                                                                       | Heat schedule with filtering        |

**Layout:** `(compete)/compete/(public)/[slug]/(tabs)/layout.tsx` - Shared layout for tabbed pages

### Registration Flow

| Route                    | Next.js Path                                                        | Status         | Priority | Actions                                    | Components                                                                  | Notes                                |
| ------------------------ | ------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------ |
| **Registration**         | `(compete)/compete/(public)/[slug]/register/page.tsx`               | ❌ Not Started | P0       | commerce.action.ts, competition-actions.ts | registration-form.tsx, affiliate-combobox.tsx                               | Multi-step registration with payment |
| **Registration Success** | `(compete)/compete/(public)/[slug]/register/success/page.tsx`       | ❌ Not Started | P0       | competition-actions.ts                     | profile-completion-form.tsx, copy-invite-link.tsx, refresh-button.tsx       | Post-registration confirmation       |
| **Team Management**      | `(compete)/compete/(public)/[slug]/teams/[registrationId]/page.tsx` | ❌ Not Started | P0       | competition-actions.ts                     | copy-invite-link-button.tsx, affiliate-editor.tsx, pending-team-invites.tsx | Team roster and invite management    |

### Athlete Portal

| Route               | Next.js Path                                                        | Status         | Priority | Actions             | Components                                                                                               | Notes                                |
| ------------------- | ------------------------------------------------------------------- | -------------- | -------- | ------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Athlete Profile** | `(compete)/compete/(public)/athlete/page.tsx`                       | ❌ Not Started | P1       | sponsors.actions.ts | athlete-header.tsx, athlete-stats.tsx, competitive-history.tsx, benchmark-stats.tsx, sponsors-social.tsx | Public athlete profile               |
| **Edit Profile**    | `(compete)/compete/(public)/athlete/edit/page.tsx`                  | ❌ Not Started | P1       | sponsors.actions.ts | athlete-profile-form.tsx                                                                                 | Profile editing                      |
| **Sponsors**        | `(compete)/compete/(public)/athlete/sponsors/page.tsx`              | ❌ Not Started | P2       | sponsors.actions.ts | athlete-sponsors-list.tsx, athlete-sponsor-form-dialog.tsx                                               | Athlete sponsor management           |
| **Invoices**        | `(compete)/compete/(public)/athlete/invoices/page.tsx`              | ❌ Not Started | P2       | commerce.action.ts  | (list view)                                                                                              | Invoice history                      |
| **Invoice Detail**  | `(compete)/compete/(public)/athlete/invoices/[purchaseId]/page.tsx` | ❌ Not Started | P2       | commerce.action.ts  | invoice-pdf.tsx, download-invoice-button.tsx                                                             | Individual invoice with PDF download |

### Volunteer & Schedule

| Route                | Next.js Path                                             | Status         | Priority | Actions                                           | Components                                                                                                     | Notes                               |
| -------------------- | -------------------------------------------------------- | -------------- | -------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Volunteer Signup** | `(compete)/compete/(public)/[slug]/volunteer/page.tsx`   | ❌ Not Started | P1       | volunteer-actions.ts                              | volunteer-signup-form.tsx                                                                                      | Public volunteer registration       |
| **My Schedule**      | `(compete)/compete/(public)/[slug]/my-schedule/page.tsx` | ❌ Not Started | P1       | judge-scheduling-actions.ts, volunteer-actions.ts | schedule-view.tsx, event-section.tsx, rotation-card.tsx, volunteer-profile-card.tsx, edit-volunteer-dialog.tsx | Athlete/volunteer personal schedule |

**Layout:** `(compete)/compete/(public)/[slug]/my-schedule/layout.tsx` - Schedule page layout

### Invites

| Route                 | Next.js Path                                         | Status         | Priority | Actions                                      | Components                                                                         | Notes                                |
| --------------------- | ---------------------------------------------------- | -------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ |
| **Invite Acceptance** | `(compete)/compete/(public)/invite/[token]/page.tsx` | ❌ Not Started | P0       | competition-actions.ts, volunteer-actions.ts | accept-invite-button.tsx, invite-signup-form.tsx, accept-volunteer-invite-form.tsx | Team/volunteer invite token handling |

**Layout:** `(compete)/compete/(public)/layout.tsx` - Public compete layout

---

## 🏢 ORGANIZER ROUTES (Competition Management)

### Organizer Dashboard

| Route                  | Next.js Path                                                                   | Status         | Priority | Actions                  | Components                             | Notes                           |
| ---------------------- | ------------------------------------------------------------------------------ | -------------- | -------- | ------------------------ | -------------------------------------- | ------------------------------- |
| **Competition List**   | `(compete)/compete/organizer/(dashboard)/page.tsx`                             | ✅ DONE        | P0       | competition-fns.ts       | competitions-list.tsx, team-filter.tsx | Main organizer dashboard        |
| **Create Competition** | `(compete)/compete/organizer/(dashboard)/new/page.tsx`                         | ✅ DONE        | P0       | competition-fns.ts       | competition-form.tsx                   | Competition creation            |
| **Onboard Organizer**  | `(compete)/compete/organizer/(dashboard)/onboard/page.tsx`                     | ❌ Not Started | P0       | stripe-connect.action.ts | onboard-form.tsx                       | Stripe Connect onboarding       |
| **Onboard Pending**    | `(compete)/compete/organizer/(dashboard)/onboard/pending/page.tsx`             | ❌ Not Started | P0       | stripe-connect.action.ts | (pending state)                        | Onboarding in progress          |
| **Payout Settings**    | `(compete)/compete/organizer/(dashboard)/settings/payouts/[teamSlug]/page.tsx` | ❌ Not Started | P2       | stripe-connect.action.ts | (payout config)                        | Team-level payout configuration |

**Layout:** `(compete)/compete/organizer/(dashboard)/layout.tsx` - Dashboard layout
**Loading:** `(compete)/compete/organizer/(dashboard)/loading.tsx` - Dashboard loading state

### Series Management

| Route             | Next.js Path                                                             | Status  | Priority | Actions            | Components               | Notes                        |
| ----------------- | ------------------------------------------------------------------------ | ------- | -------- | ------------------ | ------------------------ | ---------------------------- |
| **Series List**   | `(compete)/compete/organizer/(dashboard)/series/page.tsx`                | ✅ DONE | P2       | competition-fns.ts | series-list.tsx          | Multi-competition series     |
| **Create Series** | `(compete)/compete/organizer/(dashboard)/series/new/page.tsx`            | ✅ DONE | P2       | competition-fns.ts | series-form.tsx          | Series creation              |
| **Series Detail** | `(compete)/compete/organizer/(dashboard)/series/[groupId]/page.tsx`      | ✅ DONE | P2       | competition-fns.ts | series-detail components | Individual series management |
| **Edit Series**   | `(compete)/compete/organizer/(dashboard)/series/[groupId]/edit/page.tsx` | ✅ DONE | P2       | competition-fns.ts | series-form.tsx          | Series editing               |

**Loading States:**

- `(compete)/compete/organizer/(dashboard)/series/loading.tsx`
- `(compete)/compete/organizer/(dashboard)/series/[groupId]/loading.tsx`

### Competition Management (with-sidebar)

| Route                    | Next.js Path                                                                    | Status                   | Priority | Actions                         | Components                                                                                            | Notes                          |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------ | -------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Competition Overview** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/page.tsx`           | 🟡 Partially Implemented | P0       | competition-actions.ts          | competition-sidebar.tsx, competition-header.tsx, organizer-breadcrumb.tsx                             | Layout + overview page done    |
| **Edit Competition**     | `(compete)/compete/organizer/[competitionId]/edit/page.tsx`                     | ❌ Not Started           | P0       | competition-actions.ts          | organizer-competition-edit-form.tsx                                                                   | Competition details editing    |
| **Athletes**             | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/athletes/page.tsx`  | ❌ Not Started           | P0       | competition-actions.ts          | organizer-registration-list.tsx                                                                       | Registration management        |
| **Divisions**            | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/divisions/page.tsx` | ❌ Not Started           | P0       | competition-division-actions.ts | organizer-division-manager.tsx, organizer-division-item.tsx, organizer-template-selector.tsx          | Division configuration         |
| **Events**               | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/events/page.tsx`    | ❌ Not Started           | P0       | competition-actions.ts          | organizer-event-manager.tsx, competition-event-row.tsx, create-event-dialog.tsx, add-event-dialog.tsx | Event/workout management       |
| **Event Detail**         | `(compete)/compete/organizer/[competitionId]/events/[eventId]/page.tsx`         | ❌ Not Started           | P0       | competition-actions.ts          | event-details-form.tsx                                                                                | Individual event configuration |

**Shared Components:**

- `competition-sidebar.tsx` - Sidebar navigation ✅ Ported to TanStack Start
- `competition-header.tsx` - Page header with badges ✅ Ported to TanStack Start
- `organizer-breadcrumb.tsx` - Breadcrumb navigation ✅ Ported to TanStack Start
- `organizer-competition-actions.tsx` - Action menu

### Scheduling & Heats

| Route                | Next.js Path                                                                   | Status         | Priority | Actions                                                                                                          | Components                                              | Notes                                                    |
| -------------------- | ------------------------------------------------------------------------------ | -------------- | -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| **Schedule Manager** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/schedule/page.tsx` | ❌ Not Started | P0       | competition-heat-actions.ts, judge-scheduling-actions.ts, judge-rotation-actions.ts, judge-assignment-actions.ts | **Complex drag-and-drop system** - See components below | Heat scheduling with venue management and judge rotation |

**Schedule Components (High Complexity):**

- `schedule-page-client.tsx` - Main client container
- `schedule-container.tsx` - Schedule orchestrator
- `heat-schedule-manager.tsx` - Heat management
- `heat-schedule-container.tsx` - Heat container
- `heat-card.tsx` - Individual heat
- `draggable-athlete.tsx` - Athlete drag-and-drop
- `draggable-division.tsx` - Division drag-and-drop
- `venue-manager.tsx` - Venue/lane assignment
- `venue-manager-container.tsx` - Venue container
- `venue-manager-skeleton.tsx` - Loading state
- `heat-schedule-skeleton.tsx` - Loading state
- `event-overview.tsx` - Event summary
- `workout-preview.tsx` - Workout details

### Scoring & Results

| Route             | Next.js Path                                                                  | Status         | Priority | Actions                      | Components                                                        | Notes                  |
| ----------------- | ----------------------------------------------------------------------------- | -------------- | -------- | ---------------------------- | ----------------------------------------------------------------- | ---------------------- |
| **Results Entry** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/results/page.tsx` | ❌ Not Started | P0       | competition-score-actions.ts | results-entry-form.tsx, heat-score-group.tsx, score-input-row.tsx | Live scoring interface |

### Volunteers & Judges

| Route          | Next.js Path                                                                     | Status         | Priority | Actions              | Components                                                                                                             | Notes                |
| -------------- | -------------------------------------------------------------------------------- | -------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Volunteers** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/volunteers/page.tsx` | ❌ Not Started | P1       | volunteer-actions.ts | volunteers-list.tsx, invited-volunteers-list.tsx, volunteer-row.tsx, invite-volunteer-dialog.tsx, volunteer-status.tsx | Volunteer management |

**Layout:** `(compete)/compete/organizer/[competitionId]/(with-sidebar)/volunteers/layout.tsx`

**Judge Components (NO PAGE ROUTE):**
Located at `volunteers/judges/_components/` - 11 judge scheduling components exist but no dedicated judge page route. Judges are managed within the schedule page and volunteer management.

**Judge Actions (used in schedule):**

- `judge-scheduling-actions.ts` - Judge availability
- `judge-rotation-actions.ts` - Judge rotation patterns
- `judge-assignment-actions.ts` - Judge-heat assignments

### Financial & Settings

| Route           | Next.js Path                                                                      | Status                | Priority | Actions                        | Components                                                                               | Notes                                                     |
| --------------- | --------------------------------------------------------------------------------- | --------------------- | -------- | ------------------------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **Pricing**     | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/pricing/page.tsx`     | ❌ Not Started        | P0       | commerce.action.ts             | pricing-settings-form.tsx, stripe-connection-required.tsx, stripe-connection-manager.tsx | Registration pricing                                      |
| **Revenue**     | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/revenue/page.tsx`     | ❌ Not Started        | P1       | commerce.action.ts             | revenue-stats-display.tsx                                                                | Revenue tracking                                          |
| **Settings**    | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/settings/page.tsx`    | ❌ Not Started        | P1       | competition-settings.action.ts | rotation-settings-form.tsx                                                               | Competition configuration                                 |
| **Sponsors**    | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/sponsors/page.tsx`    | ✅ DONE               | P2       | sponsor-fns.ts                 | sponsor-manager.tsx, sponsor-card.tsx, sponsor-form-dialog.tsx, sponsor-group-card.tsx, sponsor-group-form-dialog.tsx, ungrouped-sponsors.tsx | Competition sponsor management - 47 tests, TDD migrated Dec 24 |
| ~~**Waivers**~~ | ~~`waivers/page.tsx`~~                                                            | ⛔ **DOES NOT EXIST** | ~~P2~~   | ~~waivers.ts~~                 | N/A                                                                                      | **AUDIT FINDING: No waivers route or action file exists** |
| **Danger Zone** | `(compete)/compete/organizer/[competitionId]/(with-sidebar)/danger-zone/page.tsx` | ❌ Not Started        | P2       | competition-actions.ts         | delete-competition-form.tsx                                                              | Competition deletion                                      |

**Layouts:**

- `(compete)/compete/organizer/layout.tsx` - Organizer section layout
- `(compete)/compete/organizer/[competitionId]/layout.tsx` - Competition layout

**Loading:** `(compete)/compete/organizer/[competitionId]/loading.tsx`

**Root Layout:** ⛔ **DOES NOT EXIST** - No `(compete)/compete/layout.tsx` file

---

## 📦 SHARED COMPONENTS

### Located in `src/components/compete/`

| Component                           | Purpose                        | Used By           |
| ----------------------------------- | ------------------------------ | ----------------- |
| `competition-leaderboard-table.tsx` | Leaderboard table with sorting | Leaderboard pages |
| `pending-team-invites.tsx`          | Team invite management         | Team management   |
| `stripe-connection-manager.tsx`     | Stripe Connect UI              | Pricing, revenue  |
| `volunteer-status.tsx`              | Volunteer status badge         | Volunteer lists   |

### Located in `src/components/landing/`

| Component               | Purpose           | Notes          |
| ----------------------- | ----------------- | -------------- |
| `features.tsx`          | Feature showcase  | Marketing page |
| `hero.tsx`              | Hero section      | Marketing page |
| `insights-features.tsx` | Insights features | Marketing page |
| `mission-hero.tsx`      | Mission statement | Marketing page |
| `pricing.tsx`           | Pricing cards     | Marketing page |
| `product-cards.tsx`     | Product features  | Marketing page |
| `social-proof.tsx`      | Testimonials      | Marketing page |

---

## 🔧 SERVER ACTIONS

### Competition Management (5 files)

- ✅ **competition-actions.ts** - CRUD operations, registration, events
- ✅ **competition-division-actions.ts** - Division management
- ✅ **competition-heat-actions.ts** - Heat scheduling
- ✅ **competition-score-actions.ts** - Score entry and leaderboard
- ✅ **competition-settings.action.ts** - Competition configuration

### Judging & Volunteers (4 files)

- ✅ **judge-scheduling-actions.ts** - Judge availability
- ✅ **judge-rotation-actions.ts** - Judge rotation patterns
- ✅ **judge-assignment-actions.ts** - Judge-heat assignments
- ✅ **volunteer-actions.ts** - Volunteer management

### Financial & Sponsors (3 files)

- ✅ **commerce.action.ts** - Registration purchases, pricing
- ✅ **stripe-connect.action.ts** - Stripe Connect onboarding
- ✅ **sponsors.actions.ts** - Sponsor management (athlete + competition)

### Legal & Compliance

- ⛔ **waivers.ts** - **DOES NOT EXIST** (mentioned in doc but not in codebase)

**AUDIT RESULT:** 11 of 12 claimed action files exist. Waivers functionality may be handled elsewhere or is not yet implemented.

---

## 🎯 MIGRATION PRIORITIES

### P0 - Core Competition Flow (Must Have)

1. Public competition discovery and detail pages
2. Registration flow (register → success → team management)
3. Leaderboard display
4. Organizer dashboard (list, create, edit)
5. Athletes management
6. Divisions configuration
7. Events/workouts management
8. Heat scheduling (COMPLEX - drag-and-drop)
9. Results entry/scoring
10. Pricing configuration

### P1 - Enhanced Features (Should Have)

1. Workouts tab
2. Schedule tab
3. Athlete portal (profile, edit)
4. Volunteer signup and management
5. My Schedule (athlete/volunteer)
6. Revenue tracking
7. Competition settings

### P2 - Extended Features (Nice to Have)

1. Series management
2. Athlete sponsors
3. Invoices and PDF downloads
4. Competition sponsors
5. Payout settings
6. Danger zone (deletion)

---

## ⚠️ CRITICAL COMPLEXITY AREAS

### 1. Heat Scheduling System

**Location:** `organizer/[competitionId]/(with-sidebar)/schedule/page.tsx`

**Complexity Drivers:**

- Drag-and-drop athletes between heats
- Drag-and-drop divisions to create heats
- Venue/lane assignment
- Judge rotation scheduling
- Multi-event coordination
- Real-time updates

**Components:** 15+ specialized components
**Actions:** 4 separate action files (heats, judge scheduling, rotation, assignment)

**Migration Strategy:**

- May need to rebuild drag-and-drop with TanStack Router-compatible library
- Consider splitting into smaller sub-pages
- Ensure state management works with TanStack Router

### 2. Registration Flow

**Location:** `compete/(public)/[slug]/register/`

**Complexity Drivers:**

- Multi-step form with validation
- Stripe payment integration
- Team vs individual registration
- Division selection
- Affiliate tracking
- Post-registration profile completion

**Migration Strategy:**

- Preserve form state across navigation
- Ensure Stripe integration works with new routing
- Test team invite flow thoroughly

### 3. Real-time Leaderboard

**Location:** `compete/(public)/[slug]/(tabs)/leaderboard/`

**Complexity Drivers:**

- Live score updates
- Division filtering
- Sorting and ranking calculations
- Performance with large datasets

**Migration Strategy:**

- Ensure data fetching works with TanStack Router loaders
- Consider optimistic updates
- Test with realistic data volumes

---

## 📋 TESTING REQUIREMENTS

### Critical User Flows

1. **Competition Discovery → Registration → Payment → Success**
2. **Organizer Onboard → Create Competition → Configure Divisions → Schedule Heats → Enter Scores**
3. **Athlete View Schedule → Check Leaderboard**
4. **Volunteer Signup → Accept Invite → View Schedule**
5. **Organizer Manage Team Invites → Track Revenue**

### Integration Points

- Stripe Connect (onboarding, payments)
- Database (D1 via Drizzle)
- Authentication (session management)
- File uploads (logos, images)
- Email (Resend for invites, confirmations)

---

## 📊 ESTIMATED EFFORT

**Total Routes:** 39 page routes + 1 undocumented (series edit) = **40 total page routes** ✅ VERIFIED
**Total Layouts:** 8 layout files ✅ VERIFIED
**Total Loading States:** 5 loading files ✅ VERIFIED
**Total Components:**

- Route components in `_components/`: 111 files ✅ VERIFIED
- Shared compete components: 4 files ✅ VERIFIED
- **Total: 115+ component files** (doc claimed 102+, actual is higher)
  **Total Actions:** 11 action files ✅ VERIFIED (doc claimed 12, waivers.ts does not exist)
  **Total .tsx Files:** 163 files in compete directory ✅ VERIFIED

**Complexity Breakdown:**

- **High Complexity:** 8 routes (scheduling, scoring, registration)
- **Medium Complexity:** 15 routes (management dashboards)
- **Low Complexity:** 15 routes (detail pages, lists)

**Estimated Timeline:**

- P0 (Core): 3-4 weeks
- P1 (Enhanced): 2-3 weeks
- P2 (Extended): 1-2 weeks

**Total:** 6-9 weeks for complete migration

---

## 📋 STEP 0: TEST COVERAGE REQUIREMENTS

### Testing Philosophy (Testing Trophy)

```
      /\
     /  \  E2E (5-10 critical path tests)
    /----\  Registration → Payment → Success
   / INT  \ Integration (SWEET SPOT)
  /--------\ Heat scheduling, scoring, judge rotation
 |  UNIT  | Unit (fast, focused)
 |________| Score calculations, ranking algorithms
  STATIC   TypeScript + Biome
```

---

### 🎯 EXISTING TEST COVERAGE (apps/wodsmith/test/)

#### Competition Leaderboard (`test/server/competition-leaderboard.test.ts` - 1513 lines)
| Area | Tests | Status | Notes |
|------|-------|--------|-------|
| `calculatePoints` | 17 | ✅ Complete | fixed_step, winner_takes_more, even_spread scoring |
| `assignRanksWithTies` | 25 | ✅ Complete | Two-way, three-way, multiple ties |
| Capped scores | 8 | ✅ Complete | secondaryValue matching, time cap handling |
| Tiebreaker values | 6 | ✅ Complete | tiebreakValue matching logic |
| Scheme-specific sorting | 12 | ✅ Complete | time/reps/load ascending/descending |
| Overall ranking tiebreakers | 8 | ✅ Complete | 1st/2nd place count tiebreakers |
| Integration scenarios | 7 | ✅ Complete | CrossFit Open-style, multi-event |
| `areScoresEqual` edge cases | 15 | ✅ Complete | null handling, status matching |

#### Sponsors (`test/server/sponsors.test.ts` - 1070 lines, 47 tests)
| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `getSponsor` | 2 | ✅ Complete | Get by ID, not found |
| `getCompetitionSponsors` | 2 | ✅ Complete | Grouped/ungrouped organization |
| `getCompetitionSponsorGroups` | 2 | ✅ Complete | Ordered list, empty state |
| `getUserSponsors` | 2 | ✅ Complete | Ordered list for athlete sponsors |
| `createSponsorGroup` | 4 | ✅ Complete | Auto-order, explicit order, validation |
| `updateSponsorGroup` | 4 | ✅ Complete | Name, display order, not found |
| `deleteSponsorGroup` | 3 | ✅ Complete | Delete, idempotent, validation |
| `reorderSponsorGroups` | 3 | ✅ Complete | Multiple groups, empty list |
| `createSponsor` | 6 | ✅ Complete | Competition/user sponsors, group assignment |
| `updateSponsor` | 5 | ✅ Complete | Name, group, logo URL updates |
| `deleteSponsor` | 3 | ✅ Complete | Clears workout references |
| `reorderSponsors` | 3 | ✅ Complete | Within competition, between groups |
| `assignWorkoutSponsor` | 5 | ✅ Complete | Assign, clear, validation |
| `getWorkoutSponsor` | 3 | ✅ Complete | Get sponsor, no sponsor, not found |

#### Volunteers (`test/server/volunteers.test.ts` - 918 lines)
| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `getVolunteerRoleTypes` | 7 | ✅ Complete | Metadata parsing, all role types |
| `isVolunteer` | 7 | ✅ Complete | Role checking, system role validation |
| `hasRoleType` | 5 | ✅ Complete | Role type matching |
| `getVolunteerAvailability` | 4 | ✅ Complete | morning/afternoon/all_day |
| `isVolunteerAvailableFor` | 8 | ✅ Complete | Availability matching |
| `filterVolunteersByAvailability` | 8 | ✅ Complete | Time slot filtering |
| `isDirectInvite` | 6 | ✅ Complete | Direct vs application detection |
| `calculateInviteStatus` | 10 | ✅ Complete | accepted/expired/pending |
| Metadata integration | 6 | ✅ Complete | Status workflow, legacy compatibility |

#### Judge Rotation (`test/lib/judge-rotation-utils.test.ts` - 735 lines)
| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `expandRotationToAssignments` | 10 | ✅ Complete | STAY, SHIFT_RIGHT patterns |
| `calculateCoverage` | 12 | ✅ Complete | Gaps, overlaps, percentage |
| `filterRotationsByAvailability` | 10 | ✅ Complete | morning/afternoon/all_day filtering |
| Varying lane counts | 3 | ✅ Complete | Per-heat lane count handling |

#### Judge Scheduling (`test/server/judge-scheduling.test.ts` - 110 lines)
| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `calculateRequiredJudges` | 9 | ✅ Complete | Basic, varying lanes, rotation length |

#### Stripe Connect (`test/server/stripe-connect.test.ts` - 631 lines)
| Function | Tests | Status | Notes |
|----------|-------|--------|-------|
| `parseOAuthState` | 8 | ✅ Complete | Base64 parsing, validation |
| `getOAuthAuthorizeUrl` | 4 | ✅ Complete | URL generation, CSRF |
| `handleOAuthCallback` | 6 | ✅ Complete | Code exchange, account status |
| `syncAccountStatus` | 4 | ✅ Complete | PENDING → VERIFIED transitions |
| Security tests | 5 | ✅ Complete | CSRF, session, permissions |

#### Scoring Library (`test/lib/scoring/` - 6 files)
| File | Tests | Status | Notes |
|------|-------|--------|-------|
| `validate.test.ts` | ~30 | ✅ Complete | Input validation, tiebreaks, time caps |
| `parse.test.ts` | ~25 | ✅ Complete | Time, reps, load parsing |
| `format.test.ts` | ~20 | ✅ Complete | Display formatting |
| `encode.test.ts` | ~15 | ✅ Complete | Sort key encoding |
| `decode.test.ts` | ~15 | ✅ Complete | Sort key decoding |
| `aggregate.test.ts` | ~10 | ✅ Complete | Multi-round aggregation |
| `sort.test.ts` | ~10 | ✅ Complete | Leaderboard sorting |
| `time-cap-tiebreak.test.ts` | ~15 | ✅ Complete | Cap/tiebreak handling |
| `multi-round.test.ts` | ~10 | ✅ Complete | Multi-round scoring |

#### Commerce (`test/server/commerce/fee-calculation.test.ts`)
| Area | Tests | Status | Notes |
|------|-------|--------|-------|
| Fee calculation | ~20 | ✅ Complete | 4 pricing models, edge cases |

---

### ❌ MISSING TEST COVERAGE - REQUIRED FOR MIGRATION

#### E2E Tests (Critical Path) - `e2e/compete/`

| Test File | Priority | Routes Covered | Status |
|-----------|----------|----------------|--------|
| `registration.spec.ts` | **P0** | `/compete/[slug]/register`, `/register/success` | ❌ Missing |
| `payment-flow.spec.ts` | **P0** | Stripe checkout integration | ❌ Missing |
| `organizer-onboard.spec.ts` | **P0** | `/compete/organizer/onboard`, Stripe Connect OAuth | ❌ Missing |
| `competition-create.spec.ts` | **P0** | `/compete/organizer/new`, competition CRUD | ❌ Missing |

**E2E Test Requirements:**

1. **Registration Flow** (revenue path - CRITICAL)
   - Navigate to competition detail
   - Click register, select division
   - Fill registration form with team/individual
   - Complete Stripe checkout (test mode)
   - Verify success page, team invite links
   - Acceptance: Full journey in <30s

2. **Organizer Onboarding** (revenue enablement)
   - Sign up as organizer
   - Complete Stripe Connect OAuth flow
   - Verify PENDING → VERIFIED status
   - Acceptance: Account linked, can create competitions

3. **Competition Management**
   - Create competition with all fields
   - Configure divisions, events, pricing
   - Publish competition
   - Acceptance: Competition appears in public listing

#### Integration Tests - `test/integration/compete/`

| Test File | Priority | Coverage | Status |
|-----------|----------|----------|--------|
| `heat-scheduling.test.ts` | **P0** | Heat CRUD, drag-and-drop reorder | ❌ Missing |
| `judge-assignment.test.ts` | **P0** | Judge → heat assignment flow | ❌ Missing |
| `score-entry.test.ts` | **P0** | Score submission, leaderboard update | ❌ Missing |
| `division-management.test.ts` | **P1** | Division CRUD, template import | ❌ Missing |
| `event-management.test.ts` | **P1** | Event/workout assignment | ❌ Missing |
| `volunteer-signup.test.ts` | **P1** | Public signup, approval workflow | ❌ Missing |
| `team-registration.test.ts` | **P1** | Team invite, roster management | ❌ Missing |

**Integration Test Requirements:**

1. **Heat Scheduling** (15+ components, high complexity)
   - Create heats for an event
   - Drag athletes between heats
   - Drag divisions to auto-create heats
   - Assign venues/lanes
   - Verify heat capacity enforcement
   - Test with FakeDatabase for D1 parameter limits

2. **Judge Rotation**
   - Assign judges to heats
   - Configure rotation patterns (STAY, SHIFT_RIGHT)
   - Calculate coverage percentage
   - Detect gaps and overlaps
   - Filter by availability

3. **Scoring/Results**
   - Submit scores for different schemes
   - Verify leaderboard ranking
   - Test tie detection and resolution
   - Multi-event point aggregation

#### Action Tests - `test/actions/compete/`

| Action File | Tests Needed | Priority | Status |
|-------------|--------------|----------|--------|
| `competition-actions.ts` | CRUD, registration, events | P0 | ❌ Missing |
| `competition-division-actions.ts` | Division CRUD | P0 | ❌ Missing |
| `competition-heat-actions.ts` | Heat CRUD, athlete assignment | P0 | ❌ Missing |
| `competition-score-actions.ts` | Score entry, validation | P0 | ❌ Missing |
| `judge-scheduling-actions.ts` | Judge availability | P1 | ❌ Missing |
| `judge-rotation-actions.ts` | Rotation patterns | P1 | ❌ Missing |
| `judge-assignment-actions.ts` | Judge-heat assignments | P1 | ❌ Missing |
| `volunteer-actions.ts` | Volunteer CRUD, invites | P1 | ❌ Missing |
| `commerce.action.ts` | Pricing, purchases | P0 | ❌ Missing |
| `sponsors.actions.ts` | Sponsor CRUD | P2 | ⚠️ Partial (server only) |
| `stripe-connect.action.ts` | OAuth, status sync | P0 | ⚠️ Partial (server only) |

---

### 📊 TEST COVERAGE SUMMARY

| Category | Existing | Missing | Priority |
|----------|----------|---------|----------|
| **E2E (Critical Path)** | 0 | 4 specs | P0 |
| **Integration** | 0 | 7 files | P0-P1 |
| **Server Functions** | ~200 tests | Complete | ✅ |
| **Scoring Library** | ~150 tests | Complete | ✅ |
| **Actions** | 0 | 11 files | P0-P2 |
| **Components** | 0 | ~115 components | P1-P2 |

---

### ✅ ACCEPTANCE CRITERIA FOR MIGRATION COMPLETE

**Before migrating any route:**

1. ✅ Existing server function tests pass
2. ✅ Scoring library tests pass
3. ⚠️ Action tests must be created for the route
4. ⚠️ Integration test for multi-component flows

**After migrating route:**

1. ✅ All existing tests still pass
2. ✅ New TanStack Start route renders correctly
3. ✅ Data fetching works with TanStack Router loaders
4. ✅ Forms submit correctly via server actions
5. ⚠️ E2E test passes for critical paths

**Migration-Blocking Tests (Must Create First):**

1. `e2e/compete/registration.spec.ts` - Before migrating registration route
2. `test/integration/compete/heat-scheduling.test.ts` - Before migrating schedule page
3. `test/actions/competition-actions.test.ts` - Before migrating any competition page

---

### 🔧 TEST INFRASTRUCTURE NOTES

**Existing Infrastructure:**
- Vitest + jsdom for unit/integration
- Playwright for E2E
- FakeDatabase for D1 mocking (respects 100 param limit)
- Factory functions in `@repo/test-utils`
- Existing fixtures: `createSponsor`, `createSponsorGroup`

**Required New Factories:**
- `createCompetition` - Full competition with relations
- `createDivision` - Division with event associations
- `createHeat` - Heat with athlete assignments
- `createScore` - Score with all scheme variations
- `createVolunteerMembership` - Volunteer with roles/availability

**Test Data Seeds:**
- Competition with 3 divisions, 5 events
- 50 athletes across divisions
- Heat schedule with judge rotations
- Sample scores for leaderboard testing

---

## 🚀 NEXT STEPS

1. **Phase 1:** Public competition pages (discovery, detail, leaderboard)
2. **Phase 2:** Registration flow with Stripe integration
3. **Phase 3:** Organizer dashboard and competition CRUD
4. **Phase 4:** Division and event management
5. **Phase 5:** Heat scheduling (high complexity)
6. **Phase 6:** Scoring and results
7. **Phase 7:** Volunteers and athlete portal
8. **Phase 8:** Series and extended features

**Recommendation:** Start with Phase 1 to establish patterns for data fetching, layout structure, and component organization in TanStack Start before tackling the complex scheduling and registration flows.

---

## 🔍 AUDIT FINDINGS (Dec 23, 2025)

### ✅ Verified Accurate

1. **Route count:** 39 page routes confirmed (40 with undocumented series edit)
2. **TanStack Start:** 0% compete completion - no compete routes exist in `apps/wodsmith-start/`
3. **Action files:** 11 of 12 exist (all functional competition actions present)
4. **Component structure:** Well-organized with `_components/` pattern

### ❌ Corrections Made

1. **Path correction:** All routes are in `(compete)/compete/`, NOT `(main)/compete/`
   - Updated all 39 route paths in documentation
2. **Missing files identified:**
   - ⛔ `waivers.ts` action file does NOT exist
   - ⛔ Waivers page route does NOT exist
   - ⛔ Root `compete/layout.tsx` does NOT exist
3. **Undocumented route found:**
   - ✅ Added `series/[groupId]/edit/page.tsx` to Series Management section
4. **Component count updated:**
   - Doc claimed: 102+ components
   - Actual verified: 115+ component files (111 in `_components/` + 4 shared)
   - Total .tsx files: 163 (includes pages, layouts, loading states, components)

### 📝 Additional Notes

1. **Judge management:** 11 judge components exist in `volunteers/judges/_components/` but no dedicated judge page route. Judges are managed via schedule page and volunteer management.
2. **Layout structure:** 8 layout files and 5 loading state files provide good architectural separation
3. **Action files:** All 11 existing action files are well-organized and cover the compete domain comprehensively

### 🎯 Audit Conclusion

Documentation is **substantially accurate** with route count, complexity assessment, and structure. Main corrections were path prefix and removal of non-existent waivers functionality. Component count is actually **higher** than documented (115+ vs 102+), making this section even more substantial than initially described.
