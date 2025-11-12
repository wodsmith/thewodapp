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
1. No concept of competition-specific teams (separate from organizing teams)
2. No athlete profile fields (gender/sex for divisions)
3. No leaderboard functionality
4. No competition registration system
5. No team ownership model for events and revenue
6. No competition schedule visualization

## Proposed Architecture

### Team Ownership Model

The competition platform uses a dual-team structure:

1. **Organizing Team/Gym** (Long-term Client)
   - Any gym team with `canHostCompetitions=true` (e.g., MWFC gym)
   - The gym uses WODsmith for regular programming AND can host competitions
   - Creates event series and individual events
   - Collects revenue from athlete registrations
   - Has full admin access to all their events
   - Pays for the WODsmith Compete add-on feature
   - Routes are scoped to this team: `/team/{teamSlug}/compete/...`

2. **Competition Event Team** (Event Management)
   - Auto-created for each competition event (type='competition_event')
   - Used for athlete registration and event operations
   - Athletes join this team when they register for the event
   - Event directors/judges are members of this team
   - Manages workouts, scores, and leaderboards for that specific event
   - Child relationship to the organizing gym via `parentOrganizationId`

**Example Structure:**
- Organizing Gym: `mwfc` (type='gym', canHostCompetitions=true)
  - Uses WODsmith for daily gym programming
  - Also hosts competitions
  - Competition Event Team: `mwfc-cfr7-2026` (type='competition_event', parentOrganizationId='mwfc')
  - Competition Event Team: `mwfc-verdant-2026` (type='competition_event', parentOrganizationId='mwfc')
  - Competition Event Team: `mwfc-online-qualifier-2026` (type='competition_event', parentOrganizationId='mwfc')

**Feature Access:**
- Personal teams (type='personal'): Cannot host competitions (canHostCompetitions always false)
- Gym teams (type='gym'): Can enable competition hosting as an add-on feature

### 1. MVP Features

#### Core Features
1. **Event Grouping System**: Organize multiple competitions into series/groups (e.g., a series of qualifier events leading to a championship)
2. **Workout Schedule**: Display competition workouts with release times
3. **Leaderboard**: Real-time scoring across divisions
4. **Athlete Registration**: Sign-up flow for competition participants (creates membership in competition team)

