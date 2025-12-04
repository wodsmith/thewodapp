# Competition Result Ingest - Implementation Plan

## Overview

Build score entry UI at `/compete/organizer/[competitionId]/events/[eventId]/results/` for competition organizers to enter athlete scores. Extends existing `results` table, no heats, online-only for MVP.

## Approach Summary

- **No new database tables** - Extend `results` table with competition-specific tracking columns
- **Simple athlete list** - All registered athletes shown per event, filterable by division
- **Online-only** - Direct server action calls, no offline queue
- **Port v0 UX patterns** - Smart score parsing, keyboard navigation, visual feedback

---

## Phase 1: Database Schema Extension

### File: `src/db/schemas/workouts.ts`

Add columns to `results` table:

```typescript
// Competition-specific fields (add to existing results table)
competitionEventId: text("competition_event_id").references(() => trackWorkoutsTable.id, {
  onDelete: "set null",
}),
competitionRegistrationId: text("competition_registration_id").references(
  () => competitionRegistrationsTable.id,
  { onDelete: "set null" }
),
scoreStatus: text("score_status", {
  enum: ["scored", "dns", "dnf", "cap", "dq", "withdrawn"],
}),
tieBreakScore: text("tie_break_score"), // Raw tie-break value
enteredBy: text("entered_by").references(() => userTable.id, { onDelete: "set null" }),
```

Add index for competition queries:

```typescript
index("results_competition_event_idx").on(table.competitionEventId, table.scalingLevelId),
```

### File: `src/db/schemas/common.ts`

No changes needed - using existing ID generators.

### Migration

```bash
pnpm db:generate add_competition_result_fields
pnpm db:migrate:dev
```

---

## Phase 2: Server Functions

### File: `src/server/competition-scores.ts` (NEW)

```typescript
import "server-only"

export interface EventScoreEntryAthlete {
  registrationId: string
  userId: string
  firstName: string
  lastName: string
  divisionId: string
  divisionLabel: string
  existingResult: {
    resultId: string
    wodScore: string | null
    scoreStatus: string | null
    tieBreakScore: string | null
  } | null
}

export interface EventScoreEntryData {
  event: {
    id: string
    trackOrder: number
    workout: {
      id: string
      name: string
      scheme: WorkoutScheme
      scoreType: ScoreType | null
      tiebreakScheme: TiebreakScheme | null
    }
  }
  athletes: EventScoreEntryAthlete[]
  divisions: Array<{ id: string; label: string }>
}

// Get athletes and existing scores for an event
export async function getEventScoreEntryData(params: {
  competitionId: string
  trackWorkoutId: string
  divisionId?: string // Optional filter
}): Promise<EventScoreEntryData>

// Save a single athlete's score
export async function saveCompetitionScore(params: {
  competitionId: string
  trackWorkoutId: string
  registrationId: string
  userId: string
  divisionId: string
  score: string
  scoreStatus: "scored" | "dns" | "dnf" | "cap"
  tieBreakScore?: string
  enteredBy: string
}): Promise<{ resultId: string }>

// Batch save scores (for submit all)
export async function saveCompetitionScores(params: {
  competitionId: string
  trackWorkoutId: string
  scores: Array<{
    registrationId: string
    userId: string
    divisionId: string
    score: string
    scoreStatus: "scored" | "dns" | "dnf" | "cap"
    tieBreakScore?: string
  }>
  enteredBy: string
}): Promise<{ savedCount: number }>
```

---

## Phase 3: Server Actions

### File: `src/actions/competition-score-actions.ts` (NEW)

```typescript
"use server"

export const saveCompetitionScoreAction = createServerAction()
  .input(z.object({
    competitionId: z.string(),
    organizingTeamId: z.string(),
    trackWorkoutId: z.string(),
    registrationId: z.string(),
    userId: z.string(),
    divisionId: z.string(),
    score: z.string(),
    scoreStatus: z.enum(["scored", "dns", "dnf", "cap"]),
    tieBreakScore: z.string().optional(),
  }))
  .handler(async ({ input }) => {
    await requireTeamPermission(input.organizingTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
    const session = await getSessionFromCookie()

    const result = await saveCompetitionScore({
      ...input,
      enteredBy: session.user.id,
    })

    revalidatePath(`/compete/organizer/${input.competitionId}`)
    return result
  })

export const getEventScoreEntryDataAction = createServerAction()
  .input(z.object({
    competitionId: z.string(),
    organizingTeamId: z.string(),
    trackWorkoutId: z.string(),
    divisionId: z.string().optional(),
  }))
  .handler(async ({ input }) => {
    await requireTeamPermission(input.organizingTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)
    return getEventScoreEntryData(input)
  })
```

