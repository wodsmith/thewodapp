# D1 to PlanetScale Schema Specification

This document provides a comprehensive specification for migrating the WODsmith database schema from Cloudflare D1 (SQLite) to PlanetScale (MySQL/Vitess). It details all column type mappings, primary key strategy changes, foreign key handling, index modifications, and data transformation requirements.

## Table of Contents

1. [Overview](#1-overview)
2. [Column Type Mappings](#2-column-type-mappings)
3. [Primary Key Strategy](#3-primary-key-strategy)
4. [Foreign Key Strategy](#4-foreign-key-strategy)
5. [Index Changes](#5-index-changes)
6. [Table-by-Table Transformation](#6-table-by-table-transformation)
7. [Migration Data Transformations](#7-migration-data-transformations)

---

## 1. Overview

### Summary of Schema Changes Required for MySQL/PlanetScale

The migration from SQLite (D1) to MySQL (PlanetScale) requires several fundamental changes:

1. **Drizzle ORM Module Change**: All imports change from `drizzle-orm/sqlite-core` to `drizzle-orm/mysql-core`
2. **Table Definition Change**: `sqliteTable()` becomes `mysqlTable()`
3. **Column Type Overhaul**: SQLite's loose typing must be replaced with MySQL's strict types
4. **Primary Key Strategy**: Prefixed CUIDs are already in use - we retain string-based IDs
5. **Boolean Handling**: `integer({ mode: 'boolean' })` becomes `boolean()`
6. **Timestamp Handling**: `integer({ mode: 'timestamp' })` becomes `timestamp()` or `datetime()`
7. **Foreign Key Strategy**: Application-layer enforcement due to Vitess limitations
8. **Text Length Enforcement**: `text()` becomes `varchar()` with explicit lengths

### Current Schema Statistics

- **21 schema files** defining the database structure
- **60+ tables** across users, teams, competitions, workouts, billing, and more
- **Heavy use of prefixed string IDs** (e.g., `usr_`, `team_`, `comp_`)
- **Complex relations** using Drizzle's relations API

---

## 2. Column Type Mappings

### 2.1 Boolean Columns

**SQLite (Current)**
```typescript
integer({ mode: 'boolean' }).default(true)
```

**MySQL (Target)**
```typescript
boolean().default(true)
```

MySQL's `boolean()` maps to `TINYINT(1)` internally. Drizzle handles the conversion automatically.

**Affected Tables/Columns:**
| Table | Column | Current Default |
|-------|--------|-----------------|
| `competitions` | `passStripeFeesToCustomer` | `false` |
| `competitions` | `passPlatformFeesToCustomer` | `true` |
| `competition_registration_questions` | `required` | `true` |
| `competition_registration_questions` | `forTeammates` | `false` |
| `competition_heats` | `schedulePublishedAt` | (timestamp, not boolean) |
| `judge_heat_assignments` | `isManualOverride` | `false` |
| `judge_assignment_versions` | `isActive` | `false` |
| `waivers` | `required` | `true` |
| `scores` | `asRx` | `false` |
| `results` | `asRx` | `false` |
| `team_membership` | `isActive` | `1` |
| `team_membership` | `isSystemRole` | `1` |
| `team_invitation` | `isSystemRole` | `1` |
| `team_role` | `isEditable` | `1` |
| `team` | `isPersonalTeam` | `0` |
| `programming_track` | `isPublic` | `0` |
| `team_programming_track` | `isActive` | `1` |
| `scaling_groups` | `isDefault` | `0` |
| `scaling_groups` | `isSystem` | `0` |
| `feature` | `isActive` | `1` |
| `limit` | `isActive` | `1` |
| `plan` | `isActive` | `1` |
| `plan` | `isPublic` | `1` |
| `team_subscription` | `cancelAtPeriodEnd` | `0` |
| `team_feature_entitlement` | `isActive` | `1` |
| `team_limit_entitlement` | `isActive` | `1` |
| `coaches` | `isActive` | `1` |

### 2.2 Text to VARCHAR Mappings

SQLite's `text()` type has no inherent length limit. MySQL requires explicit sizing for optimal indexing and storage.

**Mapping Strategy:**
| SQLite Pattern | MySQL Equivalent | Rationale |
|---------------|------------------|-----------|
| `text({ length: 50 })` | `varchar(50)` | Direct mapping |
| `text({ length: 100 })` | `varchar(100)` | Direct mapping |
| `text({ length: 255 })` | `varchar(255)` | Direct mapping |
| `text({ length: 500 })` | `varchar(500)` | Direct mapping |
| `text({ length: 1000 })` | `text()` | MySQL TEXT for 1KB+ |
| `text({ length: 2000+ })` | `text()` | MySQL TEXT |
| `text({ length: 5000+ })` | `mediumtext()` | For larger content |
| `text({ length: 10000+ })` | `mediumtext()` | JSON storage, settings |
| `text({ length: 50000 })` | `longtext()` | Waiver content, etc. |
| `text()` (no length) | `text()` | Generic text storage |
| `text({ mode: 'json' })` | `json()` | Native MySQL JSON |

**Key Observations:**
- Most ID columns are already `text()` with prefixed CUIDs (26-30 chars)
- Email fields use `text({ length: 255 })` - map to `varchar(255)`
- URL fields use `text({ length: 600 })` - map to `varchar(600)` or `text()`
- JSON fields use `text({ length: 10000 })` - map to `json()` or `mediumtext()`

### 2.3 Integer Columns

SQLite's `integer()` is flexible (1-8 bytes). MySQL requires precision:

| SQLite Pattern | MySQL Equivalent | Use Case |
|---------------|------------------|----------|
| `integer()` | `int()` | General integers, counts |
| `integer().default(0)` | `int().default(0)` | Counters, credits |
| `integer({ mode: 'timestamp' })` | `timestamp()` or `datetime()` | Date/time storage |
| `integer({ mode: 'boolean' })` | `boolean()` | Boolean flags |

**Special Cases:**
- **Credit/Money amounts**: `integer()` storing cents - use `int()` (sufficient for ~$21M)
- **Counters**: `updateCounter` - use `int()`
- **Timestamps**: Use `timestamp()` for audit columns, `datetime()` for user-specified times

### 2.4 Timestamp Handling

**SQLite (Current)**
```typescript
integer({ mode: 'timestamp' }).$defaultFn(() => new Date())
```

**MySQL (Target)**
```typescript
timestamp().defaultNow()
// or for nullable timestamps:
datetime()
```

**Common Columns Pattern:**
```typescript
// SQLite
export const commonColumns = {
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer({ mode: 'timestamp' }).$onUpdateFn(() => new Date()).notNull(),
  updateCounter: integer().default(0).$onUpdate(() => sql`updateCounter + 1`),
}

// MySQL
export const commonColumns = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().onUpdateNow().notNull(),
  updateCounter: int().default(0), // $onUpdate needs application handling
}
```

**Note:** The `$onUpdate` for `updateCounter` using raw SQL may need adjustment. MySQL's `ON UPDATE CURRENT_TIMESTAMP` only works for timestamp columns.

### 2.5 Real/Float Columns

No `real()` columns found in the current schema. If needed:
- `real()` (SQLite) → `double()` or `decimal(precision, scale)` (MySQL)

### 2.6 Blob Columns

No `blob()` columns found in the current schema. If needed:
- `blob()` (SQLite) → `blob()`, `mediumblob()`, or `longblob()` (MySQL)

### 2.7 Enum Columns

SQLite uses text with enum arrays for validation. MySQL has native ENUM support:

**SQLite (Current)**
```typescript
text({ enum: ['admin', 'user'] }).default('user')
```

**MySQL (Target - Option 1: Native ENUM)**
```typescript
mysqlEnum('role', ['admin', 'user']).default('user')
```

**MySQL (Target - Option 2: VARCHAR)**
```typescript
varchar(20).$type<'admin' | 'user'>().default('user')
```

**Recommendation:** Use `varchar()` with `$type<>()` for flexibility. MySQL ENUM changes require schema alterations.

---

## 3. Primary Key Strategy

### 3.1 Current Pattern (Already String-Based)

The WODsmith schema already uses **prefixed CUID2 strings** as primary keys, not auto-incrementing integers. This is excellent for the PlanetScale migration.

**Current Pattern:**
```typescript
// Common ID generators (from common.ts)
export const createUserId = () => `usr_${createId()}`
export const createTeamId = () => `team_${createId()}`
export const createCompetitionId = () => `comp_${createId()}`
// ... 40+ more ID generators

// Table definition
id: text()
  .primaryKey()
  .$defaultFn(() => createUserId())
  .notNull()
```

### 3.2 Target Pattern for MySQL

The current CUID2-based approach works well, but we should consider ULID for better sort performance:

**Option A: Keep CUID2 (Minimal Change)**
```typescript
id: varchar(30)  // CUIDs are 24 chars + prefix
  .primaryKey()
  .$defaultFn(() => createUserId())
  .notNull()
```

**Option B: Migrate to ULID (Recommended for New Tables)**
```typescript
import { ulid } from 'ulid'

// New ID generators
export const createUserId = () => `usr_${ulid()}`

id: varchar(30)  // ULIDs are 26 chars + prefix
  .primaryKey()
  .$defaultFn(() => createUserId())
  .notNull()
```

### 3.3 Recommendation

**Keep the existing CUID2 approach** for the migration to minimize risk. The prefixed string IDs:
- Avoid auto-increment coordination issues in Vitess
- Are already URL-safe and globally unique
- Have meaningful prefixes for debugging
- Are reasonably sortable (though not as optimal as ULID)

**Future Enhancement:** Consider migrating to ULID for new tables or when performance analysis indicates B-tree fragmentation issues.

### 3.4 ID Column Sizing

All ID columns should use `varchar()` with appropriate length:

| ID Type | Prefix | CUID2 Length | Total | Recommended |
|---------|--------|--------------|-------|-------------|
| User | `usr_` | 24 | 28 | `varchar(30)` |
| Team | `team_` | 24 | 29 | `varchar(30)` |
| Competition | `comp_` | 24 | 28 | `varchar(30)` |
| Registration | `creg_` | 24 | 29 | `varchar(30)` |
| All others | varies | 24 | ~30 | `varchar(32)` |

**Standardize on `varchar(32)`** for all ID columns to allow for prefix variations.

---

## 4. Foreign Key Strategy

### 4.1 Vitess Foreign Key Limitations

PlanetScale (Vitess) has limitations with foreign keys:

1. **Cross-Shard FK Enforcement**: FKs across shards require distributed coordination
2. **Deploy Request Conflicts**: Cannot enable FK support with open deploy requests
3. **Revert Risks**: Reverting schema changes can cause orphaned rows
4. **Performance**: FK checks add latency to write operations

### 4.2 Application-Layer Referential Integrity

**Strategy:** Remove database-level FK constraints and enforce referential integrity in application code.

**Current FK Pattern (Remove):**
```typescript
// SQLite with FK constraints
userId: text()
  .notNull()
  .references(() => userTable.id, { onDelete: 'cascade' })
```

**Target Pattern (No FK Constraints):**
```typescript
// MySQL without FK constraints
userId: varchar(32).notNull()
```

### 4.3 Maintaining Referential Integrity

**1. Drizzle Relations (Keep):**
```typescript
// Relations are query-time only, not DB constraints
export const teamRelations = relations(teamTable, ({ many }) => ({
  memberships: many(teamMembershipTable),
}))
```

**2. Application-Layer Checks:**
```typescript
// Before insert
async function createTeamMembership(data: NewMembership) {
  // Verify parent exists
  const team = await db.select().from(teamTable).where(eq(teamTable.id, data.teamId))
  if (!team.length) throw new Error('Team not found')

  const user = await db.select().from(userTable).where(eq(userTable.id, data.userId))
  if (!user.length) throw new Error('User not found')

  return db.insert(teamMembershipTable).values(data)
}
```

**3. Cascade Deletes in Application:**
```typescript
// Instead of onDelete: 'cascade'
async function deleteTeam(teamId: string) {
  // Delete children first
  await db.delete(teamMembershipTable).where(eq(teamMembershipTable.teamId, teamId))
  await db.delete(teamRoleTable).where(eq(teamRoleTable.teamId, teamId))
  await db.delete(teamInvitationTable).where(eq(teamInvitationTable.teamId, teamId))
  // Then delete parent
  await db.delete(teamTable).where(eq(teamTable.id, teamId))
}
```

### 4.4 Foreign Key Inventory

The following FK relationships exist and need application-layer handling:

**High-Impact (Cascade Delete Required):**
- `team` → `team_membership`, `team_role`, `team_invitation`
- `competition` → `competition_registrations`, `competition_heats`, `competition_venues`
- `user` → `passkey_credential`, `credit_transaction`, `purchased_item`
- `programming_track` → `track_workout`, `team_programming_track`
- `workout` → `workout_tags`, `workout_movements`, `results`

**Self-Referential:**
- `team.parentOrganizationId` → `team.id`
- `workouts.sourceWorkoutId` → `workouts.id`

---

## 5. Index Changes

### 5.1 Index Syntax Changes

**SQLite:**
```typescript
index('idx_name').on(table.column)
uniqueIndex('idx_name').on(table.column)
```

**MySQL:**
```typescript
index('idx_name').on(table.column)
uniqueIndex('idx_name').on(table.column)
```

The syntax is identical in Drizzle ORM.

### 5.2 Index Recommendations for MySQL

**1. Primary Key Indexes:**
- Already covered by `primaryKey()` definition

**2. Foreign Key Columns (Add Indexes):**
MySQL doesn't auto-index FK columns when FKs are disabled. Add explicit indexes:

```typescript
// Example: competition_registrations
index('comp_reg_event_idx').on(table.eventId),
index('comp_reg_user_idx').on(table.userId),
index('comp_reg_team_member_idx').on(table.teamMemberId),
```

**3. Composite Indexes for Queries:**
Review query patterns and add composite indexes:

```typescript
// For pagination queries
index('comp_reg_event_created_idx').on(table.eventId, table.createdAt)

// For leaderboard queries
index('scores_workout_sort_idx').on(table.workoutId, table.statusOrder, table.sortKey)
```

### 5.3 Index Length Limits

MySQL has index length limits:
- **InnoDB:** 767 bytes for single column (with `utf8mb4`)
- **Practical limit:** ~190 characters for `varchar` columns

**Affected Indexes:**
- Long text columns in indexes may need prefix indexing
- URL columns (`varchar(600)`) cannot be fully indexed

**Solution:**
```typescript
// Prefix index for long columns (not directly supported in Drizzle)
// May need raw SQL migration
```

---

## 6. Table-by-Table Transformation

### 6.1 Common Columns

**Current (SQLite):**
```typescript
export const commonColumns = {
  createdAt: integer({ mode: 'timestamp' }).$defaultFn(() => new Date()).notNull(),
  updatedAt: integer({ mode: 'timestamp' }).$onUpdateFn(() => new Date()).notNull(),
  updateCounter: integer().default(0).$onUpdate(() => sql`updateCounter + 1`),
}
```

**Target (MySQL):**
```typescript
export const commonColumns = {
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().onUpdateNow().notNull(),
  updateCounter: int().default(0),
}
```

### 6.2 Users Schema (`users.ts`)

#### `user` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `firstName` | `text({ length: 255 })` | `varchar(255)` |
| `lastName` | `text({ length: 255 })` | `varchar(255)` |
| `email` | `text({ length: 255 }).unique()` | `varchar(255).unique()` |
| `passwordHash` | `text()` | `varchar(255)` |
| `role` | `text({ enum: [...] })` | `varchar(20)` |
| `emailVerified` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `signUpIpAddress` | `text({ length: 128 })` | `varchar(128)` |
| `googleAccountId` | `text({ length: 255 })` | `varchar(255)` |
| `avatar` | `text({ length: 600 })` | `varchar(600)` |
| `currentCredits` | `integer().default(0)` | `int().default(0)` |
| `lastCreditRefreshAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `gender` | `text({ enum: [...] })` | `varchar(10)` |
| `dateOfBirth` | `integer({ mode: 'timestamp' })` | `date()` |
| `affiliateName` | `text({ length: 255 })` | `varchar(255)` |
| `athleteProfile` | `text({ length: 10000 })` | `json()` |

#### `passkey_credential` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `userId` | `text().references(...)` | `varchar(32)` |
| `credentialId` | `text({ length: 255 }).unique()` | `varchar(255).unique()` |
| `credentialPublicKey` | `text({ length: 255 })` | `text()` |
| `counter` | `integer()` | `int()` |
| `transports` | `text({ length: 255 })` | `varchar(255)` |
| `aaguid` | `text({ length: 255 })` | `varchar(255)` |
| `userAgent` | `text({ length: 255 })` | `varchar(255)` |
| `ipAddress` | `text({ length: 128 })` | `varchar(128)` |

### 6.3 Teams Schema (`teams.ts`)

#### `team` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `name` | `text({ length: 255 })` | `varchar(255)` |
| `slug` | `text({ length: 255 }).unique()` | `varchar(255).unique()` |
| `description` | `text({ length: 1000 })` | `text()` |
| `avatarUrl` | `text({ length: 600 })` | `varchar(600)` |
| `settings` | `text({ length: 10000 })` | `json()` |
| `billingEmail` | `text({ length: 255 })` | `varchar(255)` |
| `planId` | `text({ length: 100 })` | `varchar(100)` |
| `planExpiresAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `creditBalance` | `integer().default(0)` | `int().default(0)` |
| `currentPlanId` | `text({ length: 100 })` | `varchar(100)` |
| `defaultTrackId` | `text()` | `varchar(32)` |
| `defaultScalingGroupId` | `text()` | `varchar(32)` |
| `isPersonalTeam` | `integer().default(0)` | `boolean().default(false)` |
| `personalTeamOwnerId` | `text()` | `varchar(32)` |
| `type` | `text({ length: 50 })` | `varchar(50)` |
| `parentOrganizationId` | `text()` | `varchar(32)` |
| `competitionMetadata` | `text({ length: 10000 })` | `json()` |
| `stripeConnectedAccountId` | `text()` | `varchar(255)` |
| `stripeAccountStatus` | `text({ length: 20 })` | `varchar(20)` |
| `stripeAccountType` | `text({ length: 20 })` | `varchar(20)` |
| `stripeOnboardingCompletedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `organizerFeePercentage` | `integer()` | `int()` |
| `organizerFeeFixed` | `integer()` | `int()` |

#### `team_membership` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `teamId` | `text().references(...)` | `varchar(32)` |
| `userId` | `text().references(...)` | `varchar(32)` |
| `roleId` | `text()` | `varchar(32)` |
| `isSystemRole` | `integer().default(1)` | `boolean().default(true)` |
| `invitedBy` | `text()` | `varchar(32)` |
| `invitedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `joinedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `expiresAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `isActive` | `integer().default(1)` | `boolean().default(true)` |
| `metadata` | `text({ length: 5000 })` | `json()` |

### 6.4 Competitions Schema (`competitions.ts`)

#### `competitions` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `organizingTeamId` | `text().references(...)` | `varchar(32)` |
| `competitionTeamId` | `text().references(...)` | `varchar(32)` |
| `groupId` | `text()` | `varchar(32)` |
| `slug` | `text({ length: 255 }).unique()` | `varchar(255).unique()` |
| `name` | `text({ length: 255 })` | `varchar(255)` |
| `description` | `text({ length: 2000 })` | `text()` |
| `startDate` | `text()` | `varchar(10)` |
| `endDate` | `text()` | `varchar(10)` |
| `registrationOpensAt` | `text()` | `varchar(10)` |
| `registrationClosesAt` | `text()` | `varchar(10)` |
| `timezone` | `text({ length: 50 })` | `varchar(50)` |
| `settings` | `text({ length: 10000 })` | `json()` |
| `defaultRegistrationFeeCents` | `integer().default(0)` | `int().default(0)` |
| `platformFeePercentage` | `integer()` | `int()` |
| `platformFeeFixed` | `integer()` | `int()` |
| `passStripeFeesToCustomer` | `integer({ mode: 'boolean' })` | `boolean().default(false)` |
| `passPlatformFeesToCustomer` | `integer({ mode: 'boolean' })` | `boolean().default(true)` |
| `visibility` | `text({ length: 10 })` | `varchar(10)` |
| `status` | `text({ length: 15 })` | `varchar(15)` |
| `competitionType` | `text({ length: 15 })` | `varchar(15)` |
| `profileImageUrl` | `text({ length: 600 })` | `varchar(600)` |
| `bannerImageUrl` | `text({ length: 600 })` | `varchar(600)` |
| `defaultHeatsPerRotation` | `integer().default(4)` | `int().default(4)` |
| `defaultLaneShiftPattern` | `text({ length: 20 })` | `varchar(20)` |
| `defaultMaxSpotsPerDivision` | `integer()` | `int()` |

### 6.5 Workouts Schema (`workouts.ts`)

#### `workouts` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `name` | `text()` | `varchar(255)` |
| `description` | `text()` | `text()` |
| `scope` | `text({ enum: [...] })` | `varchar(10)` |
| `scheme` | `text({ enum: [...] })` | `varchar(20)` |
| `scoreType` | `text({ enum: [...] })` | `varchar(10)` |
| `repsPerRound` | `integer()` | `int()` |
| `roundsToScore` | `integer().default(1)` | `int().default(1)` |
| `teamId` | `text()` | `varchar(32)` |
| `sugarId` | `text()` | `varchar(255)` |
| `tiebreakScheme` | `text({ enum: [...] })` | `varchar(10)` |
| `timeCap` | `integer()` | `int()` |
| `sourceTrackId` | `text()` | `varchar(32)` |
| `sourceWorkoutId` | `text()` | `varchar(32)` |
| `scalingGroupId` | `text()` | `varchar(32)` |

### 6.6 Scores Schema (`scores.ts`)

#### `scores` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `userId` | `text().references(...)` | `varchar(32)` |
| `teamId` | `text().references(...)` | `varchar(32)` |
| `workoutId` | `text().references(...)` | `varchar(32)` |
| `competitionEventId` | `text()` | `varchar(32)` |
| `scheduledWorkoutInstanceId` | `text()` | `varchar(32)` |
| `scheme` | `text({ enum: [...] })` | `varchar(20)` |
| `scoreType` | `text({ enum: [...] })` | `varchar(10)` |
| `scoreValue` | `integer()` | `bigint()` |
| `tiebreakScheme` | `text({ enum: [...] })` | `varchar(10)` |
| `tiebreakValue` | `integer()` | `bigint()` |
| `timeCapMs` | `integer()` | `int()` |
| `secondaryValue` | `integer()` | `int()` |
| `status` | `text({ enum: [...] })` | `varchar(15)` |
| `statusOrder` | `integer().default(0)` | `int().default(0)` |
| `sortKey` | `text()` | `varchar(50)` |
| `scalingLevelId` | `text()` | `varchar(32)` |
| `asRx` | `integer({ mode: 'boolean' })` | `boolean().default(false)` |
| `notes` | `text()` | `text()` |
| `recordedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |

### 6.7 Billing Schema (`billing.ts`)

#### `credit_transaction` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `userId` | `text().references(...)` | `varchar(32)` |
| `amount` | `integer()` | `int()` |
| `remainingAmount` | `integer().default(0)` | `int().default(0)` |
| `type` | `text({ enum: [...] })` | `varchar(20)` |
| `description` | `text({ length: 255 })` | `varchar(255)` |
| `expirationDate` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `expirationDateProcessedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |
| `paymentIntentId` | `text({ length: 255 })` | `varchar(255)` |

### 6.8 Commerce Schema (`commerce.ts`)

#### `commerce_purchase` Table

| Column | SQLite | MySQL |
|--------|--------|-------|
| `id` | `text().primaryKey()` | `varchar(32).primaryKey()` |
| `userId` | `text().references(...)` | `varchar(32)` |
| `productId` | `text().references(...)` | `varchar(32)` |
| `status` | `text({ length: 20 })` | `varchar(20)` |
| `competitionId` | `text()` | `varchar(32)` |
| `divisionId` | `text()` | `varchar(32)` |
| `totalCents` | `integer()` | `int()` |
| `platformFeeCents` | `integer()` | `int()` |
| `stripeFeeCents` | `integer()` | `int()` |
| `organizerNetCents` | `integer()` | `int()` |
| `stripeCheckoutSessionId` | `text()` | `varchar(255)` |
| `stripePaymentIntentId` | `text()` | `varchar(255)` |
| `metadata` | `text({ length: 10000 })` | `json()` |
| `completedAt` | `integer({ mode: 'timestamp' })` | `timestamp()` |

### 6.9 Remaining Tables Summary

The following tables follow similar transformation patterns:

| Schema File | Tables |
|-------------|--------|
| `affiliates.ts` | `affiliates` |
| `entitlements.ts` | `entitlement_type`, `entitlement`, `feature`, `limit`, `plan`, `plan_feature`, `plan_limit`, `team_subscription`, `team_addon`, `team_entitlement_override`, `team_usage`, `team_feature_entitlement`, `team_limit_entitlement` |
| `event-resources.ts` | `event_resources` |
| `judging-sheets.ts` | `event_judging_sheets` |
| `notifications.ts` | `submission_window_notifications` |
| `organizer-requests.ts` | `organizer_request` |
| `programming.ts` | `programming_track`, `team_programming_track`, `track_workout`, `scheduled_workout_instance` |
| `scaling.ts` | `scaling_groups`, `scaling_levels`, `workout_scaling_descriptions` |
| `scheduling.ts` | `coaches`, `locations`, `class_catalog`, `skills`, `class_catalog_to_skills`, `coach_to_skills`, `coach_blackout_dates`, `coach_recurring_unavailability`, `schedule_templates`, `schedule_template_classes`, `schedule_template_class_required_skills`, `generated_schedules`, `scheduled_classes` |
| `sponsors.ts` | `sponsor_groups`, `sponsors` |
| `video-submissions.ts` | `video_submissions` |
| `volunteers.ts` | `judge_assignment_versions`, `judge_heat_assignments`, `competition_judge_rotations` |
| `waivers.ts` | `waivers`, `waiver_signatures` |

---

## 7. Migration Data Transformations

### 7.1 Timestamp Conversion

**SQLite Storage:** Unix timestamps as integers (seconds or milliseconds)
**MySQL Storage:** Native `TIMESTAMP` or `DATETIME`

**Transformation:**
```typescript
// During ETL
const mysqlTimestamp = new Date(sqliteIntegerTimestamp * 1000) // if seconds
// or
const mysqlTimestamp = new Date(sqliteIntegerTimestamp) // if milliseconds
```

### 7.2 Boolean Conversion

**SQLite Storage:** `0` or `1` as integers
**MySQL Storage:** `TINYINT(1)` with `true`/`false`

**Transformation:**
```typescript
// During ETL
const mysqlBoolean = sqliteInteger === 1
```

### 7.3 JSON Data

**SQLite Storage:** JSON as text strings
**MySQL Storage:** Native JSON type

**Transformation:**
```typescript
// During ETL - validate JSON before insert
const mysqlJson = JSON.parse(sqliteText)
```

### 7.4 ID Preservation

Since the schema already uses string-based prefixed IDs (not auto-increment), **no ID transformation is required**. IDs can be copied directly.

### 7.5 Date-Only Fields

Some fields store dates as `YYYY-MM-DD` text strings (e.g., `startDate`, `endDate` in competitions).

**SQLite Storage:** `text()` with `YYYY-MM-DD` format
**MySQL Storage:** `varchar(10)` or `date()`

**Recommendation:** Keep as `varchar(10)` to maintain timezone-agnostic behavior described in the codebase comments.

### 7.6 ETL Data Validation Checklist

Before loading data into PlanetScale:

1. **Validate all JSON fields** parse correctly
2. **Verify timestamp ranges** are valid MySQL TIMESTAMP range (1970-2038)
3. **Check text lengths** don't exceed `varchar` limits
4. **Verify unique constraints** won't be violated
5. **Validate enum values** match MySQL column definitions
6. **Check for orphaned records** (FK violations that won't be caught by DB)

### 7.7 Migration Script Outline

```typescript
// Pseudo-code for ETL migration
async function migrateTable(tableName: string) {
  const BATCH_SIZE = 1000
  let offset = 0

  while (true) {
    // 1. Extract from D1
    const rows = await d1.select().from(table).limit(BATCH_SIZE).offset(offset)
    if (rows.length === 0) break

    // 2. Transform
    const transformed = rows.map(row => ({
      ...row,
      // Convert timestamps
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      // Convert booleans
      isActive: row.isActive === 1,
      // Parse JSON
      settings: row.settings ? JSON.parse(row.settings) : null,
    }))

    // 3. Load to PlanetScale
    await planetscale.insert(mysqlTable).values(transformed)

    offset += BATCH_SIZE
  }
}

// Migration order (respect dependencies)
const migrationOrder = [
  'user',           // No dependencies
  'team',           // References user (personalTeamOwnerId)
  'team_membership', // References team, user
  'programming_track', // References team
  'workouts',       // References team
  'competitions',   // References team
  // ... etc
]
```

---

## Appendix A: Full Column Type Reference

| SQLite Type | MySQL Type | Notes |
|-------------|------------|-------|
| `text()` | `text()` | Generic text |
| `text({ length: N })` where N <= 255 | `varchar(N)` | Short strings |
| `text({ length: N })` where N <= 65535 | `text()` | Medium text |
| `text({ length: N })` where N > 65535 | `mediumtext()` | Large text |
| `text({ mode: 'json' })` | `json()` | Native JSON |
| `text({ enum: [...] })` | `varchar(N)` | Enums as strings |
| `integer()` | `int()` | Standard integer |
| `integer({ mode: 'boolean' })` | `boolean()` | Maps to TINYINT(1) |
| `integer({ mode: 'timestamp' })` | `timestamp()` | Date/time |
| `real()` | `double()` | Floating point |
| `blob()` | `blob()` | Binary data |

## Appendix B: Drizzle Import Changes

```typescript
// Before (SQLite)
import { sqliteTable, text, integer, index, uniqueIndex, primaryKey, foreignKey } from 'drizzle-orm/sqlite-core'

// After (MySQL)
import { mysqlTable, varchar, text, int, bigint, boolean, timestamp, datetime, date, json, index, uniqueIndex, primaryKey } from 'drizzle-orm/mysql-core'
```

## Appendix C: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data loss during migration | High | Full backup, verification scripts, rollback plan |
| Type conversion errors | Medium | Comprehensive testing, validation in ETL |
| Performance regression | Medium | Index analysis, query plan review |
| FK violations undetected | Medium | Application-layer validation, data integrity checks |
| Timestamp precision loss | Low | Verify millisecond handling |
