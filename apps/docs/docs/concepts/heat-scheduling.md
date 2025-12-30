---
sidebar_position: 4
---

# Heat Scheduling Strategy

The art and logic of organizing athletes into heats for competition events.

## Why Heats Exist

A competition with 100 athletes can't run everyone at once. Physical constraints drive the need for heats:

- **Space**: Limited lanes or stations
- **Equipment**: Finite barbells, rowers, boxes
- **Judging**: Each athlete needs a dedicated judge
- **Visibility**: Spectators and cameras can only focus on so many athletes

Heats solve these constraints by cycling groups through the competition floor.

## The Math of Heat Scheduling

### Basic Calculations

```
Total athletes ÷ Athletes per heat = Number of heats
Number of heats × (Heat duration + Transition time) = Event duration
```

**Example**: 60 athletes, 10 per heat, 12-minute workout, 8-minute transition:
- 6 heats
- 20 minutes per cycle
- 2 hours for the event

### Compound Complexity

Multiple events multiply the problem:
- 3 events × 6 heats each = 18 heat cycles
- Athletes must be scheduled across all events
- No athlete should have back-to-back heats (insufficient recovery)

This is why heat scheduling is genuinely hard.

## Athlete Experience Considerations

### Wait Time

Long waits between heats frustrate athletes. They arrive early, warm up, cool down, warm up again...

**Ideal**: Athletes compete in events with 30-60 minutes between.

**Reality**: With many athletes and limited lanes, longer waits may be unavoidable.

**Mitigation**: Publish schedules early so athletes can plan their day.

### Heat Placement

Which heat should an athlete compete in? Different philosophies exist:

**Random assignment**: Fair but ignores other factors.

**Ranked seeding**: Put top athletes in final heats. Creates drama, builds excitement, gives spectators a climax.

**Self-selection**: Athletes choose their heat. Reduces organizer burden but can create imbalanced heats.

WodSmith supports all approaches. Organizers choose based on competition culture.

## Division Interactions

When multiple divisions compete in the same event, scheduling gets interesting.

### Separate Heats

Each division runs independently:
- RX Male heats
- RX Female heats
- Scaled Male heats
- Scaled Female heats

**Advantage**: Clear separation, easy judging (same standards per heat).

**Disadvantage**: Longer total event time.

### Mixed Heats

Combine divisions with same workout standards:
- All males together
- All females together

**Advantage**: Faster overall event.

**Disadvantage**: Judges must track individual athlete standards.

### Interleaved Heats

Alternate between divisions:
- Heat 1: RX Male
- Heat 2: RX Female
- Heat 3: RX Male
- Heat 4: RX Female
- ...

**Advantage**: Neither division waits too long between heats.

**Disadvantage**: More complex schedule to communicate.

## Judge Assignments

Each athlete typically needs a dedicated judge. This creates scheduling dependencies:

### Fixed Lane Judging

Judges stay at one lane all day:
- Simpler logistics
- Judges become fatigued
- Less expertise matching

### Rotating Judge Assignments

Judges move between heats or lanes:
- Can match judge expertise to athlete level
- More complex scheduling
- Potential for confusion

### Volunteer Considerations

Most competition judges are volunteers. Schedule design should respect their experience:
- New volunteers on early, lower-stakes heats
- Experienced judges for late, high-stakes heats
- Reasonable breaks built in

## Transition Time Reality

The time between heats looks straightforward on paper. Reality includes:

### Floor Reset

- Barbells stripped and reloaded
- Equipment positioned
- Lane markers checked

### Athlete Movement

- Previous heat clears the floor
- Next heat stages
- Emergency bathroom breaks

### Standards Brief

- Judge reviews movement standards
- Athletes ask questions
- Any equipment adjustments

**Recommendation**: Build 2-3 minutes more transition time than you think necessary. Running ahead of schedule is better than behind.

## WodSmith's Auto-Generation

WodSmith can automatically generate heat schedules. The algorithm considers:

1. **Athlete count per division**
2. **Lane capacity**
3. **Target heat duration**
4. **Transition time setting**
5. **Start time**

The result provides a starting point. Organizers almost always make adjustments based on local knowledge:
- Athlete carpool groups
- Judge availability
- Venue-specific constraints

## Common Scheduling Problems

| Problem | Cause | Solution |
|---------|-------|----------|
| Athlete double-booked | Schedule overlap | Reschedule to different heat |
| Heat too small | Division size | Combine with another heat |
| Heat too large | Aggressive capacity | Split into two heats |
| Long gaps | Uneven distribution | Rebalance heat assignments |
| No judge available | Resource constraint | Recruit additional judge or reduce heat size |

## The Day-Of Shuffle

No schedule survives contact with reality. Expect adjustments:

- **No-shows**: Lanes sit empty (acceptable)
- **Late arrivals**: Move to later heat if possible
- **Injuries**: Athlete withdraws mid-event
- **Equipment failure**: Heat delays while fixing

Build flexibility into the schedule. A 5-minute buffer per hour accumulates into real breathing room.

---

*Continue learning: [The Division System](/concepts/division-system)*