---

## Phase 4: Utility Functions

### File: `src/utils/score-parser.ts` (NEW)

Port from v0 with adaptations for production workout schemes:

```typescript
export type ParseResult = {
  formatted: string
  rawValue: number | null  // Seconds for time, reps for AMRAP, lbs for load
  isValid: boolean
  needsTieBreak: boolean
  error?: string
}

export function parseScore(
  input: string,
  scheme: WorkoutScheme,
  timeCap?: number  // seconds, for time-with-cap validation
): ParseResult

// Handles:
// - Time: "1234" -> "12:34" (744 seconds)
// - Reps: "150" -> "150 reps"
// - Load: "225" -> "225 lbs"
// - Shortcuts: "dns", "dnf", "cap"/"c"
```

### File: `src/schemas/competition-scores.ts` (NEW)

Zod schemas for validation.

---

## Phase 5: UI Components

### Directory Structure

```
src/app/(compete)/compete/organizer/[competitionId]/events/[eventId]/
├── page.tsx                          # Existing - add "Enter Results" button
├── results/
│   ├── page.tsx                      # Server component - data fetcher
│   └── _components/
│       ├── results-entry-form.tsx    # Main client component
│       ├── score-input-row.tsx       # Individual athlete row
│       └── division-filter.tsx       # Division dropdown
```

### File: `results/page.tsx` (Server Component)

```typescript
export default async function ResultsPage({ params }) {
  const { competitionId, eventId } = await params

  // Fetch competition and verify permissions
  const competition = await getCompetition(competitionId)
  await requireTeamPermission(competition.organizingTeamId, TEAM_PERMISSIONS.MANAGE_PROGRAMMING)

  // Fetch event and divisions
  const [event, { divisions }] = await Promise.all([
    getCompetitionEvent(eventId),
    getCompetitionDivisionsWithCounts({ competitionId }),
  ])

  return (
    <div className="container mx-auto px-4 py-8">
      <OrganizerBreadcrumb segments={[...]} />
      <h1>Enter Results: {event.workout.name}</h1>
      <ResultsEntryForm
        competitionId={competitionId}
        organizingTeamId={competition.organizingTeamId}
        event={event}
        divisions={divisions}
      />
    </div>
  )
}
```

### File: `_components/results-entry-form.tsx` (Client Component)

Main orchestrator with:
- Division filter dropdown
- Athletes list with score inputs
- Submit/save functionality
- Keyboard navigation (Tab to advance)

```typescript
"use client"

export function ResultsEntryForm({ competitionId, organizingTeamId, event, divisions }) {
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null)
  const [athletes, setAthletes] = useState<EventScoreEntryAthlete[]>([])
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({})

  // Fetch athletes when division changes
  useEffect(() => {
    fetchAthletes(selectedDivision)
  }, [selectedDivision])

  // Handle score change with auto-save
  const handleScoreChange = async (registrationId: string, data: ScoreEntry) => {
    setScores(prev => ({ ...prev, [registrationId]: data }))
    // Debounced auto-save or manual save button
  }

  return (
    <div>
      <DivisionFilter divisions={divisions} value={selectedDivision} onChange={setSelectedDivision} />

      <div className="grid grid-cols-[60px_1fr_2fr_1fr_100px] gap-3 ...">
        {/* Header */}
        <div>LANE</div>
        <div>ATHLETE</div>
        <div>SCORE</div>
        <div>TIE-BREAK</div>
        <div>STATUS</div>

        {/* Rows */}
        {athletes.map((athlete, index) => (
          <ScoreInputRow
            key={athlete.registrationId}
            athlete={athlete}
            workoutScheme={event.workout.scheme}
            tiebreakScheme={event.workout.tiebreakScheme}
            value={scores[athlete.registrationId]}
            onChange={(data) => handleScoreChange(athlete.registrationId, data)}
            autoFocus={index === 0}
          />
        ))}
      </div>

      <div className="sticky bottom-0 ...">
        <Button onClick={handleMarkAllDNS}>Mark Remaining DNS</Button>
        <Button onClick={handleSaveAll}>Save All Scores</Button>
      </div>
    </div>
  )
}
```

### File: `_components/score-input-row.tsx` (Port from v0)

