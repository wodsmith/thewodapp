
# Database Schema Improvement Suggestions

Based on an analysis of the current database schema, here are five suggestions for improvement to enhance future development, scalability, and data integrity.

### 1. Consolidate and Normalize Address Information

**Observation:** Several tables like `userTable` and `teamTable` could potentially store address-related information in a denormalized way (e.g., as separate fields or within a JSON blob).

**Suggestion:** Create a generic `addresses` table.

```sql
CREATE TABLE addresses (
    id TEXT PRIMARY KEY,
    street_line_1 TEXT NOT NULL,
    street_line_2 TEXT,
    city TEXT NOT NULL,
    state_province_region TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Then, create a polymorphic association table to link addresses to other entities.

```sql
CREATE TABLE address_associations (
    address_id TEXT NOT NULL REFERENCES addresses(id),
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- e.g., 'user', 'team'
    address_type TEXT, -- e.g., 'billing', 'shipping'
    PRIMARY KEY (address_id, entity_id, entity_type)
);
```

**Benefits:**
*   **Normalization:** Reduces data redundancy and ensures consistency.
*   **Reusability:** Any entity can have an associated address without schema modifications.
*   **Scalability:** Simplifies adding address-related features in the future.

### 2. Refactor the Permissions System for Granularity

**Observation:** The `teamRoleTable` stores permissions as a JSON array of strings in the `permissions` column. This is functional but can be difficult to query and manage.

**Suggestion:** Create separate `permissions` and `role_permissions` tables.

```sql
CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE, -- e.g., 'invite_members'
    description TEXT
);

CREATE TABLE role_permissions (
    role_id TEXT NOT NULL REFERENCES team_role(id),
    permission_id TEXT NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);
```

**Benefits:**
*   **Queryability:** Makes it easier to query which roles have a specific permission.
*   **Integrity:** Enforces that only valid permissions can be assigned.
*   **Scalability:** Simplifies adding or modifying permissions and associating them with roles.

### 3. Introduce a Dedicated `subscriptions` Table

**Observation:** Subscription-related fields (`stripeSubscriptionId`, `subscriptionExpiresAt`, etc.) are spread across `teamProgrammingTracksTable` and `programmingTrackPaymentsTable`. This can lead to data duplication and inconsistencies.

**Suggestion:** Create a centralized `subscriptions` table.

```sql
CREATE TABLE subscriptions (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES team(id),
    track_id TEXT NOT NULL REFERENCES programming_track(id),
    stripe_subscription_id TEXT UNIQUE,
    status TEXT NOT NULL, -- e.g., 'active', 'cancelled', 'past_due'
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Benefits:**
*   **Single Source of Truth:** Centralizes all subscription information.
*   **Clarity:** Clearly separates subscription management from payment history.
*   **Flexibility:** Can be extended to support different types of subscriptions in the future.

### 4. Normalize `settings` and `metadata` JSON Blobs

**Observation:** Tables like `teamTable` (`settings`) and `teamRoleTable` (`metadata`) use JSON text fields to store semi-structured data. This is flexible but can lead to data integrity issues and makes querying specific settings difficult.

**Suggestion:** For frequently queried or critical settings, create dedicated tables. For example, for team settings:

```sql
CREATE TABLE team_settings (
    team_id TEXT PRIMARY KEY REFERENCES team(id),
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    UNIQUE (team_id, setting_key)
);
```

**Benefits:**
*   **Data Integrity:** Enforces data types and constraints on settings.
*   **Query Performance:** Allows for efficient indexing and querying of individual settings.
*   **Discoverability:** Makes it easier to understand the available settings.

### 5. Unify User and Team Ownership

**Observation:** The schema has separate concepts for user-owned resources (e.g., `workouts.userId`) and team-owned resources (e.g., `programmingTracksTable.ownerTeamId`). This can complicate ownership logic and sharing.

**Suggestion:** Introduce a concept of a "personal team" for each user.

1.  When a user signs up, automatically create a "personal" team for them.
2.  The `teamTable` already has an `isPersonalTeam` flag, which is great.
3.  Associate all user-created resources with their personal team.

**Benefits:**
*   **Unified Ownership Model:** All resources are owned by a team, simplifying permissions and access control.
*   **Simplified Sharing:** Sharing a resource becomes a matter of moving it from a personal team to a shared team.
*   **Consistent Logic:** Simplifies application logic by removing the need to handle both user and team ownership separately.
