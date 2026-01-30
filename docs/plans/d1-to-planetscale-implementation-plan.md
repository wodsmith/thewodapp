# D1 to PlanetScale Migration Implementation Plan

## Overview

This document outlines the step-by-step implementation plan for migrating the WODsmith application from Cloudflare D1 (SQLite) to PlanetScale (MySQL/Vitess). The migration addresses scalability requirements while maintaining application reliability through Cloudflare Hyperdrive for connection pooling.

**Estimated Duration:** 4-6 weeks
**Risk Level:** High (production database migration)
**Rollback Window:** 24 hours post-cutover

---

## Phase 1: Infrastructure Setup (Week 1)

### 1.1 PlanetScale Account and Database Creation

**Actions:**
1. Create PlanetScale account at [planetscale.com](https://planetscale.com)
2. Create a new database named `wodsmith-db`
3. Create development branch: `dev`
4. Create staging branch: `staging`
5. Note the connection strings for each branch

**PlanetScale CLI Setup:**
```bash
# Install PlanetScale CLI
brew install planetscale/tap/pscale

# Authenticate
pscale auth login

# Create database
pscale database create wodsmith-db --region us-east

# Create branches
pscale branch create wodsmith-db dev
pscale branch create wodsmith-db staging
```

### 1.2 Hyperdrive Configuration

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/wrangler.jsonc`

Add Hyperdrive binding after the existing D1 configuration:

```jsonc
{
  // ... existing config ...

  /**
   * Hyperdrive Configuration
   * Connection pooling for PlanetScale MySQL
   */
  "hyperdrive": [
    {
      "binding": "HYPERDRIVE",
      "id": "<your-hyperdrive-config-id>"
    }
  ]
}
```

**Create Hyperdrive Configuration:**
```bash
# Get PlanetScale connection string (format: mysql://user:pass@host/db?ssl={"rejectUnauthorized":true})
pscale connect wodsmith-db main --execute 'SELECT 1'

# Create Hyperdrive configuration
wrangler hyperdrive create wodsmith-hyperdrive \
  --connection-string="mysql://user:password@aws.connect.psdb.cloud/wodsmith-db?ssl={\"rejectUnauthorized\":true}"
```

### 1.3 Environment Variable Updates

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/.dev.vars.example`

Add new PlanetScale variables:

```bash
### PlanetScale Configuration
# Direct connection string for migrations/schema operations
DATABASE_URL=mysql://user:password@aws.connect.psdb.cloud/wodsmith-db?ssl={"rejectUnauthorized":true}

# Hyperdrive connection (used at runtime via binding)
# This is auto-injected by wrangler from the Hyperdrive binding
```

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/alchemy.run.ts`

Add Hyperdrive binding to the TanStackStart configuration (around line 481):

```typescript
// Add import at top
import { Hyperdrive } from "alchemy/cloudflare"

// Create Hyperdrive resource (after db definition, ~line 235)
const hyperdrive = await Hyperdrive("wodsmith-hyperdrive", {
  origin: {
    host: process.env.PLANETSCALE_HOST!,
    port: 3306,
    database: "wodsmith-db",
    user: process.env.PLANETSCALE_USER!,
    password: alchemy.secret(process.env.PLANETSCALE_PASSWORD!),
  },
  adopt: true,
})

// Add to TanStackStart bindings (in the bindings object ~line 481)
bindings: {
  // ... existing bindings ...

  /** Hyperdrive binding for PlanetScale connection pooling */
  HYPERDRIVE: hyperdrive,
}
```

### 1.4 Local Development Setup

**Install MySQL locally for development:**
```bash
# macOS
brew install mysql

# Start MySQL service
brew services start mysql

# Create local development database
mysql -u root -e "CREATE DATABASE wodsmith_dev;"
```

**Alternative: Use Docker:**
```bash
# docker-compose.yml in apps/wodsmith-start/
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: devpassword
      MYSQL_DATABASE: wodsmith_dev
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

---

## Phase 2: Schema Migration (Week 1-2)

### 2.1 Create MySQL Schema Files

**New Directory Structure:**
```
apps/wodsmith-start/src/db/
├── index.ts              # Updated for MySQL
├── schema.ts             # Re-exports (unchanged)
├── schemas/              # Updated to mysql-core
│   ├── common.ts         # ULID generation + MySQL columns
│   ├── users.ts          # mysql-core version
│   ├── teams.ts          # mysql-core version
│   └── ... (all other schema files)
├── migrations/           # Keep SQLite migrations for reference
└── mysql-migrations/     # New MySQL migrations
```

### 2.2 Update Common Columns and ID Generation

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/db/schemas/common.ts`

Transform from SQLite to MySQL:

```typescript
// BEFORE (SQLite)
import { createId } from "@paralleldrive/cuid2"
import { sql } from "drizzle-orm"
import { integer } from "drizzle-orm/sqlite-core"

export const commonColumns = {
  createdAt: integer({
    mode: "timestamp",
  })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer({
    mode: "timestamp",
  })
    .$onUpdateFn(() => new Date())
    .notNull(),
  updateCounter: integer()
    .default(0)
    .$onUpdate(() => sql`updateCounter + 1`),
}

// AFTER (MySQL with ULIDs)
import { ulid } from "ulid"
import { sql } from "drizzle-orm"
import { datetime, int } from "drizzle-orm/mysql-core"

export const commonColumns = {
  createdAt: datetime("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: datetime("updated_at")
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
  updateCounter: int("update_counter")
    .default(0)
    .$onUpdate(() => sql`update_counter + 1`),
}

// Update ID generators to use ULID
export const createUserId = () => `usr_${ulid()}`
export const createTeamId = () => `team_${ulid()}`
export const createPasskeyId = () => `pkey_${ulid()}`
// ... all other ID generators unchanged (already use string prefixes)
```

### 2.3 Transform Schema Files to MySQL

**Example: users.ts transformation**

```typescript
// BEFORE (SQLite)
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const userTable = sqliteTable(
  "user",
  {
    ...commonColumns,
    id: text()
      .primaryKey()
      .$defaultFn(() => createUserId())
      .notNull(),
    firstName: text({ length: 255 }),
    emailVerified: integer({ mode: "timestamp" }),
    currentCredits: integer().default(0).notNull(),
    // ...
  },
  (table) => [
    index("email_idx").on(table.email),
  ]
)

// AFTER (MySQL)
import { index, datetime, mysqlTable, varchar, int, boolean } from "drizzle-orm/mysql-core"

export const userTable = mysqlTable(
  "user",
  {
    ...commonColumns,
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => createUserId())
      .notNull(),
    firstName: varchar("first_name", { length: 255 }),
    emailVerified: datetime("email_verified"),
    currentCredits: int("current_credits").default(0).notNull(),
    // Boolean fields use MySQL boolean (tinyint(1))
    isActive: boolean("is_active").default(true).notNull(),
    // ...
  },
  (table) => [
    index("email_idx").on(table.email),
  ]
)
```

**Key Transformations for Each Schema File:**

| SQLite Type | MySQL Type | Notes |
|-------------|------------|-------|
| `sqliteTable` | `mysqlTable` | Table definition |
| `text()` | `varchar({ length: N })` | Specify length (255 default) |
| `text()` for IDs | `varchar({ length: 36 })` | ULIDs are 26 chars, add buffer |
| `text({ length: N })` | `varchar({ length: N })` | Direct mapping |
| `integer()` | `int()` | Standard integers |
| `integer({ mode: 'boolean' })` | `boolean()` | MySQL boolean (tinyint) |
| `integer({ mode: 'timestamp' })` | `datetime()` | MySQL datetime |
| `text({ mode: 'json' })` | `json()` | MySQL native JSON |
| `blob()` | `blob()` or `varbinary({ length: N })` | Binary data |

### 2.4 Update Drizzle Configuration

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/drizzle.config.ts`

```typescript
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./src/db/mysql-migrations",
  schema: "./src/db/schema.ts",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // PlanetScale workflow: push to branch, then deploy request
  // Don't use migrations directly against production
})
```

### 2.5 Install Required Dependencies

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/package.json`

Add new dependencies:

```json
{
  "dependencies": {
    "mysql2": "^3.9.0",
    "ulid": "^2.3.0"
  }
}
```

Run:
```bash
cd apps/wodsmith-start && pnpm add mysql2 ulid
```

### 2.6 Database Scripts Updates

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/package.json`

Update database scripts:

```json
{
  "scripts": {
    "db:push": "drizzle-kit push",
    "db:push:ps": "drizzle-kit push --config drizzle.config.ts",
    "db:generate": "drizzle-kit generate",
    "db:studio": "drizzle-kit studio",
    "db:studio:ps": "drizzle-kit studio --config drizzle.config.ts"
  }
}
```

---

## Phase 3: Application Code Refactoring (Week 2-3)

### 3.1 Database Connection Changes

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/db/index.ts`

```typescript
// BEFORE (D1)
import { env } from "cloudflare:workers"
import type { DrizzleD1Database } from "drizzle-orm/d1"
import { drizzle } from "drizzle-orm/d1"
import * as schema from "./schema"

export const getDb = (): DrizzleD1Database<typeof schema> => {
  if (!env.DB) {
    throw new Error('D1 database binding "DB" not found.')
  }
  return drizzle(env.DB, { schema, logger: true })
}

// AFTER (PlanetScale via Hyperdrive)
import { env } from "cloudflare:workers"
import { drizzle } from "drizzle-orm/mysql2"
import mysql from "mysql2/promise"
import * as schema from "./schema"

let connectionPool: mysql.Pool | null = null

export const getDb = () => {
  if (!env.HYPERDRIVE) {
    throw new Error('Hyperdrive binding "HYPERDRIVE" not found.')
  }

  // Create connection pool using Hyperdrive connection string
  if (!connectionPool) {
    connectionPool = mysql.createPool({
      uri: env.HYPERDRIVE.connectionString,
      // Hyperdrive handles pooling, but we need a pool for mysql2/drizzle
      connectionLimit: 1,
      // Required for Hyperdrive proxy
      ssl: { rejectUnauthorized: false },
    })
  }

  return drizzle(connectionPool, { schema, mode: "default", logger: true })
}

export { env }
```

### 3.2 Query Builder SQL Template Audits

**Files to audit for raw SQL usage:**

Based on the grep results, these files use `sql` template literals:

1. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/notifications/submission-window.ts`
2. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server-fns/competition-detail-fns.ts`
3. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server-fns/admin-team-fns.ts`
4. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/db/schemas/common.ts`
5. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/registration.ts`
6. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server-fns/competition-divisions-fns.ts`
7. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server-fns/workout-fns.ts`
8. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/workouts.ts`
9. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/commerce/fee-calculator.ts`

**Audit each file for:**

| SQLite Pattern | MySQL Replacement |
|----------------|-------------------|
| `strftime('%Y-%m-%d', column)` | `DATE_FORMAT(column, '%Y-%m-%d')` |
| `col1 \|\| ' ' \|\| col2` | `CONCAT(col1, ' ', col2)` |
| `datetime('now')` | `NOW()` |
| `date('now')` | `CURDATE()` |
| `julianday()` | `DATEDIFF()` or `TIMESTAMPDIFF()` |
| `IFNULL()` | `COALESCE()` (both work, but COALESCE is standard) |
| `GROUP_CONCAT()` | `GROUP_CONCAT()` (same, but separator syntax differs) |

**Example transformation in common.ts:**

```typescript
// BEFORE (SQLite)
updateCounter: integer()
  .default(0)
  .$onUpdate(() => sql`updateCounter + 1`),

// AFTER (MySQL) - snake_case column names
updateCounter: int("update_counter")
  .default(0)
  .$onUpdate(() => sql`update_counter + 1`),
```

### 3.3 Date Function Migrations

Create a utility file for date operations:

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/utils/sql-date-utils.ts`

```typescript
import { sql } from "drizzle-orm"

/**
 * MySQL-compatible date formatting
 * Replaces SQLite strftime
 */
export const formatDate = (column: any, format: string) => {
  // Convert strftime format to MySQL DATE_FORMAT
  const mysqlFormat = format
    .replace('%Y', '%Y')
    .replace('%m', '%m')
    .replace('%d', '%d')
    .replace('%H', '%H')
    .replace('%M', '%i')
    .replace('%S', '%S')

  return sql`DATE_FORMAT(${column}, ${mysqlFormat})`
}

/**
 * MySQL-compatible current timestamp
 */
export const now = () => sql`NOW()`

/**
 * MySQL-compatible date difference in days
 */
export const dateDiffDays = (date1: any, date2: any) =>
  sql`DATEDIFF(${date1}, ${date2})`
```

### 3.4 Update Batch Query Utility

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/utils/batch-query.ts`

The existing `autochunk` utility handles D1's 100 parameter limit. PlanetScale/MySQL has a much higher limit (65,535 parameters), but the utility is still useful for large datasets:

```typescript
/**
 * MySQL has a 65,535 placeholder limit, but practical batch sizes
 * should be smaller for memory and performance.
 *
 * For PlanetScale, we recommend batches of 1000-5000 items.
 */
export const SQL_BATCH_SIZE = 1000  // Changed from 100
const MAX_PARAMETERS = 10000  // Changed from 100

// Rest of the file remains the same but with updated limits
```

---

## Phase 4: Pagination Refactoring (Week 3)

### 4.1 Identify Offset-Based Pagination

Based on the codebase search, offset pagination exists in:

1. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/workouts.ts` (line 172)
2. `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server-fns/workout-fns.ts` (line 308)

### 4.2 Implement Cursor-Based Pagination Utility

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/utils/cursor-pagination.ts`

```typescript
import { sql, desc, asc, and, or, lt, gt, eq } from "drizzle-orm"
import type { AnyColumn } from "drizzle-orm"

/**
 * Cursor structure for pagination
 */
export interface Cursor {
  /** Primary sort value (e.g., createdAt timestamp) */
  sortValue: string | number
  /** Tie-breaker ID */
  id: string
}

/**
 * Encode cursor for client transmission
 */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url")
}

/**
 * Decode cursor from client
 */
export function decodeCursor(encoded: string): Cursor | null {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString())
  } catch {
    return null
  }
}

/**
 * Build cursor-based WHERE clause for pagination
 * Uses tuple comparison: (sortCol, idCol) < (sortValue, idValue)
 *
 * @param sortColumn - Column to sort by (e.g., createdAt)
 * @param idColumn - ID column for tie-breaking
 * @param cursor - Decoded cursor from previous page
 * @param direction - 'forward' (older items) or 'backward' (newer items)
 */
export function buildCursorWhere(
  sortColumn: AnyColumn,
  idColumn: AnyColumn,
  cursor: Cursor | null,
  direction: "forward" | "backward" = "forward"
) {
  if (!cursor) return undefined

  // For descending order (newest first), "next page" means < cursor
  // For ascending order (oldest first), "next page" means > cursor
  const comparison = direction === "forward"
    ? sql`(${sortColumn}, ${idColumn}) < (${cursor.sortValue}, ${cursor.id})`
    : sql`(${sortColumn}, ${idColumn}) > (${cursor.sortValue}, ${cursor.id})`

  return comparison
}

/**
 * Paginated response structure
 */
export interface CursorPaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  prevCursor: string | null
  hasMore: boolean
}

/**
 * Create paginated response from query results
 */
export function createCursorResponse<T extends { id: string }>(
  items: T[],
  limit: number,
  getSortValue: (item: T) => string | number
): CursorPaginatedResult<T> {
  const hasMore = items.length > limit
  const pageItems = hasMore ? items.slice(0, limit) : items

  const lastItem = pageItems[pageItems.length - 1]
  const firstItem = pageItems[0]

  return {
    items: pageItems,
    nextCursor: lastItem
      ? encodeCursor({ sortValue: getSortValue(lastItem), id: lastItem.id })
      : null,
    prevCursor: firstItem
      ? encodeCursor({ sortValue: getSortValue(firstItem), id: firstItem.id })
      : null,
    hasMore,
  }
}
```

### 4.3 Refactor Workout Pagination

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/server/workouts.ts`

```typescript
// BEFORE (offset-based)
export async function findWorkoutsForTeam(params: WorkoutSearchParams) {
  // ...
  const workoutsList = await db
    .select(/* ... */)
    .from(workouts)
    .where(/* ... */)
    .orderBy(desc(workouts.updatedAt))
    .limit(limit)
    .offset(offset)  // <-- Remove this
  // ...
}

// AFTER (cursor-based)
import { buildCursorWhere, decodeCursor, createCursorResponse } from "@/utils/cursor-pagination"

export async function findWorkoutsForTeam(params: WorkoutSearchParams & {
  cursor?: string
  limit?: number
}) {
  const { cursor: cursorStr, limit = 20 } = params
  const cursor = cursorStr ? decodeCursor(cursorStr) : null

  const cursorCondition = buildCursorWhere(
    workouts.updatedAt,
    workouts.id,
    cursor,
    "forward"
  )

  const conditions = [
    ...mainConditions,
    cursorCondition,
  ].filter(Boolean)

  // Fetch limit + 1 to detect hasMore
  const workoutsList = await db
    .select(/* ... */)
    .from(workouts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(workouts.updatedAt), desc(workouts.id))
    .limit(limit + 1)

  return createCursorResponse(
    workoutsList,
    limit,
    (w) => w.updatedAt.getTime()
  )
}
```

### 4.4 Update API Schemas

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/schemas/workout-schemas.ts`

```typescript
import { z } from "zod"

// Add cursor-based pagination schema
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
})

// Update workout list schema
export const workoutListInputSchema = z.object({
  teamId: z.string(),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // Replace page/pageSize with cursor pagination
  ...cursorPaginationSchema.shape,
})
```

---

## Phase 5: ETL Pipeline (Week 3-4)

### 5.1 Create Migration Scripts Directory

```bash
mkdir -p apps/wodsmith-start/scripts/migration
```

### 5.2 Data Extraction Script

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/scripts/migration/extract-d1.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Extract data from D1 database for migration to PlanetScale
 * Run with: pnpm tsx scripts/migration/extract-d1.ts
 */

import Database from "better-sqlite3"
import fs from "node:fs"
import path from "node:path"

// Tables in dependency order (parents before children)
const TABLES_IN_ORDER = [
  "user",
  "passkey_credential",
  "team",
  "team_membership",
  "team_role",
  "team_invitation",
  "competition_groups",
  "competitions",
  "competition_divisions",
  "competition_registrations",
  "competition_registration_teammates",
  // ... add all other tables
]

interface ExtractionResult {
  table: string
  rowCount: number
  data: Record<string, unknown>[]
}

async function extractTable(
  db: Database.Database,
  tableName: string
): Promise<ExtractionResult> {
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all()
  console.log(`Extracted ${rows.length} rows from ${tableName}`)
  return {
    table: tableName,
    rowCount: rows.length,
    data: rows as Record<string, unknown>[],
  }
}

async function main() {
  // Find local D1 database
  const d1Path = findD1Database()
  if (!d1Path) {
    console.error("D1 database not found. Run 'pnpm alchemy:dev' first.")
    process.exit(1)
  }

  const db = new Database(d1Path, { readonly: true })
  const outputDir = path.join(__dirname, "extracted-data")
  fs.mkdirSync(outputDir, { recursive: true })

  const manifest: { tables: string[]; extractedAt: string } = {
    tables: [],
    extractedAt: new Date().toISOString(),
  }

  for (const table of TABLES_IN_ORDER) {
    try {
      const result = await extractTable(db, table)
      const outputPath = path.join(outputDir, `${table}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(result.data, null, 2))
      manifest.tables.push(table)
    } catch (error) {
      console.error(`Error extracting ${table}:`, error)
    }
  }

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  )

  db.close()
  console.log(`\nExtraction complete. Data saved to ${outputDir}`)
}

function findD1Database(): string | null {
  const possiblePaths = [
    ".alchemy/local/.wrangler/state/v3/d1",
    ".wrangler/state/v3/d1",
  ]

  for (const basePath of possiblePaths) {
    try {
      const files = fs.readdirSync(basePath, { recursive: true }) as string[]
      const dbFile = files.find((f) => f.endsWith(".sqlite"))
      if (dbFile) {
        return path.join(basePath, dbFile)
      }
    } catch {
      // Directory doesn't exist
    }
  }
  return null
}

main().catch(console.error)
```

### 5.3 Data Transformation Script

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/scripts/migration/transform-data.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Transform extracted D1 data for PlanetScale
 * - Convert integer timestamps to Date objects
 * - Convert integer booleans to actual booleans
 * - Map old CUID2 IDs to new ULIDs (if needed)
 */

import fs from "node:fs"
import path from "node:path"
import { ulid } from "ulid"

const extractedDir = path.join(__dirname, "extracted-data")
const transformedDir = path.join(__dirname, "transformed-data")

// ID mapping for foreign key consistency
const idMapping = new Map<string, string>()

// Columns that are timestamps (stored as integer seconds in SQLite)
const TIMESTAMP_COLUMNS = [
  "createdAt",
  "updatedAt",
  "emailVerified",
  "lastCreditRefreshAt",
  "dateOfBirth",
  "invitedAt",
  "joinedAt",
  "expiresAt",
  "acceptedAt",
  "stripeOnboardingCompletedAt",
  "planExpiresAt",
]

// Columns that are booleans (stored as 0/1 in SQLite)
const BOOLEAN_COLUMNS = [
  "isActive",
  "isSystemRole",
  "isEditable",
  "isPersonalTeam",
  "passStripeFeeToCustomer",
]

function transformTimestamp(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") {
    // SQLite stores as Unix timestamp (seconds)
    return new Date(value * 1000)
  }
  return null
}

function transformBoolean(value: unknown): boolean {
  return value === 1 || value === true
}

function generateNewId(oldId: string): string {
  if (idMapping.has(oldId)) {
    return idMapping.get(oldId)!
  }

  // Extract prefix from old ID (e.g., "usr_" from "usr_abc123")
  const match = oldId.match(/^([a-z]+_)/)
  const prefix = match ? match[1] : ""

  const newId = `${prefix}${ulid()}`
  idMapping.set(oldId, newId)
  return newId
}

function transformRow(
  row: Record<string, unknown>,
  tableName: string
): Record<string, unknown> {
  const transformed: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    if (key === "id" && typeof value === "string") {
      // Keep existing prefixed IDs (they're already strings)
      // Only regenerate if we want fresh ULIDs
      transformed[key] = value
    } else if (TIMESTAMP_COLUMNS.includes(key)) {
      transformed[key] = transformTimestamp(value)
    } else if (BOOLEAN_COLUMNS.includes(key)) {
      transformed[key] = transformBoolean(value)
    } else {
      transformed[key] = value
    }
  }

  return transformed
}

async function main() {
  fs.mkdirSync(transformedDir, { recursive: true })

  const manifest = JSON.parse(
    fs.readFileSync(path.join(extractedDir, "manifest.json"), "utf-8")
  )

  for (const table of manifest.tables) {
    const inputPath = path.join(extractedDir, `${table}.json`)
    const data = JSON.parse(fs.readFileSync(inputPath, "utf-8"))

    const transformedData = data.map((row: Record<string, unknown>) =>
      transformRow(row, table)
    )

    const outputPath = path.join(transformedDir, `${table}.json`)
    fs.writeFileSync(outputPath, JSON.stringify(transformedData, null, 2))

    console.log(`Transformed ${transformedData.length} rows for ${table}`)
  }

  // Save ID mapping for reference
  fs.writeFileSync(
    path.join(transformedDir, "id-mapping.json"),
    JSON.stringify(Object.fromEntries(idMapping), null, 2)
  )

  console.log("\nTransformation complete.")
}

main().catch(console.error)
```

### 5.4 Data Loading Script

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/scripts/migration/load-planetscale.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Load transformed data into PlanetScale
 * Run with: DATABASE_URL=... pnpm tsx scripts/migration/load-planetscale.ts
 */

import mysql from "mysql2/promise"
import fs from "node:fs"
import path from "node:path"

const transformedDir = path.join(__dirname, "transformed-data")
const BATCH_SIZE = 1000

// Tables in dependency order
const TABLES_IN_ORDER = [
  "user",
  "passkey_credential",
  "team",
  "team_membership",
  "team_role",
  "team_invitation",
  // ... all tables
]

async function loadTable(
  connection: mysql.Connection,
  tableName: string
): Promise<number> {
  const dataPath = path.join(transformedDir, `${tableName}.json`)
  if (!fs.existsSync(dataPath)) {
    console.log(`No data file for ${tableName}, skipping`)
    return 0
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as Record<
    string,
    unknown
  >[]

  if (data.length === 0) {
    console.log(`No rows for ${tableName}`)
    return 0
  }

  // Get column names from first row
  const columns = Object.keys(data[0])
  const placeholders = columns.map(() => "?").join(", ")
  const columnList = columns.map((c) => `\`${c}\``).join(", ")

  const insertSql = `INSERT INTO \`${tableName}\` (${columnList}) VALUES (${placeholders})`

  let inserted = 0
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const values = columns.map((col) => {
        const val = row[col]
        // Convert Date objects to MySQL datetime format
        if (val instanceof Date) {
          return val.toISOString().slice(0, 19).replace("T", " ")
        }
        return val
      })

      try {
        await connection.execute(insertSql, values)
        inserted++
      } catch (error) {
        console.error(`Error inserting row into ${tableName}:`, error)
        console.error("Row:", row)
      }
    }

    console.log(`  Inserted ${Math.min(i + BATCH_SIZE, data.length)}/${data.length} rows`)
  }

  return inserted
}

