# Plan: Competition Series Registration Question Inheritance

## Context

Mountain West Fitness Championship is running a Throwdown Series (multiple qualifying competitions grouped under one series). The organizer needs registration questions defined once at the series level to automatically appear on all competitions in the series, instead of manually recreating them on each throwdown. This is the most urgent need - launching tomorrow.

The broader vision is for series to support inheriting divisions, events, waivers, pricing, etc. Registration questions are the first implementation, and the pattern we establish here will generalize to other inheritable entities.

## Approach: Add `groupId` to Existing Table

- Add nullable `groupId` column to `competition_registration_questions`
- Make `competitionId` nullable (series questions have `groupId` set, `competitionId` null)
- **Additive**: competitions inherit series questions AND can have their own
- Series questions show first, then competition-specific questions
- Answers reference `questionId` regardless of origin (no changes to answer storage)

---

## Phase 1: Schema Changes

### File: `src/db/schemas/competitions.ts`

1. **`competitionRegistrationQuestionsTable`** (line 292):
   - Change `competitionId` from `.notNull()` to nullable
   - Add `groupId: varchar({ length: 255 })` (nullable)
   - Add index: `index("comp_reg_questions_group_idx").on(table.groupId)`

2. **`competitionRegistrationQuestionsRelations`** (line 576):
   - Add `group: one(competitionGroupsTable, ...)` relation

3. **`competitionGroupsRelations`** (line 425):
   - Add `registrationQuestions: many(competitionRegistrationQuestionsTable)`

4. **Generate migration**: `pnpm db:generate --name=series-registration-questions`
   - Existing data safe: all current questions have `competitionId` set, `groupId` will be null

---

## Phase 2: Server Function Changes

### File: `src/server-fns/registration-questions-fns.ts`

1. **Update `RegistrationQuestion` interface** - add `groupId: string | null`, make `competitionId` nullable

2. **Add `RegistrationQuestionWithSource`** type - extends `RegistrationQuestion` with `source: 'series' | 'competition'`

3. **Update `getCompetitionQuestionsFn`** - look up competition's `groupId`, if set also fetch series-level questions (`where groupId = X`), merge: series questions first, then competition questions, each tagged with `source`

4. **Add `getSeriesQuestionsFn`** (new) - fetch questions by `groupId` for the series editor

5. **Add `createSeriesQuestionFn`** (new) - create a question with `groupId` set and `competitionId: null`. Verify group belongs to team.

6. **Add `reorderSeriesQuestionsFn`** (new) - reorder questions scoped to a `groupId`

7. **Update `updateQuestionFn`** - ownership check: if `question.competitionId` is set, verify via competition; if `question.groupId` is set, verify via group

8. **Update `deleteQuestionFn`** - same dual ownership check pattern

### File: `src/server-fns/registration-fns.ts`

9. **Update `validateRequiredQuestions`** (line ~122) - also fetch series-level required questions via `or(competitionId match, groupId match)`

### File: `src/server-fns/invite-fns.ts`

10. **Update teammate invite validation** (line ~526) - same pattern as `validateRequiredQuestions`

---

## Phase 3: UI Changes

### 3a. Series Detail Page - Add Question Editor

**File**: `src/routes/compete/organizer/_dashboard/series/$groupId/index.tsx`

- Add `getSeriesQuestionsFn` call to the route loader
- Render a `RegistrationQuestionsEditor`-style component for managing series questions
- The existing `RegistrationQuestionsEditor` component needs to support `groupId` as an alternative to `competitionId` - refactor its props to accept either

### 3b. Refactor `RegistrationQuestionsEditor` Component

**File**: `src/components/competition-settings/registration-questions-editor.tsx`

- Change props to accept `entityType: 'competition' | 'series'` and `entityId: string` instead of just `competitionId`
- Route create/update/delete/reorder calls to the appropriate server function based on `entityType`
- This avoids duplicating the entire drag-and-drop question editor component

### 3c. Competition Athletes Page - Show Inherited Questions

**File**: `src/routes/compete/organizer/$competitionId/athletes.tsx`

- The questions returned from `getCompetitionQuestionsFn` now include `source` field
- Show series questions as read-only with a "From Series" badge (chain-link icon)
- Show competition-specific questions in the existing editable editor
- Both types show in the athletes table and CSV export

### 3d. Registration Form - No Changes Needed

**Files**: `src/components/registration/registration-form.tsx`, `src/routes/compete/$slug/register.tsx`

- `getCompetitionQuestionsFn` returns merged questions automatically
- Registration form renders whatever questions it receives - no awareness of source needed

---

## Edge Cases

- **Competition removed from series**: inherited questions stop appearing, existing answers remain as historical records
- **Series question deleted**: answers cascade-deleted (existing pattern)
- **Duplicate labels**: allowed - organizer can see both and remove duplicates manually
- **Question ordering**: series questions always appear first, then competition questions; each independently reorderable within their scope
- **CSV export**: will automatically include all question columns

---

## Verification

1. **Schema**: Run `pnpm db:generate --name=series-registration-questions` and inspect the migration
2. **Dev test**: Apply schema changes with `pnpm db:push`, create a series with questions, verify they show on competitions in that series
3. **Registration flow**: Register for a competition in a series, verify both series and competition questions appear
4. **Organizer view**: Check athletes page shows inherited questions as read-only
5. **Run tests**: `pnpm test` from `apps/wodsmith-start/`
6. **Type check**: `pnpm type-check` from `apps/wodsmith-start/`

---

## Critical Files

| File | Changes |
|------|---------|
| `src/db/schemas/competitions.ts` | Schema: nullable competitionId, add groupId, update relations |
| `src/server-fns/registration-questions-fns.ts` | Core logic: merge series questions, add series CRUD functions |
| `src/server-fns/registration-fns.ts` | Update validateRequiredQuestions for series questions |
| `src/server-fns/invite-fns.ts` | Update teammate validation for series questions |
| `src/components/competition-settings/registration-questions-editor.tsx` | Refactor to support both competition and series contexts |
| `src/routes/compete/organizer/_dashboard/series/$groupId/index.tsx` | Add series question editor to series detail page |
| `src/routes/compete/organizer/$competitionId/athletes.tsx` | Show inherited questions as read-only |

## Future: Broader Series Inheritance

The same pattern (`groupId` column + merge at query time) can be applied to:
- **Divisions**: series defines available divisions, competitions select a subset
- **Events/workouts**: shared events across the series
- **Waivers**: inherited waiver requirements
- **Pricing defaults**: series-level fee templates
- **Sponsors**: shared sponsor display

Each would follow the pattern: add nullable `groupId` to the entity table, update the fetch logic to merge series + competition entities, and show inherited entities as read-only in the competition editor.
