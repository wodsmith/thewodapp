---
sidebar_position: 3
draft: true
---

# The Scoring System

How WODsmith calculates, ranks, and displays competition results.

## Why Scoring is Complex

At first glance, CrossFit scoring seems simple: fastest time wins, most reps wins. Reality is messier.

Consider these scenarios:

- Two athletes finish at exactly the same time
- One athlete doesn't finish within the time cap
- Multiple events need to combine into overall rankings
- Different divisions compete simultaneously

WODsmith's scoring system handles these complexities automatically, freeing organizers to focus on running the event.

## Score Types and Their Logic

### Time-Based Scoring

For Time workouts score based on completion speed.

**The simple case**: Athlete A finishes in 5:32, Athlete B in 6:15. A wins.

**The edge cases**:

- **Time cap**: Athletes who don't finish receive CAP + remaining reps. This creates a continuous ranking even when some athletes time out.
- **Ties**: When two athletes finish at exactly the same time, tiebreakers apply.

### Rep-Based Scoring

AMRAPs count total work completed.

**Scoring format**: Rounds + Reps (e.g., "5+12" means 5 complete rounds plus 12 additional reps)

**Comparison logic**: Convert to total reps for ranking. If the workout has 30 reps per round, 5+12 = 162 total reps.

**Tiebreaker**: Time to complete the last full round. The athlete who reached 5 rounds faster has the advantage.

### Weight-Based Scoring

Strength events track load.

**The challenge**: Different lifters need different numbers of attempts. Simply ranking by weight ignores effort and strategy.

**WODsmith's approach**: Primary ranking by weight achieved. Tiebreaker by fewer attempts at that weight, rewarding efficient lifting.

## Points Systems

Individual event scores must combine into overall rankings. WODsmith currently uses the CrossFit Games style points system, with additional scoring methods planned for future releases.

### CrossFit Games Style (Current)

Athletes receive points based on finish position:

- 1st: 100 points
- 2nd: 95 points
- 3rd: 90 points
- And so on...

Overall ranking = Sum of points (highest total wins)

This system rewards consistency. An athlete placing 2nd in every event beats one who alternates between 1st and 10th.

:::info Coming Soon
The following scoring method is planned for a future release. Currently, all competitions use the CrossFit Games style points system described above.
:::

### Placement Points

Simpler alternative:

- 1st: 1 point
- 2nd: 2 points
- 3rd: 3 points
- And so on...

Overall ranking = Sum of placements (lowest total wins)

This system amplifies dominance. A 1st place finish is maximally valuable.

### Why Different Systems Exist

No scoring system is "correct"—each creates different incentive structures:

| System       | Rewards        | Penalizes               |
| ------------ | -------------- | ----------------------- |
| Points-based | Consistency    | Single bad performances |
| Placement    | Winning events | Middle-pack finishes    |

Organizers choose based on the competition culture they want to create.

## Tiebreakers in Depth

Ties are more common than expected. With 50 athletes and 3 events, some will have identical overall scores.

### Within-Event Tiebreakers

**For Time**:

- Primary: Completion time
- Tie: Earlier registration (prevents gaming)

**AMRAP**:

- Primary: Total reps
- Tie: Time to complete last full round

**Strength**:

- Primary: Weight achieved
- Tie: Fewer attempts

### Overall Tiebreakers

When two athletes have the same total points:

1. **Head-to-head**: Who beat whom more often?
2. **Best finish**: Who had a better single event?
3. **Most recent**: How did the latest event go?

This cascade ensures a definitive ranking without arbitrary decisions.

## The Cap + Reps System

Time caps exist for safety and scheduling. But what happens to athletes who don't finish?

### The Problem with Binary Outcomes

If all capped athletes simply receive "DNF", we lose information. An athlete who completed 200 of 225 reps deserves better placement than one who completed 50.

### The Solution

**CAP + remaining reps**: An athlete who finished all but 25 reps scores "CAP+25". Lower remaining reps = better finish.

This creates continuous ranking even among capped athletes:

1. All athletes who finished (ranked by time)
2. CAP+10 (almost finished)
3. CAP+25 (close)
4. CAP+100 (far from completion)

## Real-Time Considerations

Competition scoring happens under pressure. WODsmith's design accounts for this:

### Immediate Entry

Judges enter scores as heats complete. Delay between performance and recording increases error likelihood.

### Automatic Calculation

No manual math required. Enter the raw score; WODsmith handles ranking updates.

### Error Correction

Mistakes happen. Score corrections propagate automatically—edit one score and all affected rankings recalculate.

### Audit Trail

Every score entry and modification is logged. If disputes arise, the history is available.

## The Leaderboard as Interface

How scores display matters as much as how they're calculated.

### Progressive Disclosure

Not everyone needs the same information:

- Athletes: "Where am I ranked?"
- Spectators: "Who's winning?"
- Organizers: "Any issues to address?"

WODsmith's leaderboard adapts to these needs through filtering and display options.

### Real-Time Updates

Leaderboards refresh as scores enter. Athletes see their position change immediately. This creates engagement and validates the scoring system's integrity.

---

_Continue learning: [Heat Scheduling Strategy](/concepts/heat-scheduling)_
