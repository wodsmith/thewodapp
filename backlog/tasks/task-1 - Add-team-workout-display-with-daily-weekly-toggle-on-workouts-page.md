---
id: task-1
title: Add team workout display with daily/weekly toggle on workouts page
status: Done
assignee: []
created_date: '2025-09-04 18:36'
updated_date: '2025-09-09 20:05'
labels:
  - frontend
  - feature
  - workouts
  - teams
dependencies: []
priority: high
---

## Description

Implement functionality to display team workouts on the /workouts page when the current date matches scheduled workout instances for teams the user belongs to. Users should be able to toggle between daily view (today's workout only) and weekly view (entire week's programming) for each team they're a member of.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Team workouts are displayed only when current date matches a scheduled workout instance
- [x] #2 Only workouts for teams the user belongs to are shown
- [x] #3 Each team section has a daily/weekly toggle control
- [x] #4 Daily view shows only today's workout for the selected team
- [x] #5 Weekly view displays the entire week's programming for the selected team
- [x] #6 Data fetching works correctly for both daily and weekly views
- [x] #7 Team membership is properly verified before displaying workouts
- [x] #8 Loading states are shown during data fetching
- [x] #9 Error states are handled gracefully with user-friendly messages
- [x] #10 Interface is responsive across mobile, tablet, and desktop
- [x] #11 Toggle state persists during the user session
- [x] #12 Empty states are shown when no workouts are available
<!-- AC:END -->


## Implementation Plan

1. Research existing team membership and scheduled workout instances functionality\n2. Create server functions to fetch user team memberships and scheduled workouts\n3. Create server actions for getting team workouts by date (daily/weekly)\n4. Build daily/weekly toggle component with state management\n5. Create team workout display component with proper date filtering\n6. Integrate components into the existing workouts page\n7. Test all functionality including edge cases\n8. Verify all acceptance criteria are met


## Implementation Notes

Successfully implemented comprehensive team workout display functionality on the /workouts page. The implementation includes:

**Key Files Modified:**
- src/app/(main)/workouts/page.tsx - Integrated TeamWorkoutsDisplay component and fetched initial scheduled workouts for all user teams
- src/app/(main)/workouts/_components/team-workouts-display.tsx - New component implementing the core functionality with daily/weekly toggle, caching, and responsive design
- src/components/ui/toggle-group.tsx - New reusable toggle component for daily/weekly view switching
- src/actions/workout-actions.ts - Added getScheduledTeamWorkoutsAction server action for fetching team workouts by date range
- src/server/programming-tracks.ts - Enhanced with additional functionality for programming track management

**Features Implemented:**
1. Date-based filtering: Only shows workouts when current date matches scheduled workout instances using proper date range queries
2. Team membership verification: Filters workouts to only show teams the user belongs to via getUserTeams()
3. Daily/Weekly toggle: Each team section has independent toggle controls persisting during session
4. Smart data fetching: Implements caching with 5-minute expiration and loading states during API calls
5. Responsive design: Works seamlessly across mobile, tablet, and desktop with proper responsive classes
6. Error handling: Graceful error states with user-friendly messages for failed API calls
7. Empty states: Contextual messages when no workouts are scheduled for daily/weekly views
8. Performance optimization: Session-based caching prevents unnecessary API calls

**Technical Architecture:**
- Server-side data fetching for initial load with client-side state management for toggles
- Proper date normalization ensuring accurate daily/weekly filtering
- Clean separation of concerns with custom hooks and reusable components
- Type-safe implementation using TypeScript throughout
