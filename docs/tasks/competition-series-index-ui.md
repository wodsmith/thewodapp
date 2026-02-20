# Competition Series Display on /compete Index Page

## Problem Statement

The `/compete` index page currently displays all public competitions in a flat, chronologically-sorted list. With the introduction of competition series (groups), a single series like "2026 CrossFit Semifinals" could contain up to **100 competitions** — each representing the same event at a different location (e.g., Semifinals Austin, Semifinals Nashville, Semifinals London).

This creates two problems:
1. **Page flooding**: 100 series events push all other competitions off the page
2. **Redundant noise**: The events are largely identical except for location and date — seeing them repeated 100 times isn't useful to athletes

## Current Architecture

### Schema
- **`competition_groups`** (series): Lightweight grouping — `id`, `name`, `slug`, `description`
- **`competitions`**: Each has optional `groupId` linking to a series
- Each competition has `primaryAddressId` → `addresses` table (city, state, country)
- Competition type: `in-person` or `online`

### Current Index Page (`/compete/index.tsx`)
- Fetches ALL public/published competitions via `getPublicCompetitionsFn`
- Flat list sorted by `startDate` ascending
- Each rendered as `<CompetitionRow>` with status badge, dates, location
- Search filter + "show past" toggle
- **No series awareness** — series competitions render identically to standalone ones

### Data Already Available
The `getPublicCompetitionsFn` already joins `competition_groups` and returns `group: { id, name, slug, ... }` on each competition. The address (city/state) is also loaded. The data is there — only the UI needs to change.

---

## Approach 1: Collapsed Series Card with Expand

**Concept**: By default, all competitions that belong to a series are hidden from the main list. Instead, a single "series card" row is shown. Users expand it to see individual competitions within.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ All Competitions (47) ─────────────────────────────────┐ │
│ │                                                         │ │
│ │ [Open] Summer Throwdown          Jun 14  Austin, TX  ▼  │ │ ← standalone
│ │                                                         │ │
│ │ ┌─ SERIES ──────────────────────────────────────────┐   │ │
│ │ │ 🏷  2026 CrossFit Semifinals                      │   │ │ ← collapsed series
│ │ │    12 events · Jun 1 – Jun 22 · 12 locations      │   │ │
│ │ │    [View All Locations ▼]                          │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ [Soon] Box Battle Royale         Jul 4   Denver, CO  ▼  │ │ ← standalone
│ │                                                         │ │
│ │ ┌─ SERIES ──────────────────────────────────────────┐   │ │
│ │ │ 🏷  Wodapalooza Qualifiers                        │   │ │ ← collapsed series
│ │ │    8 events · Jul 10 – Jul 24 · Online             │   │ │
│ │ │    [View All Events ▼]                             │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ [Open] Fittest in the Region     Aug 10  Miami, FL   ▼  │ │ ← standalone
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Expanded series card:
┌─ SERIES ──────────────────────────────────────────────────────┐
│ 🏷  2026 CrossFit Semifinals                                  │
│    12 events · Jun 1 – Jun 22                                 │
│    [Collapse ▲]                                               │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ [Open] Semifinals - Austin       Jun 1   Austin, TX    ▶ │ │
│ │ [Open] Semifinals - Nashville    Jun 1   Nashville, TN ▶ │ │
│ │ [Open] Semifinals - London       Jun 8   London, UK   ▶ │ │
│ │ [Open] Semifinals - Sydney       Jun 8   Sydney, AU   ▶ │ │
│ │ ... 8 more                                                │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**How it works**:
- On the client, group competitions by `groupId`
- Competitions with `groupId` → rendered inside a series card
- Competitions without `groupId` → rendered as normal `<CompetitionRow>`
- Series card shows: name, event count, date range, location count
- Expand shows nested competition rows (reusing `<CompetitionRow>`)
- Series card position in list based on earliest competition start date

**Pros**:
- Clean default: a 100-event series takes 1 row
- Familiar expand/collapse pattern
- No server changes needed — grouping is client-side
- Search still works (searches within collapsed series too)
- Reuses existing `<CompetitionRow>` component inside expanded state

**Cons**:
- Athletes must click to find their local event (two-step discovery)
- Collapsed state hides registration status of individual events
- Searching for "Austin" should surface the series card even though the series name doesn't contain "Austin"

---

## Approach 2: Series Card with Inline Location Picker

**Concept**: Series are collapsed to a single card, but the card includes an inline location picker so athletes can jump directly to their local event without expanding the full list.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ All Competitions (47) ─────────────────────────────────┐ │
│ │                                                         │ │
│ │ [Open] Summer Throwdown          Jun 14  Austin, TX  ▼  │ │
│ │                                                         │ │
│ │ ┌─ SERIES ──────────────────────────────────────────┐   │ │
│ │ │ 🏷  2026 CrossFit Semifinals                      │   │ │
│ │ │    12 events · Jun 1 – Jun 22                     │   │ │
│ │ │                                                   │   │ │
│ │ │    📍 Find your location:                         │   │ │
│ │ │    ┌──────────────────────────────────┐            │   │ │
│ │ │    │ Austin · Nashville · London ·    │            │   │ │
│ │ │    │ Sydney · Denver · Miami ·        │            │   │ │
│ │ │    │ Chicago · Portland · +4 more     │            │   │ │
│ │ │    └──────────────────────────────────┘            │   │ │
│ │ │    [View all 12 events →]                         │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ [Soon] Box Battle Royale         Jul 4   Denver, CO  ▼  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**How it works**:
- Same grouping logic as Approach 1
- Series card is slightly taller — includes clickable location chips/tags
- Each chip links directly to `/compete/{slug}` for that location's competition
- "View all events" link expands or navigates to a dedicated series page
- For online series, chips show event names/dates instead of locations

**Pros**:
- One-click to the right competition — no expand step needed
- Athletes immediately see if their city is represented
- Natural mental model: "pick your location" (like conference ticket sites)
- Still compact — takes 3-4 rows instead of 100

**Cons**:
- Series card is taller than a single competition row (but still much smaller than 100 rows)
- 100 locations won't all fit in chips — need "+N more" truncation
- More complex component to build
- For series with non-location differentiation (e.g., online qualifiers by week), chips would show dates instead of locations

---

## Approach 3: Grouped Sections with Visual Hierarchy

**Concept**: Series competitions are visually grouped under a series header, but always displayed (not collapsed). Uses visual hierarchy — indentation, background, and condensed rows — to distinguish series events from standalone competitions.

```
┌─────────────────────────────────────────────────────────────┐
│ ┌─ All Competitions (47) ─────────────────────────────────┐ │
│ │                                                         │ │
│ │ [Open] Summer Throwdown          Jun 14  Austin, TX  ▼  │ │
│ │                                                         │ │
│ │ ═══ 2026 CrossFit Semifinals (12 events) ═══════════    │ │ ← series header
│ │   ├ [Open] Austin         Jun 1    Austin, TX        ▶  │ │ ← condensed rows
│ │   ├ [Open] Nashville      Jun 1    Nashville, TN     ▶  │ │
│ │   ├ [Open] London         Jun 8    London, UK        ▶  │ │
│ │   ├ [Open] Sydney         Jun 8    Sydney, AU        ▶  │ │
│ │   └ ... +8 more  [Show all]                             │ │
│ │                                                         │ │
│ │ [Soon] Box Battle Royale         Jul 4   Denver, CO  ▼  │ │
│ │                                                         │ │
│ │ ═══ Wodapalooza Qualifiers (8 events) ══════════════    │ │
│ │   ├ [Open] Week 1         Jul 10   Online            ▶  │ │
│ │   ├ [Open] Week 2         Jul 17   Online            ▶  │ │
│ │   └ ... +6 more  [Show all]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**How it works**:
- Series header row introduces the group
- First N (3-5) competitions shown in condensed format
- "+X more" to expand the rest
- Condensed rows show abbreviated info: location name, date, status
- Visual indentation + subtle background change marks series boundaries

**Pros**:
- No hidden information — athletes see top events immediately
- Clear visual grouping makes it obvious these are related
- Progressive disclosure: see a few, click for all
- Series with small counts (2-3 events) don't need expand at all

**Cons**:
- Even showing 3-5 per series takes more space than Approach 1 or 2
- 10 series × 5 visible events = 50 rows before standalone competitions appear
- Visual hierarchy needs careful design to avoid feeling cluttered
- Condensed row format differs from standalone rows (inconsistency)

---

## Approach 4 (Recommended): Hybrid — Collapsed Cards + Location Chips + View Toggle

**Concept**: Combines the best of Approaches 1 and 2, with a view mode toggle for power users.

**Default view ("Compact")**: Series collapsed into cards with location chips
**Toggle view ("All Events")**: Flat list showing every competition individually (current behavior)

```
Default (Compact) View:
┌─────────────────────────────────────────────────────────────┐
│ ┌─ Filters ──────────────────────────────────────────────┐  │
│ │ 🔍 [Search competitions...]                            │  │
│ │ ☐ Show past    ○ Compact (default)  ○ All Events       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ All Competitions (47 events, 3 series) ───────────────┐  │
│ │                                                         │ │
│ │ [Open] Summer Throwdown          Jun 14  Austin, TX  ▼  │ │
│ │                                                         │ │
│ │ ┌─ SERIES ──────────────────────────────────────────┐   │ │
│ │ │ 2026 CrossFit Semifinals                          │   │ │
│ │ │ 12 events · Jun 1 – Jun 22 · Registration Open    │   │ │
│ │ │                                                   │   │ │
│ │ │ 📍 Austin · Nashville · London · Sydney ·         │   │ │
│ │ │    Denver · Miami · Chicago · +5 more             │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ [Soon] Box Battle Royale         Jul 4   Denver, CO  ▼  │ │
│ │                                                         │ │
│ │ ┌─ SERIES ──────────────────────────────────────────┐   │ │
│ │ │ Wodapalooza Qualifiers                            │   │ │
│ │ │ 8 events · Jul 10 – 24 · Online                   │   │ │
│ │ │                                                   │   │ │
│ │ │ 📅 Week 1 · Week 2 · Week 3 · +5 more            │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ │                                                         │ │
│ │ [Open] Fittest in the Region     Aug 10  Miami, FL   ▼  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

"All Events" toggle flips to current flat list behavior.
```

**How it works**:
1. Add `view` search param: `compact` (default) | `all`
2. In compact view:
   - Group competitions by `groupId` on the client
   - Render standalone competitions as `<CompetitionRow>` (unchanged)
   - Render series as `<CompetitionSeriesCard>` (new component)
3. `<CompetitionSeriesCard>` shows:
   - Series name
   - Summary: event count, date range, aggregate registration status
   - **For in-person series**: Location chips (city names from addresses, clickable → `/compete/{slug}`)
   - **For online series**: Event name/date chips
   - "+N more" if too many to display
4. Series card positioned in list by earliest competition `startDate`
5. Search applies to both series name AND individual competition names/locations within
6. "All Events" toggle reverts to current flat list

**Pros**:
- Best of both worlds: clean default, full list available
- Location chips solve the "find my local event" use case in one click
- Handles both in-person (location-based) and online (date-based) series gracefully
- No server changes — client-side grouping
- Progressive: works immediately with existing data
- URL-driven state (`?view=compact`) — shareable, bookmarkable
- Search still works across all competitions

**Cons**:
- Most complex to implement (but each piece is straightforward)
- Two view modes means two code paths to maintain
- Series cards with 100+ locations need truncation logic

---

## Implementation Considerations

### No Server Changes Required
The `getPublicCompetitionsFn` already returns `group` and `address` on each competition. All grouping logic can be client-side:

```typescript
// Group competitions by series
const { standalone, seriesMap } = groupCompetitions(competitions)
// seriesMap: Map<groupId, { group: CompetitionGroup, competitions: Competition[] }>
```

### Search Must Search Within Series
When searching for "Austin", the search should surface the series card if any competition within it matches — not just match on the series name itself.

### Series Card Positioning
Sort the series card into the chronological list based on its earliest competition's `startDate`, so it appears at the right time in the timeline.

### Location Chip Data
Derive from `competition.address.city` + `competition.address.stateProvince`:
- "Austin, TX" → chip text "Austin"
- "London" (no state) → chip text "London"
- Link each chip to `/compete/{competition.slug}`

### Registration Status Aggregation
For the series card summary, aggregate status across all competitions:
- If any competition has open registration → "Registration Open"
- If all are past → "Past"
- Etc.

---

## Recommendation

**Approach 4 (Hybrid)** is the strongest choice because:

1. It handles the 100-event scenario gracefully (1 card instead of 100 rows)
2. Location chips directly address the "same event, different location" pattern
3. The "All Events" toggle preserves the current behavior as an escape hatch
4. It requires no backend changes
5. It's incrementally buildable — start with collapse, add chips, add toggle

The main alternative worth considering is **Approach 1** if you want to start simpler and add the location chips later as an enhancement.
