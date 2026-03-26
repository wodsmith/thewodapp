---
status: proposed
date: 2026-03-26
decision-makers: [Ian Jones]
consulted: []
informed: []
---

# ADR-0009: Registration Question Filtering for Athletes and Volunteers

## Context and Problem Statement

Organizers need to filter their athlete roster and volunteer roster by the answers to custom registration questions. Registration questions exist at two levels — **series** (inherited by all competitions in the group) and **competition** (specific to one competition) — and are completely separate between athletes (`questionTarget: "athlete"`) and volunteers (`questionTarget: "volunteer"`).

The athletes page (`/compete/organizer/$competitionId/athletes`) already has a working question filter implementation: each question renders as a multi-select dropdown in the table header, filter state is persisted in URL search params (`questionFilters: { [questionId]: string[] }`), and active filters show as removable chips. This filtering correctly handles both series-level and competition-level questions since they're merged at load time via `getCompetitionQuestionsFn`.

The volunteers page (`/compete/organizer/$competitionId/volunteers`) has **no** question filtering at all — questions are displayed as table columns and answers are shown, but organizers cannot filter by them.

How should we bring question filtering to the volunteers page and ensure the filtering pattern is consistent and maintainable across both surfaces?

## Decision Drivers

* Volunteers page must gain the same filtering capability athletes already have
* Series-level and competition-level questions must both be filterable (both levels already merged at data load time)
* Athlete and volunteer questions are separate (`questionTarget` field) — filtering must respect this boundary
* Filter state should be URL-persisted (shareable, back-button friendly) as it already is on athletes
* Implementation should reuse existing patterns rather than inventing new ones
* Must work with both authenticated volunteers (matched by userId) and unauthenticated/pending volunteers (matched by invitationId)

## Current State

### What already works (athletes page)

1. **Data loading**: `getCompetitionQuestionsFn` merges series + competition athlete questions. `getCompetitionRegistrationAnswersFn` returns all answers grouped by `registrationId`.
2. **URL search params**: `questionFilters` is a `z.record(z.string(), z.array(z.string()))` validated by Zod, stored in URL search params via TanStack Router.
3. **Filter options**: Built dynamically from all unique answer values per question (`questionFilterOptions` reducer).
4. **Filter UI**: Each question column header has a popover with checkboxes for each unique answer value. Active filters show as chips with remove buttons.
5. **Row filtering**: Registrations are filtered client-side by checking if the athlete's answer for each filtered question is in the selected values.

### What's missing (volunteers page)

- No `questionFilters` in route search params
- No `toggleQuestionFilter` / `removeQuestionFilter` navigation helpers
- No filter option building from answer data
- No filter popover UI on question column headers
- No active filter chips display
- No client-side row filtering by question answers

### Answer storage differences

| | Athletes | Volunteers |
|---|---|---|
| Answer table | `competitionRegistrationAnswersTable` | `volunteerRegistrationAnswersTable` |
| Keyed by | `registrationId` + `userId` | `invitationId` |
| Loaded via | `getCompetitionRegistrationAnswersFn` | `getVolunteerAnswersFn` |
| Grouped as | `answersByRegistration[registrationId]` | `answersByInvitation[invitationId]` |

## Considered Options

### Option A: Copy the athletes page filtering inline to volunteers

Duplicate the filtering logic (search params, toggle functions, filter options builder, UI components) from the athletes page into the volunteers page, adapting for the `invitationId` keying.

### Option B: Extract shared filtering primitives, apply to both pages

Extract the reusable parts of question filtering into shared utilities/components:
- A `useQuestionFilters` hook (or equivalent) for URL state management (`toggleQuestionFilter`, `removeQuestionFilter`, `clearAllQuestionFilters`)
- A `QuestionFilterPopover` component for the column header filter UI
- A `QuestionFilterChips` component for showing active filters
- A `buildQuestionFilterOptions` helper for deriving unique answer values
- A `filterByQuestionAnswers` helper for client-side row filtering

Then refactor the athletes page to use these shared pieces and apply them to the volunteers page.

### Option C: Server-side question filtering

Move filtering to the server — add `questionFilters` as a parameter to the answer-fetching server functions, filter in SQL, and return only matching rows. The UI still manages filter state in URL params but triggers a server round-trip on filter change.

## Decision Outcome

Chosen option: **Option B: Extract shared filtering primitives**, because the athletes page already has a working, well-tested implementation and duplicating it (Option A) would create divergence risk. Server-side filtering (Option C) adds unnecessary complexity — the dataset size (hundreds to low thousands of registrants per competition) is well within client-side filtering limits, and client-side filtering provides instant feedback.

Option C remains a valid future optimization if competitions grow to tens of thousands of registrants, but that's not the current reality.

### Consequences

* Good, because organizers can filter volunteers by registration question answers
* Good, because shared primitives reduce code duplication and ensure consistent UX
* Good, because both series and competition questions are filterable with no extra work (already merged at load time)
* Good, because URL-persisted filters are shareable and browser-navigation friendly
* Neutral, because extracting shared components from the athletes page is a small refactor
* Bad, because client-side filtering won't scale to very large competitions (acceptable for now)

## Implementation Sketch

### 1. Extract shared filtering utilities

Create `src/components/competition-settings/question-filters.tsx` (or similar) with:

```typescript
// Build filter options from answer data
function buildQuestionFilterOptions(
  answers: Map<string, { questionId: string; answer: string }[]>,
  questions: RegistrationQuestion[]
): Record<string, string[]>

// Check if a row's answers match active filters
function matchesQuestionFilters(
  answers: { questionId: string; answer: string }[],
  filters: Record<string, string[]>
): boolean
```

### 2. Extract shared filter UI components

```typescript
// Popover with checkboxes for a single question's answer values
function QuestionFilterPopover({
  question,
  options,
  selectedValues,
  onToggle,
}: QuestionFilterPopoverProps)

// Active filter chips with remove buttons
function QuestionFilterChips({
  filters,
  questions,
  onRemove,
  onClearAll,
}: QuestionFilterChipsProps)
```

### 3. Apply to volunteers page

- Add `questionFilters` to volunteers route search params schema
- Wire up `toggleQuestionFilter` / `removeQuestionFilter` with TanStack Router navigation
- Build filter options from `answersByInvitation` data
- Render `QuestionFilterPopover` in volunteer question column headers
- Render `QuestionFilterChips` in the toolbar area
- Filter volunteer rows client-side using `matchesQuestionFilters`

### 4. Refactor athletes page

- Replace inline filtering logic with the shared utilities
- Verify no behavior change (existing URL params format stays the same)

### Key consideration: volunteer answer lookup

The volunteers page keys answers by `invitationId`, not `registrationId`. The shared `matchesQuestionFilters` function should be agnostic to this — it just takes an array of `{ questionId, answer }` pairs and checks against filters. The caller (athletes or volunteers page) is responsible for looking up the right answer array for each row.
