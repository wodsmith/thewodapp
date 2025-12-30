---
sidebar_position: 4
---

# Divisions Reference

Competition division configuration and requirements.

## Standard Divisions

### Ability-Based Divisions

| Division | Description | Typical Requirements |
|----------|-------------|---------------------|
| **RX** | Prescribed standards | Full range of motion, prescribed weights |
| **Scaled** | Modified standards | Reduced weights, movement substitutions |
| **Intermediate** | Between RX and Scaled | Moderate modifications |
| **Foundations** | Entry level | Significant modifications |

### Gender Divisions

| Division | Notes |
|----------|-------|
| **Male** | Men's standards |
| **Female** | Women's standards |
| **Non-Binary** | Athlete's choice of standards |

### Age Group Divisions

| Division | Age Range |
|----------|-----------|
| **Teen (14-15)** | 14-15 years |
| **Teen (16-17)** | 16-17 years |
| **Masters 35+** | 35-39 years |
| **Masters 40+** | 40-44 years |
| **Masters 45+** | 45-49 years |
| **Masters 50+** | 50-54 years |
| **Masters 55+** | 55-59 years |
| **Masters 60+** | 60+ years |

### Team Divisions

| Division | Configuration |
|----------|---------------|
| **Pairs (Mixed)** | 1 male, 1 female |
| **Pairs (Same)** | 2 same gender |
| **Team of 4** | 2 male, 2 female |
| **Team of 3** | Any combination |

## Division Configuration

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| **Name** | String | Display name |
| **Capacity** | Integer | Max athletes |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| **Age Min** | Integer | Minimum age |
| **Age Max** | Integer | Maximum age |
| **Gender** | Enum | M/F/Any |
| **Entry Fee** | Decimal | Division-specific pricing |
| **Description** | Text | Requirements text |

## Division Constraints

### Capacity

- 0 = Unlimited
- Positive integer = Maximum athletes
- Waitlist activates when capacity reached

### Age Verification

- Calculated from birth date
- Age as of competition date
- Age restrictions enforced at registration

### Gender Requirements

| Setting | Behavior |
|---------|----------|
| Male | Only male athletes |
| Female | Only female athletes |
| Any | No restriction |

## Division Switching

Athletes may switch divisions based on organizer rules:

| Status | Can Switch? |
|--------|-------------|
| Before registration closes | Yes, if space available |
| After registration closes | Organizer approval required |
| On competition day | Not permitted |

---

*See also: [How to Configure Divisions](/how-to/organizers/edit-competition)*
