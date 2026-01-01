# Volunteer Coordination Workflows

Workflows for managing volunteers and judge rotations.

## 1. Manage Volunteers

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/volunteers` |
| **Complexity** | High |
| **Doc Type** | How-to |
| **Prerequisites** | Competition created |

### Key Components
- `VolunteerManager` - Volunteer roster
- `ShiftScheduler` - Shift assignment
- `RoleSelector` - Volunteer role configuration
- `VolunteerCommunication` - Messaging tools

### User Actions
1. Define volunteer roles (judge, runner, check-in, etc.)
2. Invite volunteers
3. Create shift schedules
4. Assign volunteers to shifts
5. Send communications/reminders

### Documentation Requirements

**How-to Focus:**
- Set up volunteer roles for a competition
- Create and manage shifts
- Handle volunteer no-shows
- Communicate with volunteer team

**Edge Cases:**
- Volunteer no-show
- Role conflict (volunteer also competing)

---

## 2. Judge Rotations

| Attribute | Value |
|-----------|-------|
| **Route** | Component: `JudgeSchedulingContainer` |
| **Complexity** | Very High |
| **Doc Type** | How-to, Explanation |
| **Prerequisites** | Heats scheduled, judges assigned as volunteers |

### Key Components
- `JudgeSchedulingContainer` - Main rotation interface
- `JudgeAssignment` - Judge-to-lane mapping
- `RotationMatrix` - Rotation visualization
- `FatigueTracker` - Judge workload monitoring

### User Actions
1. Assign judges to events
2. Configure rotation patterns
3. Set break requirements
4. Handle judge conflicts (judging own gym's athletes)
5. Generate rotation printouts

### Documentation Requirements

**How-to Focus:**
- Set up basic judge rotation
- Handle conflict of interest rules
- Optimize for judge fatigue

**Explanation Focus:**
- Why judge rotations matter (fairness, fatigue)
- Rotation pattern strategies
- Conflict of interest policies

**Concepts to Cover:**
- Judge fatigue and scoring accuracy
- Conflict of interest prevention
- Rotation pattern mathematics

---

## CI Change Detection

```yaml
triggers:
  "src/app/(main)/compete/$competitionId/volunteers/**":
    workflows: [manage-volunteers]
    priority: medium

  "src/components/compete/judge-scheduling/**":
    workflows: [judge-rotations]
    priority: critical
```
