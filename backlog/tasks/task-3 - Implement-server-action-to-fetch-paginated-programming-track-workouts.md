---
id: task-3
title: Implement server action to fetch paginated programming track workouts
status: Done
assignee:
  - '@claude'
created_date: '2025-09-09 21:59'
updated_date: '2025-09-09 22:09'
labels:
  - backend
  - server-actions
  - pagination
dependencies: []
priority: high
---

## Description

Create a server action that fetches workouts for a specific programming track with pagination support. This will handle the data fetching logic for the individual track pages with proper team filtering and error handling.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server action accepts trackId, page, and pageSize parameters
- [x] #2 Function returns paginated workouts with total count and metadata
- [x] #3 Implements proper team-based data filtering using teamId
- [x] #4 Includes proper error handling for invalid trackId or team authorization
- [x] #5 Returns workouts sorted by creation date or scheduled date
- [x] #6 Handles edge cases like empty results and invalid page numbers
<!-- AC:END -->


## Implementation Plan

1. Research current workout and track workout schema structure\n2. Study existing server action patterns in the codebase\n3. Create paginated query using Drizzle ORM with count\n4. Implement proper team authorization and error handling\n5. Add TypeScript types for response data\n6. Test with different page scenarios

## Implementation Notes

Successfully implemented paginated track workouts server action with proper ZSA pattern. Created getPaginatedTrackWorkouts function in server/programming.ts with team-based filtering, sorting by dayNumber, and proper pagination metadata. Added comprehensive error handling and input validation with 100-item page size cap. Includes scheduled workout status tracking for team context.
