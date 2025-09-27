# Throwdown Competition Platform - Feature Requirements

## Executive Summary

This document outlines the requirements for building a competition management platform ("WODsmith Compete") integrated with the existing WODsmith application. Jon wants to add the 2026 schedule with links to throwdown applications for gyms, and the platform will host CrossFit competitions (throwdowns) under a whitelabel subdomain structure.

## Current State Analysis

### Existing Infrastructure That Can Be Leveraged
- **Workouts System**: Fully functional workout creation and management system
- **Scaling Levels**: Recently implemented scaling groups/levels that can represent competition divisions (Male/Female × RX/Intermediate/Rookie)
- **Programming Tracks**: Can be adapted for competition schedules
- **Results/Scoring**: Existing result submission and storage system
- **Team Management**: Multi-tenant architecture with team-based data isolation
- **Authentication**: Lucia Auth with session management

### Key Gaps to Address
1. No concept of competition-specific teams/organizations
2. No athlete profile fields (gender/sex for divisions)
3. No leaderboard functionality
4. No competition registration system
5. No competition-specific routing/subdomain handling
6. No competition schedule visualization

## Proposed Architecture

### 1. Subdomain Structure
- Pattern: `{organization}.wodsmith.com/throwdowns/{event}`
- Examples:
  - `mwfc.wodsmith.com/throwdowns/cfr7`
  - `mwfc.wodsmith.com/throwdowns/verdant`
  - `mwfc.wodsmith.com/online-qualifier`

### 2. MVP Features

#### Core Features
1. **Workout Schedule**: Display competition workouts with release times
2. **Leaderboard**: Real-time scoring across divisions
3. **Athlete Registration**: Sign-up flow for competition participants

