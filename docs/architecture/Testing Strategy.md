---
title: Testing Strategy
type: note
permalink: architecture/testing-strategy
---

# Testing Strategy

## Framework: Vitest
**Decision**: Use Vitest for testing
**Configuration**: `vitest.config.mjs` with @testing-library/jest-dom
**Execution**: Single-run mode, no watch mode
**Failure Handling**: Fail-fast configuration

## Test Types
**Unit Tests**: Server functions and components
**Integration Tests**: API endpoints and data flows
**Component Tests**: React components with @testing-library

## Test Organization
**Location**: `test/` directory with co-located test files
**Structure**: Mirror source directory structure
**Mocks**: `test/__mocks__/` for test utilities

## Testing Patterns
**Server Functions**: Test business logic in isolation
**Components**: Test user interactions and rendering
**Database**: Test schema integrity and migrations
**Actions**: Test server actions with proper mocking

## Coverage Strategy
**Focus**: Critical business logic and user flows
**Priority**: Authentication, team management, workout scheduling
**Tools**: Vitest coverage reporting
**Threshold**: No explicit requirements, focus on quality over quantity

## Test Data
**Fixtures**: Reusable test data in test files
**Database**: Clean state between tests
**Mocks**: External dependencies (auth, database)