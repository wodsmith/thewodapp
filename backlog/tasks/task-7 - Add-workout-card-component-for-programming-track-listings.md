---
id: task-7
title: Add workout card component for programming track listings
status: Done
assignee:
  - '@claude'
created_date: '2025-09-09 22:00'
updated_date: '2025-09-09 22:20'
labels:
  - frontend
  - components
  - ui
dependencies: []
priority: medium
---

## Description

Create a dedicated workout card component that displays workout information in the programming track listings. This component will be reusable across different parts of the application and follow consistent design patterns.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workout card displays workout name, date, and workout type
- [x] #2 Card shows workout description preview (truncated if long)
- [x] #3 Includes proper formatting for workout dates and times
- [x] #4 Card design is consistent with existing application UI patterns
- [x] #5 Component is responsive and works on mobile devices
- [x] #6 Cards are accessible with proper ARIA labels and keyboard navigation
- [x] #7 Loading skeleton state is included for better UX
<!-- AC:END -->


## Implementation Plan

1. Analyze existing card components for consistency\n2. Create TrackWorkoutCard component in src/components/programming/\n3. Define props interface based on PaginatedTrackWorkoutsResult data\n4. Implement responsive design with proper mobile layout\n5. Add accessibility features (ARIA labels, keyboard nav)\n6. Create loading skeleton variant\n7. Test component with different workout types and data


## Implementation Notes

Created TrackWorkoutCard component with comprehensive workout display including name, day/week numbers, description, scheduling status, and notes. Includes skeleton loading variant for smooth loading experience. Component follows Shadcn UI patterns with proper responsive design and hover states.
