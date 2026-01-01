# Competition Setup Workflows

Core workflows for creating and configuring competitions.

## 1. Create Competition

| Attribute | Value |
|-----------|-------|
| **Route** | `/compete/organizer/new` |
| **Complexity** | Medium |
| **Doc Type** | Tutorial |
| **Prerequisites** | Team membership with organizer role |

### Key Components
- `CompetitionCreateForm` - Main creation wizard
- `DateRangePicker` - Event date selection
- `VenueSelector` - Location configuration

### User Actions
1. Enter competition name and description
2. Select competition dates
3. Configure venue/location
4. Set registration window
5. Choose visibility (draft/published)

### Documentation Requirements

**Tutorial Focus:**
- Complete end-to-end flow from dashboard to created competition
- Explain each field with concrete examples
- Use fictional but realistic competition ("Spring Throwdown 2025")
- Include screenshots of each step

---

## 2. Configure Divisions

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/divisions` |
| **Complexity** | Medium |
| **Doc Type** | Tutorial |
| **Prerequisites** | Competition created |

### Key Components
- `DivisionManager` - CRUD for divisions
- `DivisionForm` - Division configuration
- `AgeGroupSelector` - Age-based filtering

### User Actions
1. Add new division
2. Set division name and description
3. Configure eligibility criteria (age, gender, skill)
4. Set athlete capacity per division
5. Order divisions for display

### Documentation Requirements

**Tutorial Focus:**
- Build on "Create Competition" tutorial
- Show common division patterns (Rx/Scaled, Male/Female/Co-ed)
- Explain capacity implications for scheduling

**How-to Focus (experienced organizers):**
- Quick division duplication
- Bulk editing division settings
- Complex eligibility rules

---

## 3. Edit Competition

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/edit` |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Competition created |

### User Actions
1. Update basic competition info
2. Change dates
3. Update venue
4. Modify description

---

## 4. Competition Settings

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/settings` |
| **Complexity** | Low |
| **Doc Type** | How-to, Reference |
| **Prerequisites** | Competition created |

### User Actions
1. Configure visibility
2. Set organizer permissions
3. Enable/disable features
4. Notification settings

---

## 5. Delete Competition

| Attribute | Value |
|-----------|-------|
| **Route** | `$competitionId/danger-zone` |
| **Complexity** | Low |
| **Doc Type** | How-to |
| **Prerequisites** | Competition created, organizer role |

### User Actions
1. Archive competition (soft delete)
2. Permanently delete (hard delete)
3. Export data before deletion

### Documentation Requirements

**How-to Focus:**
- Emphasize data export before deletion
- Explain archive vs. permanent delete
- Refund implications

---

## CI Change Detection

```yaml
triggers:
  "src/app/(main)/compete/organizer/new/**":
    workflows: [create-competition]
    priority: high

  "src/app/(main)/compete/$competitionId/divisions/**":
    workflows: [configure-divisions]
    priority: high

  "src/app/(main)/compete/$competitionId/edit/**":
    workflows: [edit-competition]
    priority: medium

  "src/app/(main)/compete/$competitionId/settings/**":
    workflows: [settings]
    priority: medium

  "src/app/(main)/compete/$competitionId/danger-zone/**":
    workflows: [delete-competition]
    priority: low
```
