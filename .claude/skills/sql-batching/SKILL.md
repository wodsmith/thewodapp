---
name: sql-batching
description: Prevent D1 "too many SQL variables" errors when using Drizzle ORM. Use this skill whenever writing database queries with `inArray()`, bulk inserts/updates, or any query with dynamic arrays. Critical for queries where array size is unbounded (user teams, registrations, IDs from prior queries).
---

# SQL Batching Pattern

**CRITICAL: D1 has a 100 bound parameter limit per query** (NOT 999 like standard SQLite).
See: https://developers.cloudflare.com/d1/platform/limits/

Use `@/utils/batch-query.ts` utilities to batch queries.

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
- `SQL_BATCH_SIZE`: 100 (D1's actual limit)

## For Bulk Inserts

For bulk inserts, Drizzle includes ALL columns (including auto-generated ones like `id`, `createdAt`, `updatedAt`, `updateCounter`). Calculate batch size carefully:

```typescript
// Example: table has 12 columns (including auto-generated)
// D1 limit: 100 params
// Max rows per batch: floor(100 / 12) = 8 rows
const INSERT_BATCH_SIZE = 8

const chunks: Item[][] = []
for (let i = 0; i < items.length; i += INSERT_BATCH_SIZE) {
  chunks.push(items.slice(i, i + INSERT_BATCH_SIZE))
}

for (const chunk of chunks) {
  await db.insert(table).values(chunk.map(item => ({ ... })))
}
```

**Common gotcha**: A table with 11 columns can only insert 9 rows per batch (9 × 11 = 99 < 100).
