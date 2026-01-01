---
sidebar_position: 4
---

# Divisions Reference

Competition division configuration and requirements.

![Division list in competition setup](/img/reference/divisions-list.png)

## Creating Divisions

Divisions are created per-competition and allow athletes to select their category during registration.

### Division Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| **Name** | String | Yes | Display name (e.g., "RX", "Scaled", "Masters 40+") |
| **Description** | Text | No | Requirements or eligibility criteria |

![Expanded division showing description field](/img/reference/divisions-expanded.png)

:::note
Divisions in WodSmith are simple name + description pairs. Age restrictions, gender requirements, and capacity limits are not currently enforced through the division configuration.
:::

## Common Division Patterns

### Ability-Based Divisions

| Division | Typical Description |
|----------|---------------------|
| **RX** | Prescribed standards - full range of motion, prescribed weights |
| **Scaled** | Modified standards - reduced weights, movement substitutions |
| **Intermediate** | Between RX and Scaled - moderate modifications |
| **Foundations** | Entry level - significant modifications |

### Age Group Divisions

| Division | Typical Age Range |
|----------|-------------------|
| **Teen (14-17)** | 14-17 years |
| **Masters 35+** | 35-39 years |
| **Masters 40+** | 40-44 years |
| **Masters 45+** | 45-49 years |
| **Masters 50+** | 50-54 years |
| **Masters 55+** | 55-59 years |
| **Masters 60+** | 60+ years |

### Team Divisions

| Division | Typical Configuration |
|----------|----------------------|
| **Pairs (Mixed)** | 1 male, 1 female |
| **Pairs (Same)** | 2 same gender |
| **Team of 4** | 2 male, 2 female |
| **Team of 3** | Any combination |

## Division Management

### Reordering

Drag divisions to reorder them. The order determines:
- Display priority in registration dropdowns
- Order shown on leaderboards and schedules

### Deleting Divisions

- Divisions with registered athletes cannot be deleted
- You can still rename divisions with athletes
- Empty divisions can be deleted with the trash icon

### Best Practices

1. **Create divisions early** - Before opening registration
2. **Use clear names** - Athletes should immediately understand which division to select
3. **Add descriptions** - Include weight standards, age requirements, or other criteria
4. **Order logically** - Most common divisions first (e.g., RX before Scaled)

---

*See also: [How to Configure Divisions](/how-to/organizers/edit-competition)*
