---
status: proposed
date: 2026-03-26
decision-makers: [Ian Jones]
consulted: []
informed: []
---

# ADR-0009: Broadcast Audience Filtering by Registration Questions

## Context and Problem Statement

The broadcast system (ADR-0008) lets organizers send one-way messages to targeted groups. The current audience filter supports five types: `all` (all athletes), `division` (athletes in a specific division), `public` (everyone), `volunteers` (all volunteers), and `volunteer_role` (volunteers with a specific role).

Organizers set up **custom registration questions** when configuring their competitions — things like t-shirt size, dietary restrictions, experience level, emergency contact info, etc. These questions exist at two levels:

- **Series-level** questions (set on the series group, inherited by all competitions in the series)
- **Competition-level** questions (set on a specific competition)

Athlete registration questions and volunteer registration questions are **completely separate** — stored in the same table (`competitionRegistrationQuestionsTable`) but distinguished by the `questionTarget` field (`"athlete"` vs `"volunteer"`). Answers are stored in separate tables: `competitionRegistrationAnswersTable` for athletes (keyed by `registrationId` + `userId`) and `volunteerRegistrationAnswersTable` for volunteers (keyed by `invitationId`).

ADR-0008 identified "registration question responses" as a planned audience filter type but didn't detail the implementation. Organizers need this to send targeted messages like:

- "All athletes who selected 'Large' for t-shirt size — your shirts are ready for pickup at tent 3"
- "Volunteers who indicated they have EMT certification — please report to medical staging at 7am"
- "Athletes who answered 'Yes' to the travel reimbursement question — submit your receipts by Friday"

How should we extend the broadcast audience filter to support filtering by registration question answers?

## Decision Drivers

* Must support filtering by both athlete and volunteer registration questions
* Must handle both series-level and competition-level questions (already merged at query time)
* Must support all question types: text, select, number
* Must show accurate recipient count preview before sending
* Must integrate cleanly with the existing `audienceFilterSchema` and `sendBroadcastFn`
* Should allow combining question filters (e.g., t-shirt size = "L" AND experience = "Advanced")
* Should reuse the question/answer data already loaded by existing server functions

## Current Audience Filter Shape

```typescript
const audienceFilterSchema = z.object({
  type: z.enum(["all", "division", "public", "volunteers", "volunteer_role"]),
  divisionId: z.string().optional(),
  volunteerRole: z.string().optional(),
})
```

The `type` field determines the base audience. Additional fields (`divisionId`, `volunteerRole`) narrow within that type. The filter is evaluated server-side in `sendBroadcastFn` and `previewAudienceFn` to build the recipient list.

## Considered Options

### Option A: New top-level audience types per question

Add new `type` values like `"athlete_question"` and `"volunteer_question"` alongside a `questionId` and `answerValues` field. Each broadcast targets a single question.

### Option B: Question filters as an additive layer on existing audience types

Keep the existing `type` field as the base audience selector and add an optional `questionFilters` array that further narrows the audience. This allows combining base targeting (all athletes, a division, all volunteers, a role) with question-based filtering.

### Option C: Full query builder

Build a general-purpose filter DSL with AND/OR/NOT operators, supporting divisions, questions, waiver status, payment status, etc. Store as a JSON expression tree.

## Decision Outcome

Chosen option: **Option B: Question filters as an additive layer**, because it extends the existing filter model naturally without breaking changes. The base `type` already determines whether the audience is athletes or volunteers — question filters simply narrow within that audience. This keeps the UI straightforward (pick your audience, then optionally refine by questions) and the server logic simple (fetch base audience, then filter by answers).

Option A was rejected because it only allows filtering by one question at a time and creates an awkward separation between "all athletes" and "athletes who answered X." Option C was rejected because the complexity of a full query builder is not justified — organizers need simple, composable filters, not a SQL-like DSL.

### Consequences

