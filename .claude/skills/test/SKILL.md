---
name: test
description: Primary entry point for testing guidance. Routes to appropriate test type (unit, integration, E2E) based on what you're testing. Use when asked about "test", "testing", "write tests", "TDD", or test strategy. Embeds Testing Trophy philosophy and TDD Red-Green-Refactor as core discipline.
---

# Testing (Router Skill)

**"Write tests. Not too many. Mostly integration."** — Kent C. Dodds

This skill routes you to the right testing approach. TDD is non-negotiable for swarm work.

## Testing Trophy

```
      /\
     /  \  E2E (slow, high confidence)
    /----\  5-10 critical path tests
   / INT  \ Integration (SWEET SPOT)
  /--------\ Test real interactions
 |  UNIT  | Unit (fast, focused)
 |________| Pure logic, no mocks
  STATIC   Lint + TypeScript
```

**Philosophy:**
- **Static** catches typos and type errors (free, instant feedback)
- **Unit** tests pure logic in isolation (fast, focused, many tests)
- **Integration** tests real interactions (sweet spot, highest ROI)
- **E2E** tests critical user journeys (slow, expensive, few tests)

## Decision Tree: Which Test Type?

```
What are you testing?
│
├─ Pure function / calculation / business logic?
│  └─ Use: unit-test (fast, no mocking needed)
│     When: calculateScore(), formatDate(), pure validators
│
├─ Multi-component workflow / database operations / React with providers?
│  └─ Use: integration-test (real interactions, less mocking)
│     When: server actions, form submissions, API endpoints, context-heavy components
│
└─ Critical user journey / revenue flow / authentication?
   └─ Use: e2e-test (full stack, highest confidence)
      When: signup, checkout, core product actions (only happy paths!)
```

**Heuristic:** If you need >3 mocks, use integration. If it's a critical revenue path, use E2E.

## TDD Red-Green-Refactor (Non-Negotiable)

```
┌──────────────────────────┐
│ RED: Write failing test  │ ← If it passes, test is wrong
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│ GREEN: Make it pass      │ ← Minimum code, hardcode OK
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│ REFACTOR: Clean up       │ ← Tests stay green
└──────────┬───────────────┘
           │
           └─────────┐
                     │
                     ▼ REPEAT
```

**Every feature. Every bug fix. No exceptions.**

## Quick Start by Type

### Unit Test (Pure Logic)

```bash
skills_use(name="unit-test")
```

**Use when:** Testing service functions, pure calculations, webhook handlers
**Key patterns:** Arrange-Act-Assert, one assertion per concept, mock at boundaries only
**Speed:** Fastest (<1ms per test)

### Integration Test (Real Interactions)

```bash
skills_use(name="integration-test")
```

**Use when:** Testing workflows, database ops, React components with providers, server actions
**Key patterns:** Factory data, MSW for network, custom render with providers, `waitFor` for async
**Speed:** Fast (10-100ms per test)

### E2E Test (Critical Paths)

```bash
skills_use(name="e2e-test")
```

**Use when:** Testing signup, revenue flows, multi-step journeys, critical user paths
**Key patterns:** Page objects, fixtures for auth, visual regression, test isolation
**Speed:** Slow (1-10s per test)

## Anti-Patterns to Avoid

❌ **Testing implementation details** - Test behavior, not private methods or internal state
❌ **Mocking everything** - Prefer real implementations, mock only boundaries (DB, network)
❌ **One assertion per test dogma** - Multiple assertions OK if testing same concept
❌ **No tests on bug fixes** - Write failing test that reproduces bug, then fix (prevents regression)
❌ **Skipping TDD for "simple" changes** - Simple changes break things. Write test first.
❌ **Too many E2E tests** - E2E is expensive. Use integration tests for most cases.
❌ **Tests that depend on each other** - Each test must be independent, run in any order

## When to Use Which Child Skill

| Scenario | Load This Skill |
|----------|----------------|
| Testing pure functions, calculations, formatters | `unit-test` |
| Testing database queries, server actions, API routes | `integration-test` |
| Testing React components with hooks/context | `integration-test` |
| Testing signup, checkout, critical user flows | `e2e-test` |
| Breaking dependencies in legacy code | `testing-patterns` |
| Understanding characterization tests, seams | `testing-patterns` |

## Testing Patterns (Advanced)

For dependency breaking, seams, characterization tests, and safe refactoring:

```bash
skills_use(name="testing-patterns")
```

**Use when:** Adding tests to legacy code, breaking hard dependencies, understanding code through tests

## Core Principles

1. **Test behavior, not implementation** - Public API, not private methods
2. **Mock at boundaries only** - Database, network, file system. Not your own code.
3. **Fail fast, fail clear** - Good test names describe the expected behavior
4. **Tests are documentation** - Test names should read like specifications
5. **Refactor with confidence** - Tests enable safe changes

## Resources

- Child skills: `unit-test`, `integration-test`, `e2e-test`, `testing-patterns`
- Testing Trophy: https://kentcdodds.com/blog/write-tests
- TDD by Example: Kent Beck
- Working Effectively with Legacy Code: Michael Feathers (for `testing-patterns`)