Key features to preserve:
- Smart input parsing with preview ("1234" shows "Preview: 12:34")
- Conditional tie-break field
- Tab navigation (Tab from score -> tie-break if needed -> next row)
- Enter to confirm
- Visual states (pending, saved, warning)

```typescript
"use client"

export function ScoreInputRow({
  athlete,
  workoutScheme,
  tiebreakScheme,
  value,
  onChange,
  autoFocus,
}: ScoreInputRowProps) {
  const [inputValue, setInputValue] = useState(value?.score || "")
  const [tieBreakValue, setTieBreakValue] = useState(value?.tieBreak || "")
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)

  const scoreInputRef = useRef<HTMLInputElement>(null)
  const tieBreakInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (val: string) => {
    setInputValue(val)
    const result = parseScore(val, workoutScheme)
    setParseResult(result)
  }

  const handleKeyDown = (e: KeyboardEvent, field: "score" | "tieBreak") => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault()
      if (field === "score" && parseResult?.needsTieBreak && !tieBreakValue) {
        tieBreakInputRef.current?.focus()
      } else {
        onChange({ score: inputValue, tieBreak: tieBreakValue, status: determineStatus() })
        // Focus next row (parent handles this)
      }
    }
    if (e.key === "Enter") {
      onChange({ score: inputValue, tieBreak: tieBreakValue, status: determineStatus() })
    }
  }

  return (
    <>
      <div>{athlete.lane || "-"}</div>
      <div>
        {athlete.lastName}, {athlete.firstName}
        <Badge>{athlete.divisionLabel}</Badge>
      </div>
      <div>
        <Input
          ref={scoreInputRef}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, "score")}
          autoFocus={autoFocus}
        />
        {parseResult?.isValid && (
          <span className="text-xs text-muted-foreground">Preview: {parseResult.formatted}</span>
        )}
        {parseResult?.error && (
          <span className="text-xs text-destructive">{parseResult.error}</span>
        )}
      </div>
      <div>
        {parseResult?.needsTieBreak ? (
          <Input
            ref={tieBreakInputRef}
            value={tieBreakValue}
            onChange={(e) => setTieBreakValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, "tieBreak")}
            placeholder="Tie-break..."
          />
        ) : (
          <span className="text-muted-foreground">--</span>
        )}
      </div>
      <div>{/* Status indicator */}</div>
    </>
  )
}
```

---

## Phase 6: Integration

### Update existing event page

**File: `src/app/(compete)/compete/organizer/[competitionId]/events/[eventId]/page.tsx`**

Add "Enter Results" button/link:

```typescript
<Button asChild>
  <Link href={`/compete/organizer/${competitionId}/events/${eventId}/results`}>
    Enter Results
  </Link>
</Button>
```

---

## Implementation Order

1. **Schema migration** - Add columns to `results` table
2. **Score parser utility** - Port from v0
3. **Server functions** - `getEventScoreEntryData`, `saveCompetitionScore`
4. **Server actions** - `saveCompetitionScoreAction`
5. **Results page** - Server component
6. **Score input row** - Port from v0 with adaptations
7. **Results entry form** - Main client component
8. **Integration** - Add button to event detail page
9. **Testing** - Manual testing of full flow

---

## Critical Files to Reference

| File | Purpose |
|------|---------|
| `src/db/schemas/workouts.ts` | Results table to extend |
| `src/server/competition-leaderboard.ts` | How results are queried for leaderboard |
| `src/utils/score-formatting.ts` | Existing score formatting utilities |
| `v0-generation/lib/score-parser.ts` | Smart parsing logic to port |
| `v0-generation/components/score-input-row.tsx` | UX patterns to preserve |
| `src/actions/competition-actions.ts` | Server action patterns |
| `src/app/(compete)/compete/organizer/[competitionId]/events/[eventId]/page.tsx` | Existing event page |

---

## Success Criteria

MVP is complete when:
1. Organizer can navigate: Event Detail -> Enter Results
2. All registered athletes appear, filterable by division
3. Scores can be entered with smart parsing (e.g., "1234" -> "12:34")
4. DNS/DNF/CAP status works
5. Tie-break scores can be entered when required
6. Scores persist and update leaderboard

---

## Future Enhancements (Post-MVP)

- Heat management (group athletes into heats with lanes)
- Offline-first with IndexedDB queue
- Division crossover interstitial
- Coordinator view with bulk actions
- Real-time collaboration
- Score outlier warnings
