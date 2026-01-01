# Competition Day Workflows

Workflows for schedule viewing, heats, and check-in.

## 1. View Schedule Workflow

### Route
`/c/[slug]/schedule`

### Authentication
**Not Required** - Public viewing

### Purpose
Athletes view the competition schedule including heat times, lane assignments, and event order.

### Flow Steps

```
1. Navigate to Schedule
   └── From competition landing
   
2. View Schedule Overview
   ├── Day view (if multi-day)
   └── Event-by-event breakdown
   
3. Filter by Division (optional)
   └── Only show relevant heats
   
4. Find Your Heat
   ├── Search by name
   └── Filter by division
   
5. View Heat Details
   ├── Start time
   ├── Lane assignment
   └── Other athletes in heat
```

### Schedule Elements

| Element | Description |
|---------|-------------|
| Event | Which workout |
| Heat | Heat number within event |
| Time | Start time |
| Lane | Physical position |
| Athletes | List of competitors |

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| Viewing schedule | How-to | "View the Competition Schedule" |
| Finding your heat | How-to | "Find Your Heat Time" |
| How heats work | Explanation | "Understanding Heats and Lanes" |
| Schedule format | Reference | "Heat Schedule Format" |

---

## 2. View Workouts Workflow

### Route
`/c/[slug]/workouts`

### Authentication
**Not Required** - Public viewing

### Purpose
Athletes view the workouts including movement standards, time caps, and scoring criteria.

### Flow Steps

```
1. Navigate to Workouts
   └── From competition landing or schedule
   
2. View Workout List
   ├── Organized by event order or day
   └── Brief summary visible
   
3. Expand Workout Details
   ├── Full description
   ├── Movement standards
   ├── Time cap / rep scheme
   └── Scoring type (time, reps, load)
   
4. Filter by Division (optional)
   ├── RX standards
   ├── Scaled standards
   └── Age-group modifications
```

### Display Elements

| Element | Description |
|---------|-------------|
| Workout name | Event name (e.g., "Event 1: The Sprint") |
| Description | Movement sequence and rep scheme |
| Time cap | Maximum time allowed |
| Standards | Video/text movement standards |
| Scoring | How it's scored (lower is better, etc.) |

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| Finding workouts | How-to | "View Competition Workouts" |
| Understanding scoring | Reference | "Scoring Rules by Workout Type" |
| Movement questions | Reference | "Movement Standards" |
| Why standards differ | Explanation | "Understanding RX vs Scaled" |

---

## 3. My Schedule Workflow (Volunteers)

### Route
`/my-schedule`

### Authentication
**Required** - Must be logged in AND have volunteer registration

### Purpose
Volunteers view their personal schedule of assigned shifts.

### Visibility Conditions
- User must be authenticated
- User must have at least one approved volunteer registration
- Only shows shifts for approved assignments

### Flow Steps

```
1. Navigate to My Schedule
   └── From dashboard or navigation
   
2. View Personal Assignments
   ├── Competition name
   ├── Role assigned
   ├── Time slot
   └── Location/station
   
3. View Shift Details
   ├── Reporting location
   ├── Contact person
   └── Notes from organizer
```

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| Accessing schedule | How-to | "View Your Volunteer Schedule" |
| Schedule empty | How-to | "Sign Up for Volunteer Shifts" |
| Day-of use | How-to | "Check Your Assignment on Event Day" |

---

## CI Change Detection

```yaml
triggers:
  - pattern: "src/app/**/c/[slug]/schedule/**"
    affects:
      - how-to/view-schedule.md
      - explanation/how-heats-work.md

  - pattern: "src/app/**/c/[slug]/workouts/**"
    affects:
      - how-to/view-workouts.md
      - reference/division-requirements.md
      - reference/scoring-rules.md
```
