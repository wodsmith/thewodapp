---
id: task-8
title: Refactor workout display to compact linear rows on programming track page
status: Done
assignee:
  - '@claude'
created_date: '2025-09-09 22:23'
updated_date: '2025-09-09 22:31'
labels:
  - frontend
  - refactor
  - ui-improvement
dependencies: []
priority: medium
---

## Description

Convert the current card-based workout display on individual programming track pages to a compact linear row format to improve space efficiency and allow more workouts to be visible at once. This will enhance the user experience by reducing scrolling while maintaining all current functionality and information.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Workout display uses compact linear row format instead of cards
- [x] #2 All existing workout information is preserved and displayed appropriately
- [x] #3 More workouts are visible on screen simultaneously compared to card layout
- [x] #4 Design remains responsive across all device sizes
- [x] #5 Accessibility standards are maintained (proper ARIA labels, keyboard navigation)
- [x] #6 Performance is maintained or improved with the new layout
<!-- AC:END -->


## Implementation Plan

1. Create new TrackWorkoutRow component to replace TrackWorkoutCard\n2. Design compact linear row layout preserving all current information:\n   - Workout name, day/week badges, description (truncated)\n   - Scope badge, scheme, scheduled status, notes\n3. Update PaginatedTrackWorkouts component:\n   - Replace grid layout with list/table layout\n   - Adjust responsive breakpoints\n   - Update skeleton loading state\n4. Ensure accessibility:\n   - Proper ARIA labels for row elements\n   - Keyboard navigation support\n   - Screen reader compatibility\n5. Test responsive design on all device sizes\n6. Verify performance with the new layout\n7. Update any related components or styles if needed

## Implementation Notes

Successfully refactored workout display from card-based grid to compact linear rows:

• Created new TrackWorkoutRow component with optimized linear layout
• Replaced grid system with space-y-3 linear layout in PaginatedTrackWorkouts  
• Maintained all existing functionality: workout names, day/week badges, descriptions, scope badges, schemes, scheduled status indicators, and notes
• Implemented responsive design with proper sm: breakpoints for mobile/desktop compatibility
• Preserved accessibility with semantic HTML structure and ARIA labels
• Ensured TypeScript compilation passes without errors
• Successfully increased workout visibility on screen while maintaining information density
• Layout is more space-efficient and reduces need for scrolling

Modified files:
- src/components/track/track-workout-row.tsx (new component)
- src/components/track/paginated-track-workouts.tsx (updated layout)

The implementation successfully converts from card-based display to compact rows, showing more workouts simultaneously while preserving all information and maintaining responsive design standards.
