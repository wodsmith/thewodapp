# Registration Journey Workflows

Workflows for athlete discovery and registration.

## 1. Registration Workflow

### Route
`/c/[slug]/register`

### Authentication
**Required** - User must be logged in to register

### Entry Points
- Competition landing page CTA
- Direct link (shared by organizer)
- Search results

### Flow Steps

```
1. View Competition Details
   └── Division selection visible
   
2. Select Division
   ├── RX divisions (skill-based)
   ├── Scaled divisions (modified movements)
   └── Age-group divisions (masters, teens)
   
3. Complete Registration Form
   ├── Personal info (pre-filled if returning)
   ├── Emergency contact
   ├── Waiver acceptance
   └── T-shirt size (if applicable)
   
4. Payment (if PAID competition)
   ├── Credit card via Stripe
   └── Discount codes applied here
   
5. Confirmation
   ├── Email sent
   ├── Add to calendar option
   └── Share on social
```

### Decision Points

| Decision | Options | Impact |
|----------|---------|--------|
| Division selection | RX/Scaled/Age | Affects workout standards shown |
| FREE vs PAID | Depends on competition | Payment step skipped for FREE |
| Team vs Individual | Competition setting | Additional teammate info required |

### Status Transitions

```
Initial → Pending → Confirmed
                  → Waitlisted (if capacity reached)
                  → Cancelled (by athlete)
                  → Refunded (by organizer)
```

### Error States

- **Division closed**: Division at capacity, offer alternatives
- **Payment failed**: Retry or different payment method
- **Duplicate registration**: Already registered, show existing entry
- **Competition closed**: Registration period ended

### Documentation Mapping

| Scenario | Doc Type | Title |
|----------|----------|-------|
| First-time athlete | Tutorial | "Register for Your First Competition" |
| Returning athlete | How-to | "Register for a Competition" |
| Need to update | How-to | "Update Your Registration" |
| Division confusion | Explanation | "Understanding the Division System" |
| Payment questions | Reference | "Registration Fees and Refunds" |

---

## 2. Competition Landing Workflow

### Route
`/c/[slug]`

### Authentication
**Not Required** - Public landing page

### Purpose
Entry point for all competition information. Aggregates links to other workflows.

### Page Sections

```
Hero
├── Competition name and dates
├── Location
└── Primary CTA (Register)

Quick Info
├── Registration status (open/closed/waitlist)
├── Athlete count
└── Division availability

Navigation
├── Workouts → /c/[slug]/workouts
├── Schedule → /c/[slug]/schedule
├── Leaderboard → /c/[slug]/leaderboard
├── Register → /c/[slug]/register
└── Volunteer → /c/[slug]/volunteer

Details
├── Competition description
├── Venue information
└── Organizer contact
```

---

## CI Change Detection

```yaml
triggers:
  - pattern: "src/app/**/c/[slug]/register/**"
    affects:
      - tutorials/first-registration.md
      - how-to/update-registration.md
      - how-to/change-division.md
```
