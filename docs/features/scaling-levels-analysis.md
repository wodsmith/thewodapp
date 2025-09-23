# Workout Scaling Levels - System Architecture & Implementation Plan

## Current System Architecture

### Existing Scaling Implementation

```mermaid
graph TD
    A[Results Table] -->|scale: rx/scaled/rx+| B[Fixed Enum Values]
    C[Scheduled Workout Instance] -->|scalingGuidanceForDay: text| D[Free-form Text Field]

    B --> E[Hard-coded UI Components]
    D --> F[Display as Notes]

    G[Log Form] -->|Radio buttons| B
    H[Result Display] -->|Badge variant| B
```

### Current Database Relationships

```mermaid
erDiagram
    teams ||--o{ workouts : "owns"
    teams ||--o{ programming_tracks : "owns"
    teams ||--o{ scheduled_workout_instances : "schedules"

    programming_tracks ||--o{ track_workouts : "contains"
    workouts ||--o{ track_workouts : "included in"
    workouts ||--o{ results : "has"
    workouts ||--|| workouts : "sourceWorkoutId (remix)"

    track_workouts ||--o{ scheduled_workout_instances : "scheduled as"
    scheduled_workout_instances ||--o{ results : "logged for"

    users ||--o{ results : "submits"

    results {
        text scale "ENUM: rx, scaled, rx+"
        text wodScore
        text workoutId FK
        text scheduledWorkoutInstanceId FK
    }

    scheduled_workout_instances {
        text scalingGuidanceForDay "free text"
        text teamSpecificNotes
        text workoutId FK
        text trackWorkoutId FK
    }
```

## Final Scaling Levels Architecture

### New Schema Design

```mermaid
erDiagram
    scaling_groups {
        text id PK
        text title
        text description
        text teamId "FK (nullable for system)"
        integer isDefault
        integer isSystem "marks global default"
        timestamp createdAt
        timestamp updatedAt
    }

    scaling_levels {
        text id PK
        text scalingGroupId FK
        text label
        integer position "0=hardest"
        timestamp createdAt
        timestamp updatedAt
    }

    workout_scaling_descriptions {
        text id PK
        text workoutId FK
        text scalingLevelId FK
        text description "optional"
        timestamp createdAt
        timestamp updatedAt
    }

    teams {
        text id PK
        text defaultScalingGroupId FK
        "...existing fields..."
    }

    programming_tracks {
        text id PK
        text scalingGroupId FK
        "...existing fields..."
    }

    workouts {
        text id PK
        text scalingGroupId FK
        "...existing fields..."
    }

    results {
        text id PK
        text scalingLevelId "FK (required)"
        boolean asRx "true if performed as prescribed"
        text workoutId FK
        "...other fields..."
    }

    scaling_groups ||--o{ scaling_levels : "contains"
    teams ||--o{ scaling_groups : "owns/uses"
    programming_tracks ||--o| scaling_groups : "uses"
    workouts ||--o| scaling_groups : "uses"
    workouts ||--o{ workout_scaling_descriptions : "has optional"
    scaling_levels ||--o{ workout_scaling_descriptions : "described by"
    scaling_levels ||--o{ results : "logged at"
    teams ||--o| scaling_groups : "defaultScalingGroupId"
```

### Scaling Resolution Flow (4-Level Priority)

```mermaid
graph TD
    Start[Need Scaling for Workout] --> Check1{Workout has<br/>scalingGroupId?}
    Check1 -->|Yes| Use1[Use Workout's<br/>Scaling Group]
    Check1 -->|No| Check2{Workout in<br/>Track?}
    Check2 -->|Yes| Check2a{Track has<br/>scalingGroupId?}
    Check2a -->|Yes| Use2[Use Track's<br/>Scaling Group]
    Check2a -->|No| Check3{Team has<br/>defaultScalingGroupId?}
    Check2 -->|No| Check3
    Check3 -->|Yes| Use3[Use Team's<br/>Default Scaling]
    Check3 -->|No| Use4[Use Global Default<br/>Rx+/Rx/Scaled]

    Use1 --> Display[Display Scaling<br/>Levels to User]
    Use2 --> Display
    Use3 --> Display
    Use4 --> Display
```

