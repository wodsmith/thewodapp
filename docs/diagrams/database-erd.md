# Database Entity Relationship Diagram

This diagram shows the complete database schema for the application, including user management, multi-tenancy, billing, and workout tracking systems.

```mermaid
erDiagram
    %% User Management
    user {
        text id PK "usr_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text firstName
        text lastName
        text email UK
        text passwordHash
        text role "admin|user"
        integer emailVerified
        text signUpIpAddress
        text googleAccountId
        text avatar
        integer currentCredits
        integer lastCreditRefreshAt
    }

    passkey_credential {
        text id PK "pkey_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text userId FK
        text credentialId UK
        text credentialPublicKey
        integer counter
        text transports
        text aaguid
        text userAgent
        text ipAddress
    }

    %% Billing & Credits
    credit_transaction {
        text id PK "ctxn_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text userId FK
        integer amount
        integer remainingAmount
        text type "PURCHASE|USAGE|MONTHLY_REFRESH"
        text description
        integer expirationDate
        integer expirationDateProcessedAt
        text paymentIntentId
    }

    purchased_item {
        text id PK "pitem_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text userId FK
        text itemType "COMPONENT"
        text itemId
        integer purchasedAt
    }

    %% Multi-Tenancy (Teams)
    team {
        text id PK "team_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text name
        text slug UK
        text description
        text avatarUrl
        text settings "JSON"
        text billingEmail
        text planId
        integer planExpiresAt
        integer creditBalance
    }

    team_membership {
        text id PK "tmem_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text teamId FK
        text userId FK
        text roleId "system role or custom role ID"
        integer isSystemRole "1=system, 0=custom"
        text invitedBy FK
        integer invitedAt
        integer joinedAt
        integer expiresAt
        integer isActive
    }

    team_role {
        text id PK "trole_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text teamId FK
        text name
        text description
        text permissions "JSON array"
        text metadata "JSON UI settings"
        integer isEditable
    }

    team_invitation {
        text id PK "tinv_[cuid]"
        integer createdAt
        integer updatedAt
        integer updateCounter
        text teamId FK
        text email
        text roleId "system role or custom role ID"
        integer isSystemRole "1=system, 0=custom"
        text token UK
        text invitedBy FK
        integer expiresAt
        integer acceptedAt
        text acceptedBy FK
    }

    %% Workout System
    movements {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text name
        text type "weightlifting|gymnastic|monostructural"
    }

    spicy_tags {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text name UK
    }

    workouts {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text name
        text description
        text scope "private|public"
        text scheme "time|time-with-cap|pass-fail|rounds-reps|reps|emom|load|calories|meters|feet|points"
        integer repsPerRound
        integer roundsToScore
        text userId FK
        text sugarId
        text tiebreakScheme "time|reps"
        text secondaryScheme
    }

    workout_movements {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text workoutId FK
        text movementId FK
    }

    workout_tags {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text workoutId FK
        text tagId FK
    }

    results {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text userId FK
        integer date
        text workoutId FK
        text type "wod|strength|monostructural"
        text notes
        text scale "rx|scaled|rx+"
        text wodScore
        integer setCount
        integer distance
        integer time
    }

    sets {
        text id PK
        integer createdAt
        integer updatedAt
        integer updateCounter
        text resultId FK
        integer setNumber
        integer reps
        integer weight
        text status "pass|fail"
        integer distance
        integer time
        integer score
    }

    %% Cache Tables (OpenNext)
    tags_cache {
        text tag
        text path
    }

    revalidations {
        text tag UK
        integer revalidatedAt
    }

    %% Relationships
    user ||--o{ passkey_credential : "has"
    user ||--o{ credit_transaction : "has"
    user ||--o{ purchased_item : "owns"
    user ||--o{ team_membership : "member"
    user ||--o{ team_membership : "inviter"
    user ||--o{ team_invitation : "inviter"
    user ||--o{ team_invitation : "acceptor"
    user ||--o{ workouts : "creates"
    user ||--o{ results : "records"

    team ||--o{ team_membership : "has"
    team ||--o{ team_role : "defines"
    team ||--o{ team_invitation : "sends"

    team_role ||--o{ team_membership : "assigned_to"
    team_role ||--o{ team_invitation : "invited_as"

    workouts ||--o{ workout_movements : "contains"
    workouts ||--o{ workout_tags : "tagged_with"
    workouts ||--o{ results : "performed_as"

    movements ||--o{ workout_movements : "used_in"
    spicy_tags ||--o{ workout_tags : "applied_to"

    results ||--o{ sets : "contains"
```

## Key Features

### User Management

- **Users**: Core user accounts with authentication and profile data
- **Passkey Credentials**: WebAuthn/FIDO2 passwordless authentication
- **Google SSO**: OAuth integration for Google sign-in

### Multi-Tenancy

- **Teams**: Primary organizational units with billing and settings
- **Team Memberships**: User-team relationships with roles
- **Team Roles**: Custom roles with granular permissions
- **Team Invitations**: Email-based invitation system

### Billing & Credits

- **Credit Transactions**: Track credit purchases, usage, and refreshes
- **Purchased Items**: Track component and feature purchases

### Workout Tracking

- **Workouts**: Exercise routines with various scoring schemes
- **Movements**: Exercise types (weightlifting, gymnastic, monostructural)
- **Tags**: Categorization system for workouts
- **Results**: User performance records
- **Sets**: Individual set data within results

### System Features

- **Audit Trail**: All tables include `createdAt`, `updatedAt`, and `updateCounter`
- **Soft Deletes**: Using `isActive` flags where appropriate
- **Flexible Permissions**: JSON-based permission system for teams
- **Caching**: OpenNext cache tables for performance optimization
