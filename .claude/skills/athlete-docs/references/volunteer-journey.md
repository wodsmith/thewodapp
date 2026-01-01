# Volunteer Journey Workflows

Workflows for volunteer signup and coordination.

## 1. Volunteer Signup Workflow

### Route
`/c/[slug]/volunteer`

### Authentication
**Not Required** - Public signup form (creates profile if needed)

### Entry Points
- Competition landing page volunteer CTA
- Direct link (shared by organizer)
- Athlete post-registration prompt ("Want to help?")

### Flow Steps

```
1. View Available Roles
   └── Role descriptions and requirements
   
2. Select Role(s)
   ├── Judge
   ├── Timer
   ├── Runner
   ├── Check-in desk
   └── Custom roles (organizer-defined)
   
3. Select Availability
   ├── Time slots available
   └── Multiple slots can be selected
   
4. Submit Credentials (if required)
   ├── Certifications
   └── Experience level
   
5. Confirmation
   ├── Pending until organizer approves
   └── Email notification on approval
```

### Status Transitions

```
Submitted → Pending Review → Approved
                           → Declined (with reason)
                           → Waitlisted
```

### Key Differences from Registration

- No authentication required (lowers barrier)
- Multiple roles/shifts possible
- Approval workflow (not instant confirmation)
- No payment involved

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| First-time volunteer | Tutorial | "Volunteer at Your First Event" |
| Returning volunteer | How-to | "Sign Up to Volunteer" |
| Role confusion | Reference | "Volunteer Role Descriptions" |
| What to expect | Explanation | "The Volunteer Experience" |

---

## Implementation Notes

### Shared Components

These components appear across multiple workflows:
- Division selector
- Competition header
- Athlete card (leaderboard)
- Workout card (workouts, schedule)

### State Management

Key state considerations:
- Registration status (affects CTA visibility)
- User authentication (affects personalization)
- Competition phase (registration open, in-progress, completed)

### Mobile Considerations

All workflows must be mobile-friendly:
- Athletes check schedules/scores on phones
- Registration should be possible on mobile
- Leaderboard must be scannable on small screens

---

## CI Change Detection

```yaml
triggers:
  - pattern: "src/app/**/c/[slug]/volunteer/**"
    affects:
      - tutorials/volunteer-first-time.md
      - how-to/volunteer-signup.md
```
