---
status: accepted
date: 2026-03-07
decision-makers: Zac Jones
consulted: ""
informed: ""
---

# Add timestamped video review notes with movement tagging

## Context and Problem Statement

Organizers reviewing video submissions for online competitions currently have no way to log observations while watching an athlete's video. When reviewing a YouTube submission, they may notice no-reps, form issues, or other penalties at specific moments in the video but have no structured way to capture these observations.

How should we let organizers create timestamped review notes on video submissions, with optional movement attribution, so they can track no-rep counts per movement and reference specific moments in the video?

Related code:
- `src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx` — current review detail page
- `src/components/compete/youtube-embed.tsx` — current YouTube iframe embed
- `src/db/schemas/video-submissions.ts` — video submissions table
- `src/db/schemas/workouts.ts` — movements and `workoutMovements` junction table

## Decision Drivers

* Organizers need to capture observations at specific video timestamps without leaving the review page
* No-rep counts per movement need to be visible at a glance for fair judging
* Multiple reviewers may review the same submission — notes must be attributed to the reviewer
* YouTube is the expected video platform; we can leverage the IFrame Player API
* Notes are internal (organizer-only) for now, with future configurability for athlete visibility
* The UX must be fast: press "n" or focus the note form → video pauses → type note → submit → resume

## Considered Options

* **Option A: YouTube IFrame Player API integration** — Use the YT IFrame API to programmatically pause the video and capture `getCurrentTime()` when the reviewer presses "n" or focuses the note form
* **Option B: Manual timestamp entry via YouTube share URLs** — Reviewer manually copies the YouTube share URL (which includes `?t=` param) and pastes it into a note form

## Decision Outcome

Chosen option: **"YouTube IFrame Player API integration"**, because it provides a seamless UX where the reviewer never leaves the page, timestamps are captured automatically, and the video pauses instantly on keypress or form focus. Manual paste is error-prone and breaks flow.

### Consequences

* Good, because organizers get a fast, keyboard-driven workflow for logging observations
* Good, because timestamps are captured programmatically — no manual entry errors
* Good, because movement tagging enables per-movement no-rep tallies for fair judging
* Good, because multi-reviewer attribution via team membership provides audit trail
* Bad, because we take a dependency on YouTube IFrame Player API (only works for YouTube videos)
* Bad, because the current sandboxed iframe in `YouTubeEmbed` must be replaced with the API-driven player
* Neutral, because non-YouTube submissions will still show notes but without auto-timestamp capture (manual entry fallback)

## Implementation Plan

### New Database Table

Create `src/db/schemas/review-notes.ts`:

```typescript
export const reviewNotesTable = mysqlTable("review_notes", {
  ...commonColumns,
  id: varchar({ length: 255 }).primaryKey().$defaultFn(createReviewNoteId),

  // Which submission this note belongs to
  videoSubmissionId: varchar({ length: 255 }).notNull(),

  // Who wrote the note (reviewer)
  userId: varchar({ length: 255 }).notNull(),

  // Team context for multi-tenancy
  teamId: varchar({ length: 255 }).notNull(),

  // The note content
  content: text().notNull(),

  // Video timestamp in seconds (fractional allowed via float/decimal)
  // Null if timestamp wasn't captured (non-YouTube or manual entry)
  timestampSeconds: int(),

  // Optional movement attribution (references movements.id)
  // Used for no-rep tallies per movement
  movementId: varchar({ length: 255 }),

  // When the note was created
  createdAt: datetime().notNull(),
})
```

Add relations to `videoSubmissionsTable`, `userTable`, `movements`, and `teamTable`.

Export from `src/db/schema.ts`.

### New Server Functions

Create `src/server-fns/review-note-fns.ts`:

1. **`getReviewNotesFn`** — Fetch all notes for a submission, joined with user (reviewer name/avatar) and movement name. Ordered by `timestampSeconds` ascending (null timestamps last). Requires `MANAGE_COMPETITIONS` permission.

2. **`createReviewNoteFn`** — Create a note with content, timestampSeconds (optional), movementId (optional). Validates team membership and permission. Input schema:
   ```typescript
   z.object({
     videoSubmissionId: z.string(),
     competitionId: z.string(),
     content: z.string().min(1).max(2000),
     timestampSeconds: z.number().int().min(0).optional(),
     movementId: z.string().optional(),
   })
   ```

3. **`deleteReviewNoteFn`** — Delete a note by ID. Only the note author or a team admin can delete. Requires `MANAGE_COMPETITIONS` permission.

4. **`getWorkoutMovementsFn`** — Fetch movements for a given workout (via `workoutMovements` junction). Returns `{ id, name, type }[]`. Used to populate the movement dropdown in the note form.

### YouTube Embed API Upgrade

Modify `src/components/compete/youtube-embed.tsx`:

- Create a new `YouTubePlayerEmbed` component (keep existing `YouTubeEmbed` for non-review contexts)
- Load the YouTube IFrame Player API script (`https://www.youtube.com/iframe_api`) via a `<script>` tag or dynamic import
- Use `new YT.Player(elementId, { ... })` instead of raw `<iframe>`
- Expose player controls via a ref or callback: `onReady(player)`, providing `player.pauseVideo()`, `player.getCurrentTime()`, `player.seekTo(seconds)`
- Remove the `sandbox` attribute (incompatible with the IFrame API's postMessage communication)
- Keep `rel=0&modestbranding=1` embed params
- Add `enablejsapi=1` and `origin` params

### Review Page Updates

Modify `$submissionId.tsx`:

**Keyboard handler:**
- Global `keydown` listener for "n" key
- Skip if focus is inside an input/textarea (so typing "n" in the note form doesn't re-trigger)
- On "n": pause video via player ref, capture current timestamp, open/focus the note form with timestamp pre-filled

**Note form (below video card, in left column):**
- Textarea for note content (auto-focused when opened via "n")
- On textarea focus: pause video, capture timestamp if not already set
- Timestamp display (formatted as MM:SS) — editable, pre-filled from capture
- Movement dropdown (populated from `getWorkoutMovementsFn`) — optional, label: "Movement (optional)"
- Submit button + keyboard shortcut (Cmd/Ctrl+Enter to submit)
- After submit: clear form, keep form open for rapid note-taking, optionally resume video

**Notes list (below the note form):**
- Ordered by timestamp ascending
- Each note shows:
  - Timestamp as clickable link (formatted MM:SS) — clicking seeks video to that timestamp
  - Note content
  - Movement badge (if tagged)
  - Reviewer name + avatar
  - Relative time ("2 min ago")
  - Delete button (only for note author or team admin)

**Movement no-rep tally (in sidebar, new card above or below Verification Controls):**
- Card titled "Review Notes Summary"
- For each movement that has at least one note: movement name + count badge
- Total notes count
- Only visible when notes exist

### Route Loader Changes

In the `$submissionId.tsx` loader:
- Fetch review notes via `getReviewNotesFn`
- Fetch workout movements via `getWorkoutMovementsFn` (needs the workout ID from the event)
- These can be fetched in parallel with existing verification data

* **Affected paths**:
  - New: `src/db/schemas/review-notes.ts`
  - New: `src/server-fns/review-note-fns.ts`
  - Modified: `src/db/schema.ts` (export new table)
  - Modified: `src/components/compete/youtube-embed.tsx` (add `YouTubePlayerEmbed`)
  - Modified: `src/routes/compete/organizer/$competitionId/events/$eventId/submissions/$submissionId.tsx`

* **Dependencies**: None new — YouTube IFrame API is loaded via script tag, not an npm package

* **Patterns to follow**:
  - Server functions in `src/server-fns/` using `createServerFn` with zod validation
  - Permission checks via `requireTeamPermission` with `MANAGE_COMPETITIONS`
  - ID generation with ULID prefix pattern (e.g., `rnote_${ulid()}`)
  - `autochunk` for any `inArray` queries with dynamic arrays
  - `useServerFn` hook for client-side calls

* **Patterns to avoid**:
  - Don't use `process.env` — use `env` from `cloudflare:workers`
  - Don't make notes visible to athletes in this iteration
  - Don't modify score values based on note tallies
  - Don't break existing `YouTubeEmbed` component — add new `YouTubePlayerEmbed` alongside it

* **Configuration**: No new env vars needed

* **Migration steps**:
  - Use `pnpm db:push` during development
  - Generate migration with `pnpm db:generate --name=add-review-notes` before merging

### Verification

- [ ] Pressing "n" on the review page pauses the YouTube video and opens the note form with the current timestamp pre-filled
- [ ] Focusing the note textarea pauses the video and captures the timestamp
- [ ] "n" keypress is ignored when focus is already inside an input or textarea
- [ ] Submitting a note persists it to the database with correct timestamp, content, reviewer userId, and teamId
- [ ] Notes list displays ordered by timestamp with formatted MM:SS timestamps
- [ ] Clicking a timestamp in the notes list seeks the YouTube video to that position
- [ ] Movement dropdown is populated with movements from the event's workout
- [ ] Selecting a movement on a note associates the `movementId` in the database
- [ ] No-rep tally card in sidebar correctly counts notes per movement
- [ ] Multiple reviewers can add notes to the same submission, each attributed correctly
- [ ] Only the note author or team admin can delete a note
- [ ] Non-YouTube submissions still allow note creation (without auto-timestamp)
- [ ] Existing `YouTubeEmbed` component still works in other contexts (no regression)
- [ ] `pnpm type-check` passes
- [ ] `pnpm lint` passes

## Pros and Cons of the Options

### YouTube IFrame Player API integration

Use the official YouTube IFrame Player API to programmatically control the embedded video — pause, get current time, and seek.

* Good, because timestamps are captured automatically with sub-second precision
* Good, because "press n → video pauses → type note" is a fast, keyboard-driven workflow
* Good, because seeking to a timestamp on note click provides instant video reference
* Bad, because requires loading the YT IFrame API script (~50KB)
* Bad, because the `sandbox` attribute must be removed from the iframe (slightly reduced isolation)
* Bad, because only works for YouTube videos (other platforms won't have API control)

### Manual timestamp entry via YouTube share URLs

Reviewer copies a YouTube share URL (e.g., `https://youtu.be/abc?t=42`) and pastes it. The app parses the `?t=` parameter.

* Good, because no external API dependency
* Good, because works with any video platform that supports timestamp sharing
* Bad, because requires the reviewer to leave the page or open the video in a new tab to get the share URL
* Bad, because interrupts the review flow — context switching between tabs
* Bad, because timestamps may be inaccurate (share URL rounds to nearest second vs API sub-second)
* Bad, because no ability to seek within the embedded player

## More Information

- YouTube IFrame Player API reference: https://developers.google.com/youtube/iframe_api_reference
- The `enablejsapi=1` parameter must be added to the embed URL for API control
- `player.getCurrentTime()` returns seconds as a float — we store as integer (rounded) since sub-second precision isn't needed for review notes
- Future work: athlete-visible notes (add a `visibility` column: `internal` | `athlete_visible`), auto-penalty suggestions from no-rep tallies, keyboard shortcuts for common movements
- The IFrame API requires the iframe NOT be sandboxed — this is acceptable since we already trust YouTube embeds and the iframe is same-origin-isolated by YouTube itself
