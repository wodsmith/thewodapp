---
title: How to set up divisions and capacity
description: Add divisions, set team sizes, and manage capacity limits
type: markdown
routes:
  - /compete/organizer/$competitionId/divisions
sortOrder: 0
---

Divisions decide what athletes register into, what they pay, and which leaderboard they rank on.

**To add a division:**

1. Create it from your team's scaling groups (e.g. RX, Scaled, Masters 40+).
2. Set the **team size** — 1 for individuals, 2+ for partner/team divisions. Team size is fixed once the division is created: to change it, delete the division and create a new one (deletion is blocked once athletes are registered). Athlete transfers between divisions of different team sizes are blocked too.
3. Registration counts show next to each division as athletes sign up.

**Capacity** is enforced at registration *and* re-checked at payment:

- Set a **default max spots** for all divisions, then override per division where needed.
- The same capacity card also takes a **competition-wide registration cap** across all divisions (mirrored on the Settings page).
- In-progress checkouts briefly hold a spot, so concurrent registrations can't oversell. If a division fills while someone is paying, their payment is automatically refunded.

This page is the single source of truth for capacity — invite quotas and the public "division full" state both read from it.

**Per-division pricing** lives on the Pricing page. **Division-specific event lineups** (e.g. Teams skip Event 4) live on the Event Divisions page.
