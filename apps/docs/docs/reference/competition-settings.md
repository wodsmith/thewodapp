---
sidebar_position: 5
---

# Competition Settings Reference

All configurable options for WODsmith competitions.

## General Settings

Found on the **Edit Competition** page:

![Edit competition form](/img/reference/settings-edit-competition.png)

| Setting                 | Type     | Description                                                |
| ----------------------- | -------- | ---------------------------------------------------------- |
| **Name**                | String   | Competition display name                                   |
| **Slug**                | String   | URL identifier (globally unique, lowercase, hyphens only)  |
| **Profile Image**       | Image    | Competition logo (recommended 400x400px)                   |
| **Banner Image**        | Image    | Hero banner (recommended 1200x400px)                       |
| **Series**              | Dropdown | Optional series assignment                                 |
| **Start Date**          | Date     | Competition start date                                     |
| **End Date**            | Date     | Competition end date                                       |
| **Registration Opens**  | Date     | When registration opens (optional)                         |
| **Registration Closes** | Date     | When registration closes (optional)                        |
| **Description**         | Text     | Competition details                                        |
| **Status**              | Dropdown | Draft (organizers only) or Published (visible to athletes) |
| **Visibility**          | Dropdown | Public (listed) or Private (direct URL only)               |

## Rotation Settings

Found on the **Settings** page:

![Rotation settings](/img/reference/settings-rotation.png)

| Setting                        | Type          | Description                                |
| ------------------------------ | ------------- | ------------------------------------------ |
| **Default Heats Per Rotation** | Number (1-10) | How many heats judges work before rotating |
| **Default Lane Shift Pattern** | Dropdown      | How judges rotate between lanes            |

## Waiver Settings

Found on the **Waivers** page:

![Waiver creation dialog](/img/reference/settings-waiver-dialog.png)

| Setting      | Type      | Description                          |
| ------------ | --------- | ------------------------------------ |
| **Title**    | String    | Waiver name                          |
| **Content**  | Rich Text | Legal waiver content with formatting |
| **Required** | Checkbox  | Athletes must sign to register       |

:::note
Multiple waivers can be created per competition. Athletes sign waivers during registration.
:::

## Event Settings

Found when editing an individual event:

![Event edit form](/img/reference/settings-event-edit.png)

| Setting                 | Type              | Description                              |
| ----------------------- | ----------------- | ---------------------------------------- |
| **Event Name**          | String            | Display name                             |
| **Scheme**              | Dropdown          | For Time, AMRAP, etc.                    |
| **Score Type**          | Dropdown          | Min, Max, etc.                           |
| **Tiebreak Scheme**     | Dropdown          | Optional tiebreaker method               |
| **Description**         | Text              | Workout details (supports formatting)    |
| **Movements**           | Tags              | Track which movements are used           |
| **Points Multiplier**   | Number (1-1000%)  | Scoring weight (100 = normal)            |
| **Presented by**        | Dropdown          | Sponsor assignment                       |
| **Organizer Notes**     | Text              | Internal notes (not visible to athletes) |
| **Division Variations** | Text per division | Customize workout for each division      |

## Venue & Schedule Settings

Found on the **Schedule** page:

| Setting              | Type     | Description         |
| -------------------- | -------- | ------------------- |
| **Venue Name**       | String   | Location identifier |
| **Lanes**            | Number   | Athletes per heat   |
| **Duration**         | Number   | Minutes per heat    |
| **Heat Assignments** | Dropdown | Draft or Published  |
| **Time Cap**         | Number   | Minutes             |

## Pricing Settings

Found on the **Pricing** page (requires Stripe connection):

| Setting       | Type    | Description                  |
| ------------- | ------- | ---------------------------- |
| **Entry Fee** | Decimal | Registration fee per athlete |

:::note
Stripe connection is required to charge registration fees. Free registrations work without Stripe.
:::

## Access Control

Competition-level access is managed through:

- **Organizers**: Users who can manage the competition
- **Volunteers**: Users who can check in athletes and enter scores

---

_See also: [Divisions Reference](/reference/divisions)_
