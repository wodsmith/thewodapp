# WODsmith Observability Analysis Report

## Executive Summary

This report analyzes WODsmith's current observability practices against the modern "Wide Events" philosophy promoted by [Logging Sucks](https://loggingsucks.com/) and industry leaders like [Charity Majors](https://charity.wtf/2019/02/05/logs-vs-structured-events/). The core thesis: **traditional logging is optimized for writing, not querying**. WODsmith has foundational structured logging but significant gaps in implementing true observability.

---

## Part 1: The Wide Events Philosophy

### Core Principles from LoggingSucks.com

#### 1. "Your Logs Are Lying To You"
The fundamental problem with traditional logs:
- Developers write `console.log("Payment failed")` because it's easy in the moment
- Nobody thinks about the person searching for this at 2am during an outage
- String search treats logs as bags of characters with no understanding of structure

#### 2. Wide Events > Structured Logs
> "Structured logging means your logs are JSON instead of strings. That's table stakes. Wide events are a philosophy: one comprehensive event per request, with all context attached."

Key distinction:
- **Structured logs**: JSON format (5 fields, scattered across 20 log lines) ❌
- **Wide events**: One rich event per request with ALL context ✅

#### 3. The Canonical Log Line
Popularized by Stripe - one authoritative log line per request that contains:
- Request details (method, path, headers, body)
- User context (ID, subscription tier, feature flags)
- Timing data (total duration, DB duration, external calls)
- Business context (cart value, team ID, operation type)
- System state (cache hits, error rates, build ID)
- Correlation ID for cross-service tracing

Example:
```
canonical_log_line http_method=GET http_path=/v1/clusters duration=0.050
db_duration=0.045 db_num_queries=3 user=usr_123 team=team_456 status=200
```

#### 4. Build During Request, Emit Once
> "The key insight: build the event throughout the request lifecycle, then emit once at the end."

Anti-pattern: Emitting logs at every step
```typescript
// BAD: Multiple log emissions
log.info("Starting payment processing")
log.info("Validated payment method")
log.info("Charged customer")
log.info("Payment complete")
```

Pattern: Accumulate context, emit once
```typescript
// GOOD: Wide event accumulation
const event = createRequestEvent()
event.addField("payment_method", method)
event.addField("amount", amount)
event.addField("customer_tier", tier)
// ... more context
event.emit() // Single emission at request end
```

#### 5. High Cardinality is a Feature, Not a Bug
> "How many dimensions do you plan to emit? MANY. Hundreds! The more you have, the better you can detect and correlate rare conditions."

Traditional logging systems penalize high-cardinality fields (user IDs, request IDs). Modern columnar databases (ClickHouse, BigQuery) are designed for this.

#### 6. OpenTelemetry Isn't Magic
OTel is a protocol, not a solution:
- ✅ Standardizes telemetry format (no vendor lock-in)
- ❌ Doesn't decide WHAT to log
- ❌ Doesn't add business context automatically
- ❌ Doesn't fix your mental model

#### 7. Tail Sampling
Make sampling decisions AFTER request completion:
- Always keep errors (100% of 500s, exceptions, failures)
- Sample successful requests based on business rules
- Never lose interesting data

#### 8. Traces + Wide Events = Complementary
- **Traces**: Request flow across services (which called which)
- **Wide Events**: Context within a service
- **Ideal**: Your wide events ARE your trace spans, enriched with context

---

## Part 2: WODsmith Current State Analysis

### What's Working Well ✅

#### 1. Structured Logging Foundation
`src/lib/logging/posthog-otel-logger.ts` implements proper structured logging:
```typescript
logError({
  message: "[Stripe Webhook] Missing stripe-signature header",
  attributes: { /* structured fields */ },
  error: err,
})
```

Features:
- OpenTelemetry-compatible JSON format
- PostHog integration in production
- Console fallback in development
- Cloudflare `waitUntil()` to prevent log loss
- Error object extraction

#### 2. ZSA Error Framework
Consistent error types across server actions:
- `NOT_AUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_SERVER_ERROR`
- Structured error responses to clients
- Type-safe error handling

#### 3. Security Logging
Critical security events are logged with context:
```typescript
logError({
  message: "[Stripe OAuth] User ID mismatch - possible session hijacking attempt",
  attributes: { sessionUserId, stateUserId, teamSlug }
})
```

#### 4. Client-Side Analytics
PostHog client integration with:
- Exception capture enabled
- Custom event tracking capability
- Analytics proxy for reliability

#### 5. AI Monitoring
Braintrust integration for AI/LLM observability in chat routes.

---

### Critical Gaps ❌

#### Gap 1: Inconsistent Logging (Console vs Structured)
**The Numbers:**
- 184+ `console.error` calls across 25+ files
- Only 13 files using structured logging
- 21+ action files still on console.error

**Examples of Anti-Patterns:**
```typescript
// src/actions/competition-division-actions.ts
console.error("Failed to create division:", error)

// src/actions/generate-schedule-actions.ts
console.error("Failed to generate schedule:", error)

// src/server/judge-rotations.ts
console.log("Creating rotation...")
console.error("Rotation failed:", error)
```

**Impact:** These logs are:
- Unsearchable in production
- Missing user context, team context, request IDs
- Not correlated with other events
- Lost in Cloudflare Workers (no persistence)

#### Gap 2: No Wide Events / Request Context
**Current state:** Each operation logs independently with no shared context.

**Missing:**
- Request ID propagation
- User ID on every log
- Team ID on every log
- Request timing
- Database query counts/timing
- Feature flags in use
- Subscription tier context

#### Gap 3: No Middleware Observability
`src/middleware.ts` only adds pathname header:
```typescript
// Current: Minimal
requestHeaders.set("x-pathname", request.nextUrl.pathname)
```

**Missing:**
- Request start timestamp
- Response status code logging
- Total request duration
- Request/response size
- Geographic data (CF headers)

#### Gap 4: No Database Query Observability
Zero visibility into:
- Query execution time
- Number of queries per request
- Slow query detection
- Query patterns (N+1 detection)

#### Gap 5: No Performance Metrics
Missing:
- Server action execution times
- External API call durations (Stripe, AI)
- Cache hit/miss rates
- Queue processing times

#### Gap 6: No Error Boundaries
No React error boundaries for:
- Catching render errors
- Graceful degradation
- Error reporting to backend

#### Gap 7: Unused PostHog Server-Side
PostHog Node client initialized but underutilized for:
- Server-side event tracking
- User identification
- Feature flag evaluation logging

---

## Part 3: Recommendations

### Priority 1: Establish Request Context (Wide Event Foundation)

Create a request context that accumulates fields throughout the request lifecycle:

```typescript
// src/lib/observability/request-context.ts
import { AsyncLocalStorage } from "node:async_hooks"

interface RequestEvent {
  // Identity
  requestId: string
  userId?: string
  teamId?: string
  teamSlug?: string

  // Request
  method: string
  path: string
  userAgent?: string

  // Timing
  startTime: number
  dbDuration: number
  dbQueryCount: number
  externalCallDuration: number

  // Business Context
  subscriptionTier?: string
  featureFlags?: Record<string, boolean>

  // Outcome
  status?: number
  error?: string
  errorCode?: string

  // Custom fields
  fields: Record<string, unknown>
}

export const requestContext = new AsyncLocalStorage<RequestEvent>()

export function addField(key: string, value: unknown) {
  const ctx = requestContext.getStore()
  if (ctx) {
    ctx.fields[key] = value
  }
}

export function emitRequestEvent() {
  const ctx = requestContext.getStore()
  if (ctx) {
    const duration = Date.now() - ctx.startTime
    logInfo({
      message: "request.completed",
      attributes: {
        ...ctx,
        ...ctx.fields,
        duration,
      }
    })
  }
}
```

### Priority 2: Middleware Instrumentation

```typescript
// src/middleware.ts
import { requestContext, emitRequestEvent } from "@/lib/observability/request-context"
import { nanoid } from "nanoid"

export async function middleware(request: NextRequest) {
  const requestId = nanoid()
  const startTime = Date.now()

  const ctx: RequestEvent = {
    requestId,
    startTime,
    method: request.method,
    path: request.nextUrl.pathname,
    userAgent: request.headers.get("user-agent") ?? undefined,
    dbDuration: 0,
    dbQueryCount: 0,
    externalCallDuration: 0,
    fields: {},
  }

  // Add Cloudflare-specific context
  const cfData = request.cf
  if (cfData) {
    ctx.fields.country = cfData.country
    ctx.fields.city = cfData.city
    ctx.fields.colo = cfData.colo
  }

  return requestContext.run(ctx, async () => {
    try {
      const response = await NextResponse.next()
      ctx.status = response.status
      return response
    } catch (error) {
      ctx.error = error instanceof Error ? error.message : "Unknown error"
      ctx.status = 500
      throw error
    } finally {
      emitRequestEvent()
    }
  })
}
```

### Priority 3: Database Query Instrumentation

Wrap Drizzle operations to track timing:

```typescript
// src/lib/observability/db-instrumentation.ts
import { addField } from "./request-context"

export function withDbTiming<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()

  return fn().finally(() => {
    const duration = Date.now() - start
    const ctx = requestContext.getStore()
    if (ctx) {
      ctx.dbDuration += duration
      ctx.dbQueryCount++

      // Track slow queries
      if (duration > 100) {
        addField(`slow_query.${operation}`, duration)
      }
    }
  })
}

// Usage
const users = await withDbTiming("getTeamMembers", () =>
  db.select().from(users).where(eq(users.teamId, teamId))
)
```

### Priority 4: Migrate Console Logs to Structured Logging

Create a migration script/checklist for the 25+ files:

**High Priority Files (Critical Paths):**
1. `src/actions/competition-division-actions.ts`
2. `src/actions/generate-schedule-actions.ts`
3. `src/actions/competition-heat-actions.ts`
4. `src/server/stripe-connect/accounts.ts`
5. `src/server/judge-rotations.ts`