async function main() {
  const connectionUrl = process.env.DATABASE_URL
  if (!connectionUrl) {
    console.error("DATABASE_URL environment variable required")
    process.exit(1)
  }

  const connection = await mysql.createConnection(connectionUrl)
  console.log("Connected to PlanetScale")

  // Disable foreign key checks during import
  await connection.execute("SET FOREIGN_KEY_CHECKS = 0")

  const results: { table: string; rows: number }[] = []

  for (const table of TABLES_IN_ORDER) {
    console.log(`\nLoading ${table}...`)
    const rows = await loadTable(connection, table)
    results.push({ table, rows })
  }

  // Re-enable foreign key checks
  await connection.execute("SET FOREIGN_KEY_CHECKS = 1")

  await connection.end()

  console.log("\n=== Migration Summary ===")
  for (const { table, rows } of results) {
    console.log(`${table}: ${rows} rows`)
  }
}

main().catch(console.error)
```

### 5.5 Verification Script

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/scripts/migration/verify-migration.ts`

```typescript
#!/usr/bin/env tsx
/**
 * Verify data integrity after migration
 */

import Database from "better-sqlite3"
import mysql from "mysql2/promise"

interface RowCounts {
  [table: string]: number
}

async function getD1Counts(dbPath: string): Promise<RowCounts> {
  const db = new Database(dbPath, { readonly: true })
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all() as { name: string }[]

  const counts: RowCounts = {}
  for (const { name } of tables) {
    if (name.startsWith("_") || name.startsWith("sqlite_")) continue
    const count = db
      .prepare(`SELECT COUNT(*) as count FROM ${name}`)
      .get() as { count: number }
    counts[name] = count.count
  }

  db.close()
  return counts
}

async function getPlanetScaleCounts(url: string): Promise<RowCounts> {
  const connection = await mysql.createConnection(url)

  const [tables] = await connection.execute("SHOW TABLES")
  const counts: RowCounts = {}

  for (const row of tables as { [key: string]: string }[]) {
    const tableName = Object.values(row)[0]
    const [[countRow]] = await connection.execute(
      `SELECT COUNT(*) as count FROM \`${tableName}\``
    ) as unknown as [[{ count: number }]]
    counts[tableName] = countRow.count
  }

  await connection.end()
  return counts
}