### Result Storage and Display

```mermaid
graph TD
    A[User Logs Result] --> B[Select from Available<br/>Scaling Levels]
    B --> C{Performed<br/>As Prescribed?}
    C -->|Yes| D[Store scalingLevelId<br/>+ asRx: true]
    C -->|No/Modified| E[Store scalingLevelId<br/>+ asRx: false]

    F[Display Result] --> G[JOIN scaling_levels<br/>for label/position]
    G --> H[Check asRx flag]
    H -->|true| I[Show: Competition Rx]
    H -->|false| J[Show: Competition Scaled]

    G --> K[LEFT JOIN workout_scaling_descriptions<br/>for optional description]
```

### Workout Remixing Flow

```mermaid
graph TD
    A[External Workout<br/>Added to Track] --> B[Display As-Is<br/>Initially]
    B --> C{Scaling<br/>Mismatch?}
    C -->|Yes| D[Show Mismatch<br/>Indicator ⚠️]
    C -->|No| E[Normal Display]

    D --> F{Owner Chooses<br/>to Align?}
    F -->|Yes| G[Show Description<br/>Migration UI]
    G --> H[Create Remix<br/>Under Team]
    H --> I[Apply New<br/>Scaling Group]
    F -->|No| J[Keep Original<br/>Scaling]
```

## Key Implementation Details

### 1. **Data Migration Strategy**
- Create global default scaling group (id: "global_default") with Rx+/Rx/Scaled
- Migrate all existing results.scale enum values to reference these levels
- Drop scale enum column after migration complete

### 2. **Results System**
- Results store `scalingLevelId` + `asRx` boolean flag
- `asRx` = true: Performed as prescribed at that scaling level
- `asRx` = false: Modified/scaled within that level
- Display shows "Competition Rx" or "Competition Scaled" based on flag
- Scaling descriptions fetched via JOIN when displaying
- No duplication of scaling data in results table

### 3. **Remix Behavior**
- No automatic remixing - always explicit user action
- Visual indicators when scaling mismatches exist
- Description migration UI preserves context when remixing

### 4. **Team Isolation**
- Scaling groups readable by anyone who can read the workout
- Changing scaling triggers remix under your team
- Proper multi-tenant isolation maintained

### 5. **Performance Optimizations**
- Composite indexes on all foreign keys
- Caching strategy for scaling groups (KV/Redis)
- Global default cached in application memory
- Batch fetching for workout lists

## Implementation Issues (Linear)

### Phase 1: Database Schema ⚡ URGENT
- **WOD-50**: Create scaling groups and levels database schema
- **WOD-64**: Create global default scaling group for legacy data migration
- **WOD-51**: Update results table schema for scaling compatibility
- **WOD-52**: Generate and test database migration

### Phase 2: Backend Implementation
- **WOD-53**: Create scaling levels server functions
- **WOD-54**: Update result logging logic for unified scaling system
- **WOD-65**: Implement results query logic with scaling descriptions

### Phase 3: Frontend Implementation
- **WOD-56**: Create scaling group management UI
- **WOD-57**: Update result logging UI for new scaling system
- **WOD-58**: Update result display components for custom scaling
- **WOD-62**: Implement on-demand workout remixing
- **WOD-63**: Add scaling group selector to workout creation/edit forms
- **WOD-66**: Create scaling mismatch indicator UI component
- **WOD-67**: Implement scaling description migration UI

### Phase 4: Optimization & Polish
- **WOD-68**: Performance optimization for scaling queries
- **WOD-59**: Write comprehensive tests for scaling levels
- **WOD-60**: Create migration path documentation
- **WOD-61**: Documentation and code cleanup

## Summary

The refined scaling levels system provides:

✅ **Clear Resolution Path** - 4-level priority system that's predictable and flexible
✅ **Clean Migration** - Existing data seamlessly migrates to new system
✅ **No Auto-Remixing** - Explicit user control over workout duplication
✅ **Proper Isolation** - Multi-tenant boundaries respected
✅ **Performance Ready** - Caching and indexing strategies defined
✅ **Unified UX** - Single scaling system, no confusion

This architecture maintains backward compatibility while enabling teams to define custom scaling levels that match their specific needs.