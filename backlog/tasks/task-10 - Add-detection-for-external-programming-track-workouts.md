---
id: task-10
title: Add detection for external programming track workouts
status: In Progress
assignee:
  - '@claude'
created_date: '2025-09-10 18:51'
updated_date: '2025-09-10 20:24'
labels:
  - backend
  - feature
dependencies: []
---

## Description

Implement logic to detect when a scheduled workout comes from a programming track not owned by the current team

This function will be the foundation for determining when automatic remixing is required, ensuring that teams can only directly modify workouts they own while providing a seamless experience for external track content.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Function identifies when a scheduled workout's source track is not owned by the team
- [ ] #2 Returns both the workout and track ownership status
- [ ] #3 Handles cases where workout has no associated track
- [ ] #4 Properly checks team ownership against track owner
<!-- AC:END -->

## Implementation Plan

1. Analyze codebase structure and existing patterns for ownership checks\n2. Create function to detect external programming track workouts\n3. Define appropriate return type with workout and ownership status\n4. Add comprehensive tests\n5. Review and validate against acceptance criteria
