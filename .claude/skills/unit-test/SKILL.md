---
name: unit-test
description: Guide for writing unit tests with Vitest. Use when writing tests for service functions, pure logic, or webhook handlers. Covers the pure function testing pattern - mock boundaries (webhooks, DB), test business logic in isolation, verify calculated values before persistence.
---

# Unit Testing

Test pure business logic in isolation. Mock system boundaries (DB, webhooks, external APIs). Verify calculated values, not side effects.

## Core Pattern: Pure Function Testing

Structure code so calculations happen in pure functions. Side effects (DB writes, webhooks) use those results.

```typescript
// Bad: logic mixed with side effects
async function processWebhook(event: WebhookEvent) {
  const score = calculateScore(event.data)
  await db.insert(scores).values({ score, odId: event.id })
  await sendNotification(event.userId, score)
}

// Good: pure logic separated from side effects
function calculateScoreFromEvent(data: EventData): number {
  return data.reps * data.weight // pure, testable
}

async function processWebhook(event: WebhookEvent) {
  const score = calculateScoreFromEvent(event.data) // pure
  await db.insert(scores).values({ score, odId: event.id }) // side effect
  await sendNotification(event.userId, score) // side effect
}
```

Test the pure function directly - no mocks needed:

```typescript
describe("calculateScoreFromEvent", () => {
  it("calculates score from reps and weight", () => {
    const data = { reps: 10, weight: 135 }
    expect(calculateScoreFromEvent(data)).toBe(1350)
  })
})
```

## Testing Service Functions

Mock boundaries, test the logic between them:

```typescript
vi.mock("@/server/workouts", () => ({
  getWorkoutById: vi.fn(),
  updateWorkout: vi.fn(),
}))

vi.mock("@/utils/auth", () => ({
  requireVerifiedEmail: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireVerifiedEmail).mockResolvedValue(mockSession)
  vi.mocked(getWorkoutById).mockResolvedValue({ id: "w-123" } as any)
})

it("updates workout when user has permission", async () => {
  vi.mocked(updateWorkout).mockResolvedValue({} as any)

  const [data, err] = await updateWorkoutAction({
    id: "w-123",
    workout: { name: "Updated" },
  })

  expect(err).toBeNull()
  expect(updateWorkout).toHaveBeenCalledWith({
    id: "w-123",
    workout: { name: "Updated" },
  })
})
```

## Testing Webhook Handlers

Mock the webhook payload, test what gets calculated:

```typescript
const mockStripeEvent: Stripe.Event = {
  id: "evt_123",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_123",
      amount_total: 2999,
      customer: "cus_123",
      metadata: { teamId: "team-123", plan: "pro" },
    },
  },
}

describe("handleCheckoutCompleted", () => {
  it("calculates correct credit amount from plan", () => {
    const credits = calculateCreditsFromCheckout(mockStripeEvent.data.object)
    expect(credits).toBe(100) // pro plan = 100 credits
  })

  it("extracts team context from metadata", () => {
    const context = extractTeamContext(mockStripeEvent.data.object)
    expect(context).toEqual({ teamId: "team-123", plan: "pro" })
  })
})
```

## What to Test vs What to Mock

| Test directly | Mock |
|--------------|------|
| Score calculations | Database calls |
| Data transformations | External API calls |
| Validation logic | Authentication |
| Business rules | Webhook delivery |
| Encoding/decoding | File system |

## Test File Organization

```
test/
├── lib/           # Pure function tests
│   └── scoring/
│       ├── encode.test.ts
│       ├── decode.test.ts
│       └── validate.test.ts
├── server/        # Service tests (mock DB)
│   └── workouts.test.ts
└── actions/       # Action tests (mock services)
    └── workout-actions.test.ts
```

## Running Tests

```bash
pnpm test                          # all tests
pnpm test -- path/to/file.test.ts  # single file
```

## Key Principles

1. **Maximize pure functions** - easier to test, no mocks needed
2. **Mock at boundaries** - DB, auth, external APIs
3. **Test calculated values** - what will be saved, not that it was saved
4. **Keep tests fast** - slow tests don't get run
5. **Clear test names** - describe behavior, not implementation
