---
description: Review PR changes and provide comprehensive test coverage recommendations using unit, integration, and e2e testing skills
---

# PR Test Review

Review the current PR/branch changes and provide comprehensive test coverage recommendations by coordinating the three testing skills.

## Steps

### 1. Gather PR Context

First, understand what changed:

```bash
git diff main...HEAD --stat
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

### 2. Categorize Changes

Group files by test strategy needed:

| Change Type | Primary Test Strategy |
|-------------|----------------------|
| Pure functions, utilities, calculations | **Unit test** |
| Service functions with DB/API calls | **Integration test** |
| React components with providers | **Integration test** |
| Multi-step user flows, auth, checkout | **E2E test** |
| Schema changes | **Integration test** (verify queries work) |
| Server actions | **Integration test** |

### 3. Load Testing Skills

Load all three skills for comprehensive guidance:

```
skills_use(name="unit-test", context="reviewing PR for test coverage")
skills_use(name="integration-test", context="reviewing PR for test coverage")
skills_use(name="e2e-test", context="reviewing PR for test coverage")
```

### 4. Analyze Each Changed File

For each significant file changed:

1. **Identify testable units** - functions, components, flows
2. **Determine test level** - unit vs integration vs e2e
3. **Check existing coverage** - look for corresponding test files
4. **Identify gaps** - what's missing?

### 5. Generate Test Recommendations

Provide a structured report:

```markdown
## Test Coverage Analysis for PR

### Summary
- Files changed: X
- New tests needed: Y
- Existing tests to update: Z

### Unit Tests Needed
| File | Function/Logic | Test Description | Priority |
|------|---------------|------------------|----------|
| src/utils/score.ts | calculateScore | Test edge cases | High |

### Integration Tests Needed
| File | Workflow | Test Description | Priority |
|------|----------|------------------|----------|
| src/server/workouts.ts | createWorkout | Test with real DB mock | High |

### E2E Tests Needed
| Flow | Pages | Test Description | Priority |
|------|-------|------------------|----------|
| Signup | /signup → /workouts | Critical path | High |

### Existing Tests to Update
| Test File | Reason | Changes Needed |
|-----------|--------|----------------|
| test/workouts.test.ts | New field added | Add assertion for X |
```

### 6. Decision Framework

Use this to decide test level:

```
Is it a pure function with no dependencies?
  → Unit test

Does it cross module boundaries or use DB/API?
  → Integration test

Is it a critical user journey (auth, checkout, core actions)?
  → E2E test

Does the change affect existing test assertions?
  → Update existing tests
```

### 7. Priority Guidelines

**High Priority (must have before merge):**
- Revenue/auth critical paths
- Bug fixes (test reproduces the bug)
- New public APIs

**Medium Priority (should have):**
- New features with business logic
- Refactors that change behavior

**Low Priority (nice to have):**
- Internal utilities
- UI-only changes with no logic

## Output Format

Your review should include:

1. **Executive Summary** - Overall test coverage assessment
2. **Test Gap Analysis** - What's missing, organized by test type
3. **Specific Recommendations** - Concrete tests to write with examples
4. **Risk Assessment** - What could break if untested
5. **Quick Wins** - Easy tests that add high value

## Example Recommendations

### Unit Test Example
```typescript
// For: src/utils/formatScore.ts
test("formats score with units", () => {
  expect(formatScore(100, "lbs")).toBe("100 lbs")
  expect(formatScore(0, "reps")).toBe("0 reps")
})
```

### Integration Test Example
```typescript
// For: src/server/workouts.ts
test("createWorkout persists and returns workout", async () => {
  const workout = await createWorkout({ name: "Fran", teamId: "team-1" })
  expect(workout.id).toBeDefined()
  const fetched = await getWorkout(workout.id)
  expect(fetched.name).toBe("Fran")
})
```

### E2E Test Example
```typescript
// For: signup flow
test("new user can signup and reach dashboard", async ({ page }) => {
  await page.goto("/signup")
  await page.fill('[name="email"]', `test-${Date.now()}@example.com`)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL("/workouts")
})
```

## Success Criteria

- All changed files analyzed for test needs
- Clear test type recommendation for each gap
- Priority assigned to each recommendation
- Concrete examples provided for complex cases
- Risk assessment for untested changes