async function main() {
  const d1Path = process.argv[2]
  const psUrl = process.env.DATABASE_URL

  if (!d1Path || !psUrl) {
    console.error("Usage: DATABASE_URL=... tsx verify-migration.ts <d1-path>")
    process.exit(1)
  }

  console.log("Fetching row counts...")
  const [d1Counts, psCounts] = await Promise.all([
    getD1Counts(d1Path),
    getPlanetScaleCounts(psUrl),
  ])

  console.log("\n=== Row Count Comparison ===")
  console.log("Table".padEnd(40) + "D1".padEnd(10) + "PlanetScale".padEnd(10) + "Match")
  console.log("-".repeat(70))

  let allMatch = true
  for (const table of Object.keys(d1Counts).sort()) {
    const d1Count = d1Counts[table] || 0
    const psCount = psCounts[table] || 0
    const match = d1Count === psCount
    if (!match) allMatch = false

    console.log(
      table.padEnd(40) +
        String(d1Count).padEnd(10) +
        String(psCount).padEnd(10) +
        (match ? "OK" : "MISMATCH")
    )
  }

  console.log("\n" + (allMatch ? "All tables match!" : "ERRORS: Some tables have mismatched counts"))
  process.exit(allMatch ? 0 : 1)
}

main().catch(console.error)
```

---

## Phase 6: Cutover (Week 4)

### 6.1 Maintenance Mode Implementation

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/routes/__root.tsx`

