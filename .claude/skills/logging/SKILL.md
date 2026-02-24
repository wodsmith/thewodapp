---
name: logging
description: |
  Observability logging patterns for server functions in TanStack Start on Cloudflare Workers. Use when: adding logging to server functions, debugging request flows, tracking entity CRUD operations, correlating logs across requests, adding observability to new features, troubleshooting request tracing, working with PostHog/OpenTelemetry logs. Triggers: logInfo, logError, logWarning, withRequestContext, addRequestContextAttribute, logEntityCreated, request tracing, observability, correlation IDs.
---

# Observability Logging

Comprehensive request tracing and logging system for TanStack Start server functions on Cloudflare Workers.

## Core Concepts

- **Request Context**: AsyncLocalStorage-based context that flows through all async operations
- **Correlation IDs**: 12-character CUID2 requestIds that tie logs together
- **Entity Lifecycle Logging**: Track created/updated/deleted entities with IDs
- **OpenTelemetry Format**: Logs sent to PostHog in OTLP JSON format

## Quick Start

```typescript
import {
  logInfo,
  logWarning,
  logError,
  updateRequestContext,
  addRequestContextAttribute,
  logEntityCreated,
  logEntityUpdated,
  logEntityDeleted,
} from "@/lib/logging"
```

## Request Context

Request context is automatically established at the HTTP layer in `server.ts`. In server functions, you can:

### Update Context with User/Team

```typescript
// After authentication, add userId to all subsequent logs
updateRequestContext({ userId: session.userId, teamId: session.activeTeamId })
```

### Add Custom Attributes

For IDs not in the base context (competitionId, registrationId, etc.):

```typescript
// These appear in all logs for this request
addRequestContextAttribute("competitionId", data.competitionId)
addRequestContextAttribute("registrationId", registration.id)
```

**IMPORTANT**: `updateRequestContext` only accepts: `userId`, `teamId`, `method`, `path`, `serverFn`. For other IDs, use `addRequestContextAttribute`.

## Logging Functions

### Basic Logging

```typescript
// Informational events
logInfo({
  message: "[Competition] Division created",
  attributes: {
    competitionId,
    divisionId: division.id,
    divisionName: division.name,
  },
})

// Warnings (non-fatal issues)
logWarning({
  message: "[Auth] Invalid session token",
  attributes: { tokenPrefix: token.slice(0, 8) },
})

// Errors (include error object when available)
logError({
  message: "[Stripe] Payment failed",
  error: err,  // Will include stack trace
  attributes: { purchaseId, stripeSessionId },
})
```

### Entity Lifecycle Logging

Track CRUD operations with the entity type and ID:

```typescript
// Created
logEntityCreated({
  entity: "competition",
  id: competition.id,
  parentEntity: "team",
  parentId: teamId,
  attributes: { name: competition.name },
})

// Updated
logEntityUpdated({
  entity: "registration",
  id: registration.id,
  fields: ["status", "paidAt"],  // Which fields changed
  attributes: { newStatus: "confirmed" },
})

// Deleted
logEntityDeleted({
  entity: "heat",
  id: heatId,
  attributes: { competitionId, eventId },
})
```

## Server Function Patterns

### Pattern 1: Manual Logging (Recommended for complex functions)

```typescript
export const createRegistrationFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const db = getDb()

    // Get session and update context
    const session = await getSessionFromCookie()
    if (!session?.userId) {
      logWarning({
        message: "[Registration] Create denied - not authenticated",
        attributes: { competitionId: data.competitionId },
      })
      throw new Error("Not authenticated")
    }

    updateRequestContext({ userId: session.userId })
    addRequestContextAttribute("competitionId", data.competitionId)

    // Business logic...
    const [registration] = await db.insert(registrationsTable).values({...}).returning()

    // Log the creation
    logEntityCreated({
      entity: "registration",
      id: registration.id,
      parentEntity: "competition",
      parentId: data.competitionId,
      attributes: {
        userId: session.userId,
        divisionId: data.divisionId,
      },
    })

    return { registration }
  })
```

### Pattern 2: Wrapper for Simple Functions

```typescript
import { withServerFnLogging } from "@/lib/logging"

export const getCompetitionFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(withServerFnLogging("getCompetitionFn", async ({ data }) => {
    // Automatically logs entry, exit with timing, and errors
    return await db.query.competitionsTable.findFirst({
      where: eq(competitionsTable.id, data.competitionId),
    })
  }))
```

## Common Patterns

### Permission Denial Logging

```typescript
async function requireTeamPermission(teamId: string, permission: string): Promise<void> {
  const hasPermission = await checkPermission(teamId, permission)
  if (!hasPermission) {
    logWarning({
      message: "[Auth] Permission denied",
      attributes: {
        teamId,
        requiredPermission: permission,
      },
    })
    throw new Error(`Missing required permission: ${permission}`)
  }
}
```

### Batch Operations

```typescript
// Logging multiple created entities
logInfo({
  message: "[Heat] Bulk heats created",
  attributes: {
    competitionId,
    trackWorkoutId,
    count: heats.length,
    heatIds: heats.map(h => h.id),
  },
})
```

### External Service Calls

```typescript
import { logExternalCall } from "@/lib/logging"

try {
  const startTime = Date.now()
  await stripe.refunds.create({ payment_intent: paymentIntentId })
  logExternalCall({
    service: "stripe",
    operation: "refunds.create",
    durationMs: Date.now() - startTime,
    success: true,
    attributes: { paymentIntentId },
  })
} catch (err) {
  logExternalCall({
    service: "stripe",
    operation: "refunds.create",
    success: false,
    error: err,
    attributes: { paymentIntentId },
  })
  throw err
}
```

## Message Prefixes Convention

Use consistent prefixes for easy log filtering:

| Prefix | Use For |
|--------|---------|
| `[Competition]` | Competition CRUD operations |
| `[Registration]` | Registration flow |
| `[Score]` | Score entry operations |
| `[Heat]` | Heat management |
| `[Auth]` | Authentication/authorization |
| `[Stripe]` | Stripe webhook/payment events |
| `[HTTP]` | HTTP-level request/response |
| `[Entity]` | Generic entity lifecycle (via logEntityCreated, etc.) |
| `[ServerFn]` | Server function entry/exit |

## HTTP Logging (Already Configured)

The HTTP layer in `server.ts` automatically:
- Establishes request context with requestId
- Logs errors (status >= 400)
- Logs slow requests (>= 2 seconds)
- Skips logging for static assets

**Do not add HTTP logging in server functions** - it's handled at the entry point.

## What NOT to Log

- Successful reads without side effects (too noisy)
- Every database query (only log significant operations)
- Sensitive data (passwords, tokens, full credit card numbers)
- High-frequency operations without sampling

## Sensitive Data Handling

The logger automatically redacts fields containing: `password`, `token`, `secret`, `apiKey`, `authorization`, `creditCard`, `ssn`, `captchaToken`.

For additional sensitive data:
```typescript
logInfo({
  message: "[User] Profile updated",
  attributes: {
    userId,
    // Don't include: email, phone, address
    updatedFields: ["firstName", "lastName"],
  },
})
```

## Viewing Logs

Logs are sent to PostHog in OpenTelemetry format. In development, logs also appear in the console with the format:

```
[INFO] [abc123xyz456] [Registration] Created registration { requestId: 'abc123xyz456', userId: '...', registrationId: '...' }
```

The 12-character request ID in brackets lets you correlate all logs from a single request.
