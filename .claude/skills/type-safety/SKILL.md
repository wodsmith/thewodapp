---
name: type-safety
description: Fix type assertions and improve TypeScript type safety. Use when encountering 'as unknown as' casts, manual type definitions that duplicate schema types, or unclear type errors in database queries, especially with Drizzle ORM relations. Also use when verifying types
---

# Type Safety

Improve TypeScript type safety by eliminating unsafe type assertions and using proper types from the source.

## Core Principles

1. **Use source types** - Import types from database schemas, not manual definitions
2. **Avoid `as unknown as`** - This bypasses TypeScript's type system completely
3. **Create type aliases** - For complex types with relations, create reusable aliases
4. **Let TypeScript infer** - Single, simple casts are acceptable when inference fails

## Common Patterns

### Drizzle Query Relations

When querying with `.with()` to include relations:

**Bad:**
```typescript
const results = (await db.query.table.findMany({
  with: { relation: true }
})) as unknown as Array<{ /* 50 lines of manual type */ }>
```

**Good:**
```typescript
import { type Table, type Relation } from "@/db/schema"

type TableWithRelation = Table & { relation: Relation }

const results = (await db.query.table.findMany({
  with: { relation: true }
})) as TableWithRelation[]
```

### Fixing Type Assertions

**Process:**
1. Read the database schema to find exported types
2. Import the base types (e.g., `Team`, `TeamMembership`)
3. Create intersection type for relations: `BaseType & { relation: RelationType }`
4. Replace the cast with the new type alias

**Benefits:**
- Schema changes auto-update the types
- Reusable across the codebase
- Easier to maintain
- Type-safe property access

## When to Apply

Apply this skill when you see:
- `as unknown as` with large inline type definitions
- Manual type definitions duplicating schema shapes
- Database queries with `.with()` that have type errors
- Repeated type patterns that could be aliases

## References

For detailed examples and patterns, see:
- [references/drizzle-patterns.md](references/drizzle-patterns.md) - Common Drizzle ORM type patterns
- [references/examples.md](references/examples.md) - Real examples from the codebase