Add maintenance mode check:

```typescript
import { createServerFn } from "@tanstack/react-start"
import { env } from "cloudflare:workers"

const checkMaintenanceMode = createServerFn().handler(async () => {
  // Check KV for maintenance flag
  const maintenance = await env.KV_SESSION.get("maintenance_mode")
  return maintenance === "true"
})

// In the root component
export const Route = createRootRoute({
  beforeLoad: async () => {
    const isMaintenanceMode = await checkMaintenanceMode()
    if (isMaintenanceMode) {
      throw redirect({ to: "/maintenance" })
    }
  },
})
```

**File:** `/Users/ianjones/wodsmith/apps/wodsmith-start/src/routes/maintenance.tsx`

```typescript
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/maintenance")({
  component: MaintenancePage,
})

function MaintenancePage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Scheduled Maintenance</h1>
        <p className="mt-4 text-muted-foreground">
          We're performing scheduled maintenance. Please check back in a few minutes.
        </p>
      </div>
    </div>
  )
}
```

### 6.2 Cutover Runbook

**Pre-Cutover (T-1 week):**
- [ ] Complete all schema migration testing on staging
- [ ] Run full ETL test on staging branch
- [ ] Verify all application features work with PlanetScale
- [ ] Prepare rollback scripts
- [ ] Notify users of scheduled maintenance window

