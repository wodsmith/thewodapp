---
name: sql-batching
description: Prevent D1/SQLite "too many SQL variables" errors when using Drizzle ORM. Use this skill whenever writing database queries with `inArray()`, bulk inserts/updates, or any query with dynamic arrays. Critical for queries where array size is unbounded (user teams, registrations, IDs from prior queries).
---

# SQL Batching Pattern

D1/SQLite has a 999 variable limit. Use `@/utils/batch-query.ts` utilities to batch queries.

## When to Batch

**Always batch when:**
- Using `inArray()` with arrays from user data or prior queries
- Array size is unbounded (team memberships, registrations, results)
- Bulk operations with dynamic row counts

**Safe to skip when:**
- Array is hardcoded/constant
- Array has guaranteed small upper bound (<100 items)

## Usage

```typescript
import { autochunk, autochunkFirst } from "@/utils/batch-query"

// findMany - returns flattened results
const results = await autochunk(
  { items: ids, otherParametersCount: 1 }, // count other WHERE params
  async (chunk) => db.query.table.findMany({
    where: and(
      eq(table.field, value), // this counts as 1 param
      inArray(table.id, chunk),
    ),
  }),
)

// findFirst - stops on first match
const result = await autochunkFirst(
  { items: ids },
  async (chunk) => db.query.table.findFirst({
    where: inArray(table.id, chunk),
  }),
)
```

## For Parallel Execution

Use `chunk()` + `Promise.all` when parallel is preferred:

```typescript
import { chunk, SQL_BATCH_SIZE } from "@/utils/batch-query"

const results = (await Promise.all(
  chunk(ids, SQL_BATCH_SIZE).map((batch) =>
    db.select().from(table).where(inArray(table.id, batch))
  )
)).flat()
```

## Parameters

- `items`: Array to batch (IDs, objects)
- `otherParametersCount`: Number of other bound params in query (eq conditions, etc.)
- `SQL_BATCH_SIZE`: 500 (leaves headroom below 999 limit)
