# Event Operations Workflows

Workflows for managing events, scheduling, and results.

## 1. Add Events

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/events/` |
| **Complexity** | Medium |
| **Doc Type** | Tutorial (first event), How-to (subsequent) |
| **Prerequisites** | Divisions configured |

### Key Components
- `EventManager` - Event CRUD and ordering
- `EventForm` - Event configuration
- `ScoringRuleSelector` - Scoring configuration
- `MovementSelector` - Workout builder

### User Actions
1. Add new event
2. Configure event name and description
3. Select event type (for time, for reps, etc.)
4. Set scoring rules and tiebreakers
5. Add movements/workout details
6. Assign to divisions

### Documentation Requirements

**Tutorial Focus (first event):**
- Simple "For Time" event with clear movements
- Explain scoring type selection
- Show division assignment

**How-to Focus (complex events):**
- Multi-part events
- Custom scoring rules
- Event templates

**Reference Focus:**
- Complete list of event types
- Scoring rule options
- Movement database

---

## 2. Schedule Heats

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/schedule` |
| **Complexity** | High |
| **Doc Type** | How-to, Explanation |
| **Prerequisites** | Events and divisions configured, athletes registered |

### Key Components
- `HeatScheduler` - Main scheduling interface
- `HeatTimeline` - Visual schedule editor
- `LaneAssignment` - Athlete-to-lane mapping
- `ConflictDetector` - Scheduling conflict alerts

### User Actions
1. View schedule grid by day/time
2. Create heats for each event
3. Set heat start times
4. Assign athletes to heats
5. Configure lanes per heat
6. Resolve scheduling conflicts

### Documentation Requirements

**How-to Focus:**
- Schedule a full day of competition
- Handle multi-division events
- Resolve athlete conflicts (same athlete in overlapping heats)
- Optimize for judge availability

**Explanation Focus:**
- Why heat scheduling matters for athlete experience
- Trade-offs: athlete rest vs. event completion time
- Lane assignment strategies

---

## 3. Enter Results

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/results` |
| **Complexity** | Medium |
| **Doc Type** | How-to |
| **Prerequisites** | Heats completed |

### Key Components
- `ResultsEntry` - Score input interface
- `LeaderboardPreview` - Real-time standings
- `ResultsValidation` - Score verification
- `ResultsPublisher` - Public leaderboard control

### User Actions
1. Select event and heat
2. Enter scores for each athlete
3. Handle tiebreakers
4. Validate results
5. Publish to leaderboard
6. Handle result disputes

### Documentation Requirements

**How-to Focus:**
- Enter results quickly during competition
- Handle tiebreaker scenarios
- Process result disputes
- Publish partial vs. final results

**Reference Focus:**
- Scoring calculation formulas
- Tiebreaker rules by event type

---

## CI Change Detection

```yaml
triggers:
  "src/app/(main)/compete/$competitionId/events/**":
    workflows: [add-events, configure-scoring]
    priority: high

  "src/app/(main)/compete/$competitionId/schedule/**":
    workflows: [schedule-heats]
    priority: critical

  "src/app/(main)/compete/$competitionId/results/**":
    workflows: [enter-results]
    priority: high
```