#### Supporting Features
- Division management (Male/Female × skill levels)
- Score submission and validation
- Competition timeline/story view
- Link to external application forms (Jon's existing form)

## Database Schema Changes

### 1. Teams Table Modifications
```sql
-- Add team type to distinguish regular gyms from competitions
ALTER TABLE team ADD COLUMN type TEXT DEFAULT 'gym'
  CHECK (type IN ('gym', 'competition', 'personal'));

-- Add parent organization ID for competition instances
ALTER TABLE team ADD COLUMN parentOrganizationId TEXT
  REFERENCES team(id);

-- Add competition-specific metadata
ALTER TABLE team ADD COLUMN competitionMetadata TEXT; -- JSON
```

### 2. Users Table Modifications
```sql
-- Add athlete profile fields
ALTER TABLE user ADD COLUMN gender TEXT
  CHECK (gender IN ('male', 'female', 'non-binary', 'prefer-not-to-say'));
ALTER TABLE user ADD COLUMN dateOfBirth INTEGER;
ALTER TABLE user ADD COLUMN athleteProfile TEXT; -- JSON for extended profile
```

### 3. New Competition Tables
```sql
-- Competition Events
CREATE TABLE competition_events (
  id TEXT PRIMARY KEY,
  organizationId TEXT REFERENCES team(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  startDate INTEGER NOT NULL,
  endDate INTEGER NOT NULL,
  registrationOpensAt INTEGER,
  registrationClosesAt INTEGER,
  externalRegistrationUrl TEXT,
  settings TEXT, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organizationId, slug)
);

-- Competition Registrations
CREATE TABLE competition_registrations (
  id TEXT PRIMARY KEY,
  eventId TEXT REFERENCES competition_events(id),
  userId TEXT REFERENCES user(id),
  divisionId TEXT REFERENCES scaling_levels(id),
  registrationData TEXT, -- JSON
  status TEXT CHECK (status IN ('pending', 'confirmed', 'withdrawn')),
  registeredAt INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(eventId, userId)
);

-- Competition Leaderboards (materialized view pattern)
CREATE TABLE competition_leaderboards (
  id TEXT PRIMARY KEY,
  eventId TEXT REFERENCES competition_events(id),
  workoutId TEXT REFERENCES workouts(id),
  divisionId TEXT REFERENCES scaling_levels(id),
  userId TEXT REFERENCES user(id),
  rank INTEGER,
  score TEXT,
  tiebreak TEXT,
  points INTEGER,
  lastUpdated INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### 4. Adapt Existing Schemas

#### Use Scaling Levels for Divisions
```typescript
// Example division structure using scaling groups
const competitionDivisions = {
  scalingGroupId: "sgrp_mwfc_2025",
  title: "MWFC 2025 Divisions",
  levels: [
    { label: "Male RX", position: 0 },
    { label: "Female RX", position: 1 },
    { label: "Male Intermediate", position: 2 },
    { label: "Female Intermediate", position: 3 },
    { label: "Male Rookie", position: 4 },
    { label: "Female Rookie", position: 5 }
  ]
}
```

## Application Routes & Pages

### Public Routes (No Auth Required)
- `/{org}.wodsmith.com` - Organization landing page
- `/{org}.wodsmith.com/throwdowns` - List of competitions
- `/{org}.wodsmith.com/throwdowns/{event}` - Competition details
- `/{org}.wodsmith.com/throwdowns/{event}/leaderboard` - Public leaderboard
- `/{org}.wodsmith.com/throwdowns/{event}/workouts` - Workout schedule

### Athlete Routes (Auth Required)
- `/{org}.wodsmith.com/throwdowns/{event}/register` - Registration flow
- `/{org}.wodsmith.com/throwdowns/{event}/submit` - Score submission
- `/{org}.wodsmith.com/throwdowns/{event}/profile` - Athlete profile

### Admin Routes (Competition Admin)
- `/{org}.wodsmith.com/admin/events` - Manage competitions
- `/{org}.wodsmith.com/admin/events/{event}/workouts` - Schedule workouts
- `/{org}.wodsmith.com/admin/events/{event}/athletes` - Manage registrations
- `/{org}.wodsmith.com/admin/events/{event}/scores` - Score validation

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. **Database Schema Updates**
   - Add team type field
   - Create competition event tables
   - Add user profile fields

2. **Subdomain Routing**
   - Configure Cloudflare for wildcard subdomains
   - Implement subdomain detection middleware
   - Create organization context provider

### Phase 2: Competition Management (Week 2-3)
1. **Event Creation**
   - Admin interface for creating competitions
   - Division setup using scaling groups
   - Workout scheduling

2. **Registration System**
   - Public registration flow
   - Division selection
   - Profile completion

### Phase 3: Core Competition Features (Week 3-4)
1. **Leaderboard Engine**
   - Real-time score calculation
   - Division filtering
   - Ranking algorithms

2. **Score Submission**
   - Athlete score entry
   - Judge validation workflow
   - Score dispute handling

### Phase 4: Polish & Launch (Week 4-5)
1. **User Experience**
   - Competition timeline view
   - Mobile-optimized interfaces
   - Email notifications

2. **Integration**
   - Onboarding flow for competition athletes
   - Data migration for existing users
   - External registration link handling

## Technical Considerations

### 1. Monorepo Structure
- Consider Turborepo + pnpm workspaces
- Separate apps:
  - `apps/wodsmith` - Main application
  - `apps/compete` - Competition platform
  - `packages/shared` - Shared utilities and components

### 2. Data Architecture
- Competitions as special "teams" with type='competition'
- Year-specific instances (e.g., `mwfc-throwdown-verdant-2025`)
- Athlete scores linked to both user and competition team

### 3. Onboarding Flow
- Detection: Check if user has personal team
- Competition users: Special onboarding without gym selection
- Post-competition: Prompt to join WODsmith for training

### 4. Performance Optimization
- Materialized leaderboard views for fast queries
- Edge caching for public leaderboard pages
- Background jobs for score recalculation

## Business Model Integration

### Revenue Opportunities
1. **Competition Hosting Fees**
   - Per-event pricing
   - Annual unlimited plan
   - Commission on registrations

2. **Athlete Conversion**
   - Free competition participation
   - Upsell to WODsmith training subscription
   - Special pricing for competition athletes

3. **Premium Features**
   - Advanced analytics
   - Video submission integration
   - Live streaming integration

## Success Metrics

### Technical Metrics
- Page load time < 1s for leaderboards
- Score submission success rate > 99%
- Zero data inconsistencies

### Business Metrics
- Competition athlete → WODsmith user conversion rate
- Number of competitions hosted
- Athlete satisfaction scores

## Demo Scenario for Jon

**Mountain West Fitness Championship 2026**
1. Navigate to `mwfc.wodsmith.com`
2. View 2026 competition schedule
3. Click "CrossFit Round 7" → redirects to application form
4. Show athlete registration flow
5. Display live leaderboard with divisions
6. Demonstrate score submission
7. Show competition timeline/story view

## Open Questions

1. **Authentication**: Should competition athletes create full WODsmith accounts or lightweight competition-only accounts?
2. **Pricing**: What's the pricing model for competition hosting?
3. **Integration**: How deep should the integration with external registration systems be?
4. **Data Retention**: How long do we keep competition data active vs archived?
5. **Judging**: Do we need a judge validation system for scores?

## Next Steps

1. Review requirements with Jon
2. Finalize MVP feature set
3. Set up monorepo structure
4. Begin Phase 1 implementation
5. Create design mockups for key interfaces

---

*This document represents the initial requirements gathering for the WODsmith Compete platform. It should be reviewed and updated as the project progresses.*