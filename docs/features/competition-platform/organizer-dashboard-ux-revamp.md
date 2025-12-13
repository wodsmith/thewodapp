# Organizer Dashboard UX Revamp

## Overview

Revamp the `/compete/organizer` page to display series as clickable badge tags on competition cards, similar to how Linear displays project tags on issues.

## Current State

**`/compete/organizer` page:**
- Lists all competitions for the active team as a card grid
- Has a "Manage Series" button that links to `/compete/organizer/series`
- Has a "Create Competition" button (primary action)
- Shows a group filter dropdown when series exist
- Competitions ordered by `startDate DESC`

**Series display on competition cards:**
```tsx
{competition.groupId && (
  <CardDescription className="mt-1">
    Series:{" "}
    {groups.find((g) => g.id === competition.groupId)?.name || "Unknown"}
  </CardDescription>
)}
```

## Proposed Changes

### 1. Series Tags (Linear-style)

Replace the plain text series label with a clickable badge that navigates to the series detail page.

**Visual mockup:**
```
┌─────────────────────────────────────────────────────┐
│ Spring Throwdown 2025                          [...] │
│ Mar 15, 2025 - Mar 16, 2025                         │
│ [● 2025 Throwdowns]  ← clickable badge              │
│                                                      │
│ Description text here if present...                  │
└─────────────────────────────────────────────────────┘
```

**Styling (Linear-inspired):**
- Background: `bg-muted hover:bg-muted/80` (subtle gray) or violet tint
- Text: `text-xs text-muted-foreground`
- Icon: Small `FolderOpen` icon or colored dot prefix
- Padding: `px-2 py-0.5`
- Border radius: `rounded-md`
- Transition: `transition-colors`
- Clickable: Wraps in `Link` to `/compete/organizer/series/[groupId]`

**Behavior:**
- Clicking the badge navigates to `/compete/organizer/series/[groupId]`
- Series detail page shows all competitions in that series (already exists)

### 2. Remove "Manage Series" Button

The "Manage Series" button in the header will be removed since:
- Users navigate to series via the clickable tags
- The `/compete/organizer/series` page remains accessible directly if needed

### 3. Keep Group Filter Dropdown (Optional)

The existing group filter dropdown can remain for power users who want to filter competitions without navigating away. This is a secondary access pattern.

**Decision:** TBD - may remove for cleaner UI since tags provide navigation.

## File Changes

| File | Changes |
|------|---------|
| `apps/wodsmith/src/app/(compete)/compete/organizer/_components/organizer-competitions-list.tsx` | Replace series text with Linear-style clickable badge |
| `apps/wodsmith/src/app/(compete)/compete/organizer/page.tsx` | Remove "Manage Series" button from header |

## Implementation Details

### `organizer-competitions-list.tsx`

**Before (lines 172-178):**
```tsx
{competition.groupId && (
  <CardDescription className="mt-1">
    Series:{" "}
    {groups.find((g) => g.id === competition.groupId)?.name || "Unknown"}
  </CardDescription>
)}
```

**After:**
```tsx
{competition.groupId && (
  <Link
    href={`/compete/organizer/series/${competition.groupId}`}
    onClick={(e) => e.stopPropagation()}
    className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-xs text-muted-foreground transition-colors"
  >
    <FolderOpen className="h-3 w-3" />
    {groups.find((g) => g.id === competition.groupId)?.name || "Unknown"}
  </Link>
)}
```

### `page.tsx` (organizer dashboard)

**Remove (lines 84-88):**
```tsx
<Link href="/compete/organizer/series">
  <Button variant="outline" className="w-full sm:w-auto">
    Manage Series
  </Button>
</Link>
```

## Related Pages

- `/compete/organizer` - Main organizer dashboard (this change)
- `/compete/organizer/series` - Series list page (unchanged)
- `/compete/organizer/series/[groupId]` - Series detail page (unchanged)

## Status

- [ ] Implement series badge in `organizer-competitions-list.tsx`
- [ ] Remove "Manage Series" button from `page.tsx`
- [ ] Test navigation from badge to series page
- [ ] Review and decide on group filter dropdown
