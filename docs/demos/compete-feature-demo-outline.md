# WODsmith Compete - Feature Demo Outline

## Overview

**WODsmith Compete** is a comprehensive competition management platform integrated into WODsmith, designed to help CrossFit gyms host professional-grade "throwdown" competitions. The platform serves two primary user personas:

1. **Competition Organizers** - Gym owners who create and manage competitions
2. **Athletes** - Participants who register, compete, and track their performance

---

## Demo Agenda

| Section | Duration | Focus |
|---------|----------|-------|
| 1. Platform Overview | 2 min | High-level introduction |
| 2. Athlete Experience | 8 min | Discovery, registration, competition day |
| 3. Organizer Experience | 12 min | Setup, management, day-of operations |
| 4. Live Competition Flow | 5 min | Real-time scoring & leaderboards |
| 5. Q&A | 3 min | Questions and discussion |

---

## Section 1: Platform Overview (2 min)

### Key Value Propositions

- **For Gyms**: Turn your gym into a competition venue with built-in registration, payments, scheduling, and live leaderboards
- **For Athletes**: One platform to discover competitions, register, view schedules, and track results
- **For the Community**: Professional competition experience without enterprise software complexity

### Architecture Highlights

- **Dual-Team Model**: Organizing gym creates competitions; each competition auto-creates its own team for athlete management
- **Built on Existing Infrastructure**: Leverages WODsmith's workout system, scaling levels (divisions), and scheduling
- **Stripe Integration**: Seamless payment processing with configurable fees per division

---

## Section 2: Athlete Experience (8 min)

### 2.1 Competition Discovery (`/compete`)

**Demo Points:**
- Landing page shows all public competitions
- Search and filter functionality
- Competitions organized by:
  - Upcoming (registration open)
  - Past competitions
  - Registered vs. not registered (when logged in)
- Each competition card shows:
  - Name, dates, location
  - Banner/profile image
  - Registration status
  - Organizer info

**Key Routes:**
```
/compete                    - Competition discovery
/compete/[slug]             - Competition details
```

### 2.2 Competition Details Page (`/compete/[slug]`)

**Demo the tabbed interface:**

1. **Details Tab**
   - Competition hero with banner image
   - Event description and dates
   - Venue information
   - Sponsors display (organized by sponsor groups: Title, Gold, Silver, etc.)
   - Registration sidebar with:
     - Registration status (open/closed/dates)
     - Division-specific pricing
     - Register button

2. **Workouts Tab**
   - List of competition events/workouts
   - Each workout card shows:
     - Event name and number
     - Scheme (AMRAP, For Time, etc.)
     - Score type and tiebreaker info
     - Division-specific descriptions (RX vs Intermediate vs Rookie)
   - Points multiplier per event

3. **Leaderboard Tab**
   - Division filter dropdown
   - Real-time rankings
   - Overall points and per-event breakdown
   - Athlete/team names with affiliate information

4. **Schedule Tab**
   - Day-by-day heat schedule
   - Venue/floor information
   - Heat times with assigned athletes
   - Lane assignments

### 2.3 Registration Flow (`/compete/[slug]/register`)

**Demo the registration process:**

1. **Select Division** - Choose from available divisions (e.g., Male RX, Female Intermediate)
2. **Team Registration** (if applicable)
   - Enter team name
   - Individual or team competition support
3. **Affiliate Selection** - Search and select gym affiliation
4. **Payment** - Stripe checkout with division-specific fee
5. **Success Page** (`/compete/[slug]/register/success`)
   - Registration confirmation
   - Team invite link (for team competitions)
   - Profile completion form

### 2.4 Team Management (`/compete/[slug]/teams/[registrationId]`)

**For team competitions:**
- View team roster
- Copy and share invite link
- Edit affiliate information
- Pending teammate invitations

### 2.5 Team Invite Flow (`/compete/invite/[token]`)

**Demo accepting a team invite:**
- Token-based invite links
- Create account or sign in
- Automatically join the team

### 2.6 Athlete Profile (`/compete/athlete`)

**Demo the athlete dashboard:**

1. **Profile Overview**
   - Athlete header with profile image
   - Personal stats and benchmarks
   - Competitive history

2. **Edit Profile** (`/compete/athlete/edit`)
   - Name, gender, date of birth
   - Profile image upload
   - Social media links

3. **Sponsors** (`/compete/athlete/sponsors`)
   - Add personal sponsors
   - Logo and website URL
   - Display on profile

4. **Invoices** (`/compete/athlete/invoices`)
   - View registration purchases
   - Download PDF invoices
   - Payment history

---

## Section 3: Organizer Experience (12 min)

