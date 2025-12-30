# Results Tracking Workflows

Workflows for viewing leaderboards and competition results.

## 1. View Leaderboard Workflow

### Route
`/c/[slug]/leaderboard`

### Authentication
**Not Required** - Public viewing

### Purpose
Athletes view live and final standings for a competition.

### Flow Steps

```
1. Navigate to Leaderboard
   └── From competition landing or schedule
   
2. View Overall Standings
   └── Default view shows overall rankings
   
3. Filter Options
   ├── By division
   ├── By event (single workout results)
   └── By athlete name (search)
   
4. View Athlete Details
   ├── All event scores
   ├── Rank per event
   └── Points breakdown
```

### Leaderboard Elements

| Element | Description |
|---------|-------------|
| Rank | Overall position |
| Athlete | Name and gym |
| Points | Total points (varies by scoring system) |
| Event scores | Individual workout results |

### Live vs Final

- **During competition**: Updates as scores are entered
- **After competition**: Final, official results

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| First time viewing | Tutorial | "Track Your Results During Competition" |
| Checking standings | How-to | "View Your Division Standings" |
| Understanding scores | Reference | "Scoring System Explained" |
| Why points work this way | Explanation | "Competition Scoring Philosophy" |

---

## Edge Cases

### Multi-Day Competitions
- Schedule shows day tabs/filters
- Registration may have day-specific options
- Leaderboard shows cumulative standings

### Team Competitions
- Registration collects teammate info
- Leaderboard shows team entries
- Schedule shows team heat assignments

### Virtual/Online Competitions
- No physical location
- Score submission workflow differs
- Leaderboard may have verification status

### Waitlist Flow

```
Capacity reached → Athlete joins waitlist
                → Spot opens (cancellation)
                → Next waitlisted athlete notified
                → 24h to confirm or spot goes to next
```

---

## CI Change Detection

```yaml
triggers:
  - pattern: "src/app/**/c/[slug]/leaderboard/**"
    affects:
      - how-to/check-standings.md
      - tutorials/track-results.md
      - reference/scoring-rules.md
```
