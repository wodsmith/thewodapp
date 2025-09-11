---
id: task-12
title: Update scheduled workout references after remix
status: In Progress
assignee:
  - '@claude'
created_date: '2025-09-10 18:51'
updated_date: '2025-09-10 20:56'
labels:
  - backend
  - database
dependencies:
  - task-11
---

## Description

Implement logic to update scheduled workout instances to point to newly remixed workouts

This ensures that when a workout is remixed, the scheduling system properly references the new team-owned copy while maintaining the original scheduling metadata.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Updates scheduledWorkouts table to reference the remixed workout ID
- [ ] #2 Maintains original scheduling metadata (date, time, notes)
- [ ] #3 Updates only the specific scheduled instance being modified
- [ ] #4 Preserves audit trail with original workout reference
<!-- AC:END -->

## Implementation Plan

1. Analyze current trackWorkoutsTable and scheduledWorkoutInstancesTable relationships\n2. Create server function to update scheduled workout references after remix\n3. Implement logic to update trackWorkoutsTable.workoutId for remixed workouts\n4. Preserve audit trail by maintaining originalWorkoutId in metadata\n5. Add server action wrapper for the remix update function\n6. Test the implementation to ensure scheduling metadata is preserved\n7. Integrate with automatic remix function from task-11