### 3.1 Organizer Dashboard (`/compete/organizer`)

**Demo Points:**
- List of all competitions for this organizing team
- Filter by team (if user has multiple organizing teams)
- Quick stats: total registrations, revenue
- Create new competition button

**Key Routes:**
```
/compete/organizer                           - Dashboard
/compete/organizer/new                       - Create competition
/compete/organizer/[competitionId]           - Competition management
/compete/organizer/series                    - Series management
```

### 3.2 Creating a Competition (`/compete/organizer/new`)

**Demo the creation form:**

1. **Basic Information**
   - Competition name
   - Unique slug (for public URL)
   - Description
   - Banner and profile images

2. **Dates**
   - Start and end dates
   - Registration opens/closes dates

3. **Settings**
   - Visibility (public/private)
   - Default registration fee
   - Platform fee percentage

4. **Result**: Auto-creates competition with dedicated team for athlete management

### 3.3 Competition Management Tabs

#### 3.3.1 Overview Tab (`/compete/organizer/[competitionId]`)

- Competition status (Draft, Published, Live, Completed)
- Quick actions (Edit, Publish, View Public Page)
- Key metrics at a glance

#### 3.3.2 Edit Competition (`/compete/organizer/[competitionId]/edit`)

- Update all basic information
- Change images
- Modify dates and settings

#### 3.3.3 Divisions Tab (`/compete/organizer/[competitionId]/divisions`)

**Demo division management:**

1. **Initialize from Template**
   - Select template (Standard 6-Division, Masters, etc.)
   - Or create custom divisions

2. **Division Configuration**
   - Division name and description
   - Registration fee (can override default)
   - Active/inactive status

3. **Leverages Scaling Levels**
   - Built on WODsmith's existing scaling system
   - Divisions map to scaling levels for workout variations

#### 3.3.4 Events/Workouts Tab (`/compete/organizer/[competitionId]/events`)

**Demo workout management:**

1. **Add Workouts**
   - Create new workout or select from library
   - Set event number/order
   - Configure points multiplier

2. **Event Configuration**
   - Name, scheme (AMRAP, For Time, Chipper, etc.)
   - Score type and tiebreaker
   - Division-specific descriptions

3. **Event Row Display**
   - Drag to reorder events
   - Quick edit and delete
   - View/hide toggle

#### 3.3.5 Schedule Tab (`/compete/organizer/[competitionId]/schedule`)

**Demo heat scheduling:**

1. **Venue Manager**
   - Create venues/floors (e.g., "Main Floor", "Outside Arena")
   - Set lane count per venue
   - Configure transition time between heats

2. **Heat Schedule Manager**
   - Create heats per workout
   - Set heat times
   - Assign athletes to heats and lanes

3. **Features**
   - Drag-and-drop athlete assignment
   - Auto-generate heats based on registrations
   - Division filtering
   - Bulk operations

#### 3.3.6 Athletes Tab (`/compete/organizer/[competitionId]/athletes`)

**Demo registration management:**

1. **Registration List**
   - View all registered athletes/teams
   - Filter by division, payment status
   - Search by name or affiliate

2. **Registration Details**
   - Team name and members
   - Payment status (Paid, Pending)
   - Registration date
   - Contact information

3. **Actions**
   - Manual registration approval
   - Payment tracking
   - Generate team invite links

#### 3.3.7 Results Tab (`/compete/organizer/[competitionId]/results`)

**Demo score entry:**

1. **Score Entry Form**
   - Select workout and division
   - Bulk entry interface
   - Score input with tiebreaker

2. **Score Input Row**
   - Athlete/team selection
   - Result input (time, reps, load)
   - Tiebreaker entry
   - Validation feedback

3. **Auto-calculation**
   - Points assigned based on rank
   - Leaderboard updates in real-time

#### 3.3.8 Sponsors Tab (`/compete/organizer/[competitionId]/sponsors`)

**Demo sponsor management:**

1. **Sponsor Groups**
   - Create groups (Title, Presenting, Gold, Silver, Bronze)
   - Set display order
   - Group-level styling

2. **Individual Sponsors**
   - Name, logo, website URL
   - Assign to group
   - Active/inactive toggle

3. **Display**
   - Sponsors appear on public competition page
   - Organized by group tier

#### 3.3.9 Pricing Tab (`/compete/organizer/[competitionId]/pricing`)

**Demo pricing configuration:**

1. **Default Registration Fee**
   - Set base price in cents
   - Applied to all divisions by default

2. **Division-Specific Pricing**
   - Override per division
   - Support for free divisions

3. **Platform Fee**
   - Configurable percentage
   - Shown in revenue calculations