**Cutover Day:**

```bash
# T-0:00 - Enable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "true"

# T-0:05 - Final D1 export
pnpm tsx scripts/migration/extract-d1.ts

# T-0:10 - Transform data
pnpm tsx scripts/migration/transform-data.ts

# T-0:15 - Load to PlanetScale production
DATABASE_URL=$PLANETSCALE_PROD_URL pnpm tsx scripts/migration/load-planetscale.ts

# T-0:30 - Verify migration
DATABASE_URL=$PLANETSCALE_PROD_URL pnpm tsx scripts/migration/verify-migration.ts

# T-0:35 - Deploy PlanetScale-enabled application
STAGE=prod bun alchemy.run.ts

# T-0:40 - Smoke test critical paths
# - User login
# - Team access
# - Competition viewing
# - Registration flow

# T-0:45 - Disable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "false"

# T-0:50 - Monitor error rates
# Check Cloudflare analytics, PlanetScale insights
```

### 6.3 Rollback Plan

If critical issues are discovered within 24 hours:

```bash
# 1. Enable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "true"

# 2. Deploy D1 version
git checkout pre-planetscale-migration
STAGE=prod bun alchemy.run.ts

# 3. Disable maintenance mode
wrangler kv:key put --namespace-id=<KV_ID> maintenance_mode "false"

# 4. Assess data written to PlanetScale during cutover
# May need to export and replay to D1
```

