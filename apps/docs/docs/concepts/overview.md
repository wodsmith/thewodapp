---
sidebar_position: 1
---

# WODsmith Core Concepts

This page explains the fundamental ideas behind WODsmith and how its components work together.

## The WODsmith Model

WODsmith is built around a simple hierarchy:

```
Teams → Members → Workouts → Scores
        ↓
   Competitions → Divisions → Events → Results
```

Understanding this model helps you navigate the platform and make sense of how features connect.

## Teams: The Foundation

Every organization in WODsmith operates as a **team**. This design emerged from a key insight: CrossFit gyms, coaches, and athletes often work across multiple organizations.

A coach might program for two affiliate gyms. An athlete might train at their home gym but compete for another. Competition organizers work with athletes from dozens of gyms.

The team model accommodates this reality. Rather than forcing users into a single organization, WODsmith allows membership in multiple teams with different roles in each.

### Why Multi-Tenancy Matters

Traditional gym software assumes one user belongs to one gym. This creates friction:

- Coaches can't share programming between gyms
- Athletes need multiple accounts
- Competition data stays siloed

WODsmith's multi-tenant architecture eliminates these problems while maintaining proper data isolation between organizations.

## Workouts: Structured Flexibility

CrossFit workouts follow predictable patterns, but each gym expresses them differently. WODsmith balances structure with flexibility.

### The Workout Type System

Every workout fits into a type: AMRAP, For Time, EMOM, Strength, and others. This isn't just categorization—it determines:

- **Scoring logic**: How results are recorded and compared
- **Tiebreaker rules**: How equal scores resolve
- **Display format**: How the workout appears to athletes

By understanding the type, WODsmith automatically handles scoring complexity that would otherwise require manual calculation.

### Movements and the Library

Workouts contain movements from a shared library. This approach provides several benefits:

1. **Consistency**: "Pull-up" means the same thing everywhere
2. **Tracking**: Athletes can see all their pull-up work across workouts
3. **Standards**: Movement standards link to video demonstrations
4. **Scaling**: Each movement knows its common substitutions

## Programming: Structure Over Time

While individual workouts are points in time, **programming** provides structure across time.

### Tracks and Purpose

A programming track represents a distinct training purpose: the daily WOD, competition preparation, foundations classes. Separating tracks allows:

- Different audiences to see relevant programming
- Coaches to plan specialized training cycles
- Historical analysis of training patterns

### The Calendar as Interface

Most gym members think in calendar terms: "What's the workout tomorrow?" WODsmith's programming interface mirrors this mental model.

Rather than navigating complex menus, coaches drop workouts onto dates. Athletes see their training laid out like any other calendar.

## Competitions: Events at Scale

Competitions amplify normal gym operations: more athletes, more structure, higher stakes. WODsmith's competition features address these differences.

### Divisions: Organized Fairness

Not every athlete competes under the same standards. Divisions create fair competition by grouping athletes appropriately.

The division system handles:

- **Ability levels**: RX, Scaled, Intermediate
- **Age groups**: Masters, Teens
- **Team formats**: Pairs, Teams of 4
- **Custom combinations**: Any criteria organizers need

### Heats: Managing Time and Space

A competition with 100 athletes can't run everyone simultaneously. Heats solve the logistics problem by scheduling small groups.

Heat management considers:

- **Lane availability**: Physical space constraints
- **Judge capacity**: Scoring resources
- **Transition time**: Realistic turnaround between groups
- **Athlete experience**: Reasonable wait times

### Scoring: Truth Under Pressure

Competition scoring must be fast, accurate, and auditable. WODsmith's scoring system prioritizes:

1. **Real-time entry**: Judges input scores immediately
2. **Automatic ranking**: No manual calculations
3. **Tiebreaker application**: Consistent rule enforcement
4. **Audit trail**: Every change tracked

## The WODsmith Philosophy

Several principles guide WODsmith's design:

### Gym-First Thinking

Features emerge from real gym needs, not abstract software patterns. Every decision asks: "Does this help a gym owner, coach, or athlete?"

### Progressive Complexity

New users start with simple features. Advanced capabilities reveal themselves as needed. A first-time user shouldn't feel overwhelmed by competition management tools.

### Data Belongs to Users

Athletes own their scores. Gyms own their programming. Competitions own their results. WODsmith facilitates access and analysis without claiming ownership.

### Built for Scale

From a small garage gym to a multi-location affiliate, from an in-house throwdown to a national competition—the same platform handles both extremes.

---

_Continue learning: [The Competition Day Flow](/concepts/competition-flow)_