#### 3.3.10 Revenue Tab (`/compete/organizer/[competitionId]/revenue`)

**Demo revenue tracking:**

1. **Revenue Stats Display**
   - Total revenue
   - Breakdown by division
   - Platform fees vs net revenue

2. **Payment Tracking**
   - List of all purchases
   - Payment status
   - Stripe integration details

#### 3.3.11 Danger Zone (`/compete/organizer/[competitionId]/danger-zone`)

- Delete competition (with confirmation)
- Archive options

### 3.4 Series Management (`/compete/organizer/series`)

**Demo organizing multiple competitions:**

1. **Create Series**
   - Group related competitions (e.g., "2026 Throwdown Series")
   - Series name and description

2. **Assign Competitions**
   - Add competitions to series
   - Order within series

---

## Section 4: Live Competition Flow (5 min)

### 4.1 Competition Day Workflow

**Demonstrate the full cycle:**

1. **Athlete Check-in**
   - Organizer views athlete list
   - Confirms registrations
   - Reviews heat assignments

2. **View Schedule**
   - Athletes see their assigned heats
   - Lane assignments displayed
   - Time remaining to heat

3. **Score Entry**
   - Judge/organizer enters results after workout
   - Scores validated and saved
   - Tiebreakers recorded

4. **Leaderboard Updates**
   - Points calculated automatically
   - Rankings update in real-time
   - Division-specific views

### 4.2 Scoring System

**Explain the leaderboard mechanics:**

1. **Points Calculation**
   - Configurable: winner_takes_more, even_spread, fixed_step
   - Points multiplier per event

2. **Tiebreaker Handling**
   - Time-based tiebreakers
   - Secondary score support

3. **Leaderboard Display**
   - Overall standings
   - Per-event breakdown
   - Movement indicators (+/- ranks)

---

## Section 5: Technical Highlights (Optional Deep Dive)

### Database Architecture

- **4 Core Tables**: competitions, competition_registrations, competition_venues, competition_heats
- **Leveraged Tables**: scaling_groups (divisions), workouts, results, sponsors
- **Commerce Integration**: Stripe for payments

### Key Server Functions

- `createCompetition()` - Auto-creates event team
- `registerForCompetition()` - Handles payment + team membership
- `getCompetitionLeaderboard()` - Real-time ranking calculations
- `saveCompetitionScore()` - Score entry with validation

### Route Structure

```
Public:
  /compete                         - Discovery
  /compete/[slug]                  - Competition details
  /compete/[slug]/register         - Registration
  /compete/invite/[token]          - Team invites

Athlete:
  /compete/athlete                 - Profile
  /compete/athlete/edit            - Edit profile
  /compete/athlete/sponsors        - Manage sponsors
  /compete/athlete/invoices        - View invoices

Organizer:
  /compete/organizer               - Dashboard
  /compete/organizer/new           - Create competition
  /compete/organizer/[id]/*        - Management tabs
  /compete/organizer/series        - Series management
```

---

## Demo Checklist

### Pre-Demo Setup
- [ ] Create sample competition with realistic data
- [ ] Add sample registrations across multiple divisions
- [ ] Configure sample workouts/events
- [ ] Set up heat schedule
- [ ] Add sponsor logos
- [ ] Prepare test athlete account

### Demo Environment
- [ ] Clean browser (no leftover state)
- [ ] Good test data that tells a story
- [ ] Both organizer and athlete accounts ready
- [ ] Payment test mode enabled

### Key Talking Points
- [ ] Highlight the dual-team architecture
- [ ] Show the division flexibility (RX/Intermediate/Rookie)
- [ ] Demonstrate real-time leaderboard updates
- [ ] Explain Stripe payment integration
- [ ] Show mobile-responsive design

---

## Appendix: Feature Summary

### Organizer Features
- Create and manage competitions
- Configure divisions with custom pricing
- Design workouts with division-specific variations
- Create venues and schedule heats
- Manage athlete registrations
- Enter scores and manage leaderboards
- Track revenue and payments
- Organize competitions into series
- Manage sponsors and branding

### Athlete Features
- Discover and browse competitions
- Register individually or as a team
- Pay registration fees via Stripe
- Manage athlete profile and sponsors
- View competition schedule and heats
- Track leaderboard standings
- View invoices and payment history
- Accept team invitations

### Platform Capabilities
- Multi-division support (15+ divisions possible)
- Team and individual competition formats
- Flexible scoring schemes (AMRAP, For Time, etc.)
- Real-time leaderboard calculations
- Heat scheduling with lane assignments
- Stripe payment processing
- Public/private competition visibility
- Mobile-responsive design
- PDF invoice generation