#### Supporting Features
- Division management (Male/Female × skill levels)
- Score submission and validation
- Competition timeline/story view
- Link to external application forms (Jon's existing form)
- Event series management (group related competitions)
- Revenue tracking per organizing team

### 2. Stretch Goals (Post-MVP)
- **Custom Subdomain Structure**: Allow organizations to use custom subdomains (e.g., `mwfc.wodsmith.com`) instead of standard routes
- **Whitelabel Branding**: Custom logos, colors, and branding per organization
- **Advanced Analytics**: Detailed competition and athlete performance analytics

## Database Schema Changes

### 1. Teams Table Modifications
```sql
-- Keep existing team type for basic categorization
-- type remains: 'gym' (default), 'competition_event', 'personal'
-- Note: We remove 'competition_organizer' as a type since gyms can be both gym AND organizer

-- Add feature flags for capabilities
ALTER TABLE team ADD COLUMN canHostCompetitions BOOLEAN DEFAULT FALSE;
-- When TRUE, this gym/team can create and host competitions

-- Add parent organization ID for competition event teams
-- This links a competition_event team back to the gym that created it
ALTER TABLE team ADD COLUMN parentOrganizationId TEXT
  REFERENCES team(id);

-- Add competition-specific metadata
ALTER TABLE team ADD COLUMN competitionMetadata TEXT; -- JSON

-- Notes:
-- - type='gym' + canHostCompetitions=TRUE = A gym that can host competitions (e.g., MWFC gym)
-- - type='gym' + canHostCompetitions=FALSE = Regular gym using WODsmith for programming only
-- - type='competition_event' = Specific competition instance (e.g., cfr7-2026), always has parentOrganizationId
-- - type='personal' = Individual athlete accounts (canHostCompetitions always FALSE)
-- - Competition hosting is a gym-level feature, not available for personal teams
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
-- Competition Event Groups (for organizing series of events)
CREATE TABLE competition_event_groups (
  id TEXT PRIMARY KEY,
  organizingTeamId TEXT REFERENCES team(id), -- The competition_organizer team
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(organizingTeamId, slug)
);

-- Competition Events
CREATE TABLE competition_events (
  id TEXT PRIMARY KEY,
  organizingTeamId TEXT REFERENCES team(id), -- The organizing gym (owner/revenue collector)
  competitionTeamId TEXT REFERENCES team(id), -- The competition_event team (auto-created for athlete management)
  eventGroupId TEXT REFERENCES competition_event_groups(id), -- Optional: for grouping events
  slug TEXT NOT NULL UNIQUE, -- GLOBALLY UNIQUE - used in public URLs like /compete/{slug}
  name TEXT NOT NULL,
  description TEXT,
  startDate INTEGER NOT NULL,
  endDate INTEGER NOT NULL,
  registrationOpensAt INTEGER,
  registrationClosesAt INTEGER,
  registrationFee INTEGER, -- In cents
  externalRegistrationUrl TEXT,
  settings TEXT, -- JSON
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Note: slug must be globally unique across ALL competitions since public URLs are /compete/{slug}
-- This means two different gyms cannot both create an event with slug "qualifier"
-- Consider prefixing with gym slug or year if needed (e.g., "mwfc-cfr7-2026" or just "cfr7")

-- Competition Registrations
-- Note: When an athlete registers, they also become a member of the competition_event team
CREATE TABLE competition_registrations (
  id TEXT PRIMARY KEY,
  eventId TEXT REFERENCES competition_events(id),
  userId TEXT REFERENCES user(id),
  teamMemberId TEXT REFERENCES team_member(id), -- Link to the team_member record in competition_event team
  divisionId TEXT REFERENCES scaling_levels(id),
  registrationData TEXT, -- JSON
  status TEXT CHECK (status IN ('pending', 'confirmed', 'withdrawn', 'refunded')),
  paymentStatus TEXT CHECK (paymentStatus IN ('unpaid', 'paid', 'refunded')),
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

Competition routes are organized to be simple for public/athletes and comprehensive for admins.

### Public Routes (No Auth Required)
Athletes don't need to know about organizing teams - they just care about the event.

- `/compete` - Global competition discovery page (all public competitions)
- `/compete/{eventSlug}` - Competition details and info
- `/compete/{eventSlug}/leaderboard` - Public leaderboard
- `/compete/{eventSlug}/workouts` - Workout schedule

**Example URLs:**
- `/compete/cfr7` - CrossFit Round 7 competition
- `/compete/verdant` - Verdant competition
- `/compete/online-qualifier` - Online qualifier
- `/compete/cfr7/leaderboard` - CFR7 leaderboard
- `/compete/cfr7/workouts` - CFR7 workout schedule

### Athlete Routes (Auth Required)
- `/compete/{eventSlug}/register` - Registration flow (creates team membership in competition_event team)
- `/compete/{eventSlug}/submit` - Score submission (submitted to competition_event team)
- `/compete/profile` - Athlete profile (shared across all competitions)
- `/compete/my-events` - List of all competitions the athlete is registered for

### Admin Routes - Organizing Team (Gym with canHostCompetitions=true)
Admins need the team context to manage their competitions.

**Competition Management:**
- `/admin/compete/{teamSlug}` - Competition dashboard for this organizing team
- `/admin/compete/{teamSlug}/events` - List all events for this team
- `/admin/compete/{teamSlug}/events/create` - Create new competition (auto-creates competition_event team)
- `/admin/compete/{teamSlug}/events/{eventSlug}` - Event overview and settings
- `/admin/compete/{teamSlug}/events/{eventSlug}/edit` - Edit event details

**Event Series/Groups (Admin-only organizational tool):**
- `/admin/compete/{teamSlug}/series` - Manage event series/groups
- `/admin/compete/{teamSlug}/series/create` - Create new event series
- `/admin/compete/{teamSlug}/series/{seriesSlug}` - View/edit series (shows all events in group)
- Event series are for organizing multiple events (e.g., "Throwdowns" series containing CFR7, Verdant, Championship)
- Series are NOT public-facing routes - they're admin organizational tools

**Revenue & Analytics:**
- `/admin/compete/{teamSlug}/revenue` - Revenue tracking and analytics
- `/admin/compete/{teamSlug}/analytics` - Competition performance metrics

**Example Admin URLs:**
- `/admin/compete/mwfc` - MWFC's competition dashboard
- `/admin/compete/mwfc/events` - All MWFC events
- `/admin/compete/mwfc/series/throwdowns` - Manage the Throwdowns series (CFR7, Verdant, etc.)
- `/admin/compete/mwfc/revenue` - MWFC revenue tracking

### Event Management Routes (Competition Event Team Context)
Event directors/judges work within the competition_event team context.

- `/team/{competitionEventTeamSlug}/workouts` - Schedule and manage workouts
- `/team/{competitionEventTeamSlug}/athletes` - Manage athlete registrations
- `/team/{competitionEventTeamSlug}/scores` - Score validation and management
- `/team/{competitionEventTeamSlug}/dashboard` - Event-specific dashboard

**Example Event Management URLs:**
- `/team/mwfc-cfr7-2026/workouts` - Manage CFR7 workouts
- `/team/mwfc-cfr7-2026/athletes` - Manage CFR7 athlete registrations
- `/team/mwfc-cfr7-2026/scores` - Validate CFR7 scores

**Note:** Organizing team admins automatically have access to all their competition_event team routes

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. **Database Schema Updates**
   - Add team type field
   - Create competition event group tables
   - Create competition event tables
   - Add user profile fields

2. **Core Routing Structure**
   - Implement `/compete` route structure
   - Create event group (series) pages
   - Create individual event pages
   - Set up organization/team context for competitions

### Phase 2: Competition Management (Week 2-3)
1. **Event & Series Creation**
   - Admin interface for creating event series/groups
   - Admin interface for creating competitions
   - Link events to series
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
- **Organizing Gyms**: Regular gym teams (type='gym') with `canHostCompetitions=true` (e.g., `mwfc`)
- **Competition Event Teams**: Auto-created with type='competition_event' (e.g., `mwfc-cfr7-2026`)
- Parent-child relationship: competition_event teams reference their organizing gym via `parentOrganizationId`
- Athlete registration creates team_member record in the competition_event team
- Workouts and scores are linked to the competition_event team
- Revenue and billing are tracked at the organizing gym level
- The same gym can use WODsmith for daily programming AND host competitions

### 3. Registration & Team Membership Flow

**When an athlete registers for a competition:**
1. Athlete navigates to `/team/{organizingTeamSlug}/compete/events/{eventSlug}/register`
2. Athlete completes registration form (division selection, profile completion)
3. System creates:
   - `competition_registration` record linking user to event
   - `team_member` record adding user to the `competition_event` team
   - Payment intent for registration fee (tracked to organizing team)
4. Athlete can now:
   - Submit scores (as member of competition_event team)
   - View their results on leaderboard
   - Access event-specific content

**Team Membership Hierarchy:**
- User joins organizing gym: NO (they don't become MWFC gym members)
- User joins competition_event team: YES (they become cfr7-2026 members)
- Event directors/judges are also members of competition_event team with elevated permissions
- Organizing gym admins automatically have admin access to all their competition_event teams

### 4. Onboarding Flow
- Detection: Check if user has personal team
- Competition users: Special onboarding without gym selection
- Post-competition: Prompt to join WODsmith for training

### 5. Performance Optimization
- Materialized leaderboard views for fast queries
- Edge caching for public leaderboard pages
- Background jobs for score recalculation

## Business Model Integration

### Revenue Opportunities
1. **Competition Hosting Add-on**
   - Add-on feature for existing gym customers
   - Pricing tiers based on:
     - Number of events per year
     - Number of athlete registrations
     - Commission percentage on registration fees
   - Gyms already paying for WODsmith get preferential pricing

2. **Athlete Conversion**
   - Free competition participation
   - Upsell to WODsmith training subscription after competition
   - Special pricing for competition athletes who want to join a gym

3. **Premium Features**
   - Advanced analytics for competition organizers
   - Video submission integration
   - Live streaming integration
   - Custom branding/whitelabel (stretch goal)

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

**As Organizing Gym Admin (MWFC):**
1. MWFC gym already exists as type='gym', enable competition hosting feature (canHostCompetitions=true)
2. Navigate to `/admin/compete/mwfc` - Competition dashboard
3. Create "Throwdowns" event series at `/admin/compete/mwfc/series/create`
4. Create competitions at `/admin/compete/mwfc/events/create`:
   - CFR7 → auto-creates `mwfc-cfr7-2026` competition_event team → public URL: `/compete/cfr7`
   - Verdant → auto-creates `mwfc-verdant-2026` competition_event team → public URL: `/compete/verdant`
   - Championship → auto-creates `mwfc-championship-2026` competition_event team → public URL: `/compete/championship`
5. Assign all three events to "Throwdowns" series at `/admin/compete/mwfc/series/throwdowns`
6. View revenue dashboard at `/admin/compete/mwfc/revenue`
7. Continue using WODsmith for regular gym programming alongside competition hosting

**As Public Athlete:**
1. Navigate to `/compete` - Browse all available competitions
2. Click "CrossFit Round 7" → navigate to `/compete/cfr7`
3. View event details with link to external application form
4. Register for competition at `/compete/cfr7/register`
   - Athlete becomes member of `mwfc-cfr7-2026` team
   - Payment processed, revenue tracked to MWFC organizing team
5. View live leaderboard at `/compete/cfr7/leaderboard`
6. Check workout schedule at `/compete/cfr7/workouts`
7. Submit scores at `/compete/cfr7/submit`
8. View all registered events at `/compete/my-events` (shows CFR7, plus any other competitions)

**As Event Director/Judge:**
1. Granted access to `mwfc-cfr7-2026` competition_event team
2. Manage workouts at `/team/mwfc-cfr7-2026/workouts`
3. Validate scores at `/team/mwfc-cfr7-2026/scores`
4. Manage athlete registrations at `/team/mwfc-cfr7-2026/athletes`

**Key Insights:**
- Athletes never see "MWFC" or team slugs - they just see `/compete/cfr7`
- Event slugs must be globally unique across all competitions
- Admin URLs include team context: `/admin/compete/mwfc/...`
- Event series (like "Throwdowns") are admin-only organizational tools, not public routes

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