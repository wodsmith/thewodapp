---
id: task-11
title: Create automatic remix function for programming track workouts
status: In Progress
assignee:
  - '@claude'
created_date: '2025-09-10 18:51'
updated_date: '2025-09-10 20:36'
labels:
  - backend
  - feature
dependencies:
  - task-10
---

## Description

Implement function to automatically create a remixed workout when modifying external track workouts

This function will handle the core remixing logic, creating a complete copy of the workout with proper ownership and references.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Creates a complete copy of the original workout with all components
- [ ] #2 Sets proper sourceWorkoutId and sourceTrackId references
- [ ] #3 Assigns ownership to the current team
- [ ] #4 Preserves all workout data (warmup, strength, conditioning, cooldown)
- [ ] #5 Returns the newly created remix with its ID
<!-- AC:END -->

## Implementation Plan

1. Analyze existing createWorkoutRemix function in src/server/workouts.ts for patterns\n2. Create createProgrammingTrackWorkoutRemix function in src/server/workouts.ts\n3. Update function to set both sourceWorkoutId and sourceTrackId\n4. Add server action in src/actions/workout-actions.ts\n5. Test the function with unit tests\n6. Verify all workout data is preserved (warmup, strength, conditioning, cooldown)\n7. Ensure proper team ownership assignment