---

## Phase 7: Testing Strategy

### 7.1 Phase 1 Testing (Infrastructure)
- [ ] Verify Hyperdrive connection from local Worker
- [ ] Test connection pooling behavior under load
- [ ] Verify SSL/TLS configuration

### 7.2 Phase 2 Testing (Schema)
- [ ] Run `drizzle-kit push` to development branch
- [ ] Verify all tables created correctly
- [ ] Test ULID generation
- [ ] Verify index creation

### 7.3 Phase 3 Testing (Application Code)
- [ ] Run existing test suite against PlanetScale
- [ ] Test all raw SQL queries for MySQL compatibility
- [ ] Verify date handling across timezones
- [ ] Test batch query utilities

### 7.4 Phase 4 Testing (Pagination)
- [ ] Test cursor pagination with large datasets
- [ ] Verify no data loss during pagination
- [ ] Test edge cases (first page, last page, empty results)

### 7.5 Phase 5 Testing (ETL)
- [ ] Run full ETL on staging data
- [ ] Verify row counts match
- [ ] Spot-check data integrity
- [ ] Test foreign key relationships

### 7.6 Phase 6 Testing (Cutover)
- [ ] Practice cutover on staging
- [ ] Time the full cutover process
- [ ] Test maintenance mode
- [ ] Test rollback procedure