* Good, because organizers can target broadcasts by any combination of registration question answers
* Good, because the existing audience types continue to work unchanged
* Good, because series-level and competition-level questions are both supported (already merged at query time)
* Good, because the filter shape is backward-compatible — existing broadcasts without `questionFilters` work as before
* Good, because the same approach works for both athlete and volunteer question filtering
* Neutral, because `select` questions have clean filter options while `text` and `number` questions require the organizer to type exact match values
* Bad, because text/number question filtering is limited to exact match — no contains/range queries in MVP

## Design

### Extended Audience Filter Schema

```typescript
const questionFilterSchema = z.object({
  questionId: z.string(),
  // Values to match — recipient must have answered with one of these
  values: z.array(z.string()).min(1),
})

const audienceFilterSchema = z.object({
  type: z.enum(["all", "division", "public", "volunteers", "volunteer_role"]),
  divisionId: z.string().optional(),
  volunteerRole: z.string().optional(),
  // Optional: further narrow the audience by registration question answers
  // Multiple question filters are AND'd — recipient must match ALL
  questionFilters: z.array(questionFilterSchema).optional(),
})
```

When `questionFilters` is present:
- Each entry says "the recipient's answer to `questionId` must be one of `values`" (OR within a question)
- Multiple entries are AND'd — the recipient must match every question filter
- For athlete audience types (`all`, `division`, `public`), only athlete questions (and athlete answer table) are checked
- For volunteer audience types (`volunteers`, `volunteer_role`), only volunteer questions (and volunteer answer table) are checked

### Server-Side Evaluation

In `sendBroadcastFn` and `previewAudienceFn`, after building the base recipient list:

1. If `questionFilters` is empty or absent, return the base list (no change from today)
2. If present, for each recipient:
   - Look up their answers (by `registrationId` for athletes, by `invitationId` for volunteers)
   - For each question filter, check if their answer to that `questionId` is in `values`
   - Include the recipient only if ALL question filters match

For efficiency, batch-load all answers for the competition/question IDs in the filter, then filter in-memory. The data is already available via `getCompetitionRegistrationAnswersFn` (athletes) and `getVolunteerAnswersFn` (volunteers).

### Compose UI

The broadcast compose form currently has a "Send to" select with options: All Athletes, By Division, All Volunteers, By Volunteer Role, Public.

Add a **"Filter by questions"** section that appears after selecting the base audience:

1. When the base audience is athlete-targeting (`all`, `division`, `public`), show athlete registration questions
2. When the base audience is volunteer-targeting (`volunteers`, `volunteer_role`), show volunteer registration questions
3. Each question renders as an expandable filter row:
   - **Select questions**: multi-select checkboxes showing all defined options
   - **Text/Number questions**: tag input where the organizer types values to match (autocompleted from existing answers)
4. Active question filters show as chips below the audience selector
5. Recipient count preview updates live as filters are added/removed

### Question Source

Questions are loaded via the existing `getCompetitionQuestionsFn` (which already merges series + competition questions) for athletes, and `getVolunteerQuestionsFn` for volunteers. Both functions accept a `questionTarget` parameter and return questions tagged with `source: "series" | "competition"`.

The UI should display the question `label` and optionally indicate whether it's a series or competition question (helps organizers in a series context understand question scope).

### Stored Filter Example

A broadcast targeting all athletes who selected "Large" t-shirt AND have "Advanced" experience:

```json
{
  "type": "all",
  "questionFilters": [
    { "questionId": "q_tshirt123", "values": ["Large"] },
    { "questionId": "q_experience456", "values": ["Advanced", "Elite"] }
  ]
}
```

A broadcast targeting volunteers with EMT certification:

```json
{
  "type": "volunteers",
  "questionFilters": [
    { "questionId": "q_emt789", "values": ["Yes"] }
  ]
}
```

### Future Extensions (not in MVP)

- **Range filters for number questions** — e.g., "athletes who entered a number > 5"
- **Contains/partial match for text questions** — e.g., "answers containing 'gluten'"
- **NOT filters** — e.g., "athletes who did NOT select 'Large'"
- **Unanswered filter** — target recipients who left a question blank