**Pattern to Apply:**
```typescript
// Before
console.error("Failed to create division:", error)

// After
import { logError } from "@/lib/logging/posthog-otel-logger"
import { addField } from "@/lib/observability/request-context"

logError({
  message: "Failed to create division",
  attributes: {
    divisionId,
    competitionId,
    teamId,
    operation: "createDivision",
  },
  error,
})
```

### Priority 5: Server Action Instrumentation

Wrap all server actions with timing and context:

```typescript
// src/lib/observability/action-wrapper.ts
export function instrumentedAction<TInput, TOutput>(
  name: string,
  action: (input: TInput) => Promise<TOutput>
) {
  return async (input: TInput): Promise<TOutput> => {
    const start = Date.now()
    addField("action", name)

    try {
      const result = await action(input)
      addField(`action.${name}.duration`, Date.now() - start)
      addField(`action.${name}.success`, true)
      return result
    } catch (error) {
      addField(`action.${name}.duration`, Date.now() - start)
      addField(`action.${name}.success`, false)
      addField(`action.${name}.error`, error instanceof Error ? error.message : "Unknown")
      throw error
    }
  }
}
```

### Priority 6: Add Error Boundaries

```typescript
// src/components/error-boundary.tsx
"use client"

import { Component, ReactNode } from "react"
import { logError } from "@/lib/logging/posthog-otel-logger"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError({
      message: "React Error Boundary caught error",
      attributes: {
        componentStack: errorInfo.componentStack,
        errorName: error.name,
      },
      error,
    })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <div>Something went wrong</div>
    }
    return this.props.children
  }
}
```

### Priority 7: External Call Instrumentation

```typescript
// src/lib/observability/external-calls.ts
export async function instrumentedFetch(
  name: string,
  url: string,
  options?: RequestInit
): Promise<Response> {
  const start = Date.now()
  addField(`external.${name}.url`, url)

  try {
    const response = await fetch(url, options)
    const duration = Date.now() - start

    addField(`external.${name}.duration`, duration)
    addField(`external.${name}.status`, response.status)

    const ctx = requestContext.getStore()
    if (ctx) {
      ctx.externalCallDuration += duration
    }

    return response
  } catch (error) {
    addField(`external.${name}.error`, error instanceof Error ? error.message : "Unknown")
    throw error
  }
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Create `src/lib/observability/` directory structure
- [ ] Implement `RequestContext` with AsyncLocalStorage
- [ ] Update middleware with request instrumentation
- [ ] Add request ID header propagation

### Phase 2: Migration (Week 2-3)
- [ ] Create ESLint rule to warn on console.log/error
- [ ] Migrate top 10 highest-traffic files to structured logging
- [ ] Add user/team context injection in auth middleware
- [ ] Implement database query timing wrapper

### Phase 3: Enhancement (Week 4)
- [ ] Add error boundaries to critical UI paths
- [ ] Implement server action instrumentation
- [ ] Add external call tracking (Stripe, AI APIs)
- [ ] Create observability dashboard in PostHog

### Phase 4: Advanced (Future)
- [ ] Implement tail sampling for high-volume events
- [ ] Add distributed tracing with trace ID propagation
- [ ] Create alerting rules based on wide event patterns
- [ ] Implement performance budgets with automated alerts

---

## Part 5: Metrics to Track Post-Implementation

| Metric | Current | Target |
|--------|---------|--------|
| Files with structured logging | 13 | 100% |
| Console.error calls | 184+ | 0 |
| Requests with full context | 0% | 100% |
| Mean fields per event | ~5 | 50+ |
| DB query visibility | None | Full |
| Error correlation rate | Low | 100% |

---

## Conclusion

WODsmith has a solid foundation with PostHog integration and OpenTelemetry-compatible structured logging. However, the implementation is inconsistent (13 files structured vs 25+ files console) and lacks the **wide events philosophy** that enables true observability.

The key mindset shift:
> "Stop thinking about logs as a debugging diary. Start thinking about them as a structured record of business events."

By implementing request context with accumulated fields, instrumenting middleware/database/external calls, and migrating all console logs to structured events, WODsmith can achieve production observability that answers unknown-unknown questions during incidents.

---

## Sources

- [Logging Sucks - Your Logs Are Lying To You](https://loggingsucks.com/)
- [Logs vs Structured Events - Charity Majors](https://charity.wtf/2019/02/05/logs-vs-structured-events/)
- [A Practitioner's Guide to Wide Events - Jeremy Morrell](https://jeremymorrell.dev/blog/a-practitioners-guide-to-wide-events/)
- [Observability Wide Events 101 - Boris Tane](https://boristane.com/blog/observability-wide-events-101/)
- [All You Need is Wide Events - Ivan Burmistrov](https://isburmistrov.substack.com/p/all-you-need-is-wide-events-not-metrics)
- [Observable Systems with Wide Events - Honeybadger](https://www.honeybadger.io/blog/observable-systems-wide-events/)
- [Structured Events Are the Basis of Observability - Honeycomb](https://www.honeycomb.io/blog/structured-events-basis-observability)