---

## Phase 8: Monitoring and Validation

### 8.1 Query Performance Monitoring

**PlanetScale Insights Dashboard:**
- Monitor query latency p50, p95, p99
- Track read/write row counts
- Identify slow queries (>100ms)

**Set up alerts for:**
- Query latency > 500ms
- Error rate > 1%
- Connection pool exhaustion

### 8.2 Cost Tracking

**PlanetScale Usage Metrics:**
- Read rows per day
- Write rows per day
- Storage growth

**Budget thresholds:**
- Alert at 75% of plan limits
- Review optimization opportunities weekly

### 8.3 Application Monitoring

**Cloudflare Analytics:**
- Worker CPU time
- Request latency
- Error rates by route

**Custom Metrics:**
- Database query count per request
- Query latency histogram
- Cache hit rates (if implemented)

### 8.4 Post-Migration Validation Checklist

**Week 1:**
- [ ] No increase in error rates
- [ ] Query latency within acceptable range (<100ms p95)
- [ ] All background jobs running correctly
- [ ] No data integrity issues reported

**Week 2:**
- [ ] Review slow query log
- [ ] Optimize any problematic queries
- [ ] Verify billing aligns with expectations

**Week 4:**
- [ ] Full application audit
- [ ] Remove D1-related code and configuration
- [ ] Archive migration scripts
- [ ] Document lessons learned

---

## Appendix: File Reference

### Files to Modify

| File | Phase | Changes |
|------|-------|---------|
| `wrangler.jsonc` | 1 | Add Hyperdrive binding |
| `alchemy.run.ts` | 1 | Add Hyperdrive resource and binding |
| `.dev.vars` | 1 | Add PlanetScale credentials |
| `package.json` | 2 | Add mysql2, ulid dependencies |
| `drizzle.config.ts` | 2 | Change dialect to mysql |
| `src/db/index.ts` | 3 | Update connection to mysql2/Hyperdrive |
| `src/db/schemas/*.ts` | 2 | Convert from sqlite-core to mysql-core |
| `src/utils/batch-query.ts` | 3 | Update batch size limits |
| `src/server/workouts.ts` | 4 | Add cursor pagination |
| `src/server-fns/workout-fns.ts` | 4 | Add cursor pagination |

### New Files to Create

| File | Phase | Purpose |
|------|-------|---------|
| `src/utils/cursor-pagination.ts` | 4 | Pagination utilities |
| `src/utils/sql-date-utils.ts` | 3 | MySQL date functions |
| `src/routes/maintenance.tsx` | 6 | Maintenance mode page |
| `scripts/migration/extract-d1.ts` | 5 | D1 data extraction |
| `scripts/migration/transform-data.ts` | 5 | Data transformation |
| `scripts/migration/load-planetscale.ts` | 5 | PlanetScale loading |
| `scripts/migration/verify-migration.ts` | 5 | Migration verification |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Connection latency regression | Hyperdrive connection pooling; monitor p95 latency |
| Data loss during migration | Full verification script; maintain D1 backup |
| Schema incompatibility | Comprehensive schema audit; test on staging |
| Application downtime | Maintenance window; rapid rollback capability |
| Cost overrun | Budget alerts; query optimization |
| Feature regression | Full test suite; staged rollout |
