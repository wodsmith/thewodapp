---
name: sql-batching
description: Prevent "too many SQL variables" errors when using Drizzle ORM with PlanetScale (MySQL). Use this skill whenever writing database queries with `inArray()`, bulk inserts/updates, or any query with very large dynamic arrays. MySQL has a 65,535 parameter limit, but batching is still useful for very large datasets.
---

# SQL Batching Pattern

**MySQL (PlanetScale) has a 65,535 bound parameter limit per query.**

Use `@/utils/batch-query.ts` utilities to batch queries when dealing with very large arrays.

## When to Batch

**Batch when:**
- Using `inArray()` with arrays that could grow very large (thousands of items)
- Bulk inserts with many rows (total params = rows × columns)
- Any operation where total params could approach 65,535

**Safe to skip when:**
- Arrays are small to moderate (< 1000 items)
- Single-row inserts
- Array has a reasonable upper bound

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
- `SQL_BATCH_SIZE`: Configured batch size (check `@/utils/batch-query.ts` for current value)

## For Bulk Inserts

For bulk inserts, Drizzle includes ALL columns (including auto-generated ones). Count every column in the table schema, not just the fields you're explicitly setting.

### Calculate Batch Size

```typescript
// Formula: floor(maxParams / totalColumns)
// Example: table has 12 columns, MySQL limit 65,535
// Max rows: floor(65535 / 12) = 5,461 rows per batch
```

### Common Gotchas

1. **Nullable columns still count**: Even if you don't set them, Drizzle may send `null`
2. **Auto-generated columns count**: `$defaultFn()` columns still use a param slot
3. **PlanetScale serverless driver may return strings for numeric columns**: Always use `Number()` for count/sum results
