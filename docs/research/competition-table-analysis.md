# Competition Table Design Analysis

**Source:** Competition Corner (https://competitioncorner.net/events/15905/details)
**Competition Analyzed:** Mountain West Fitness Championship (MWFC 2025)
**Date of Analysis:** 2025-10-01

## Executive Summary

This document provides a comprehensive analysis of the Competition Corner platform's data structure for managing CrossFit competitions. Based on detailed scraping and API analysis, this report recommends a database schema for implementing a competition management system in our application.

---

## Page Structure Analysis

### 1. Event Details Tab

**Key Data Captured:**

#### Core Event Information
- **Event Name:** Mountain West Fitness Championship (MWFC 2025)
- **Event Type:** Onsite Competition for teams
- **Event ID:** 15905
- **Status:** Live/Registration Closed
- **Dates:**
  - Start: Oct 10, 2025 • 8:00 AM
  - End: Oct 11, 2025 • 8:00 PM
  - Early Check-In: Thursday 4:00pm-8:00pm
  - Friday Check-In: 7:00am-9:00am

#### Location
- **Venue:** Canyon County Fair Event Center
- **Address:** 110 County Fair Ave, Caldwell, ID, 83605, United States
- **Map Integration:** Google Maps integration for venue location

#### Description & Details
- Rich text description with markdown support
- Event schedule breakdown by day
- Participant instructions (what to bring, preparation)
- Prize money & expense breakdown (percentages)
- Refund policy with external links to insurance

#### Registration
- Registration status (Open/Closed)
- Fan Shield insurance integration
- Spectator ticketing:
  - 1-Day Pass: $15
  - 2-Day Pass: $25
  - Includes raffle tickets

#### Organization
- **Organized by:** CrossFit Canvas
- **Contact:** mountainwestchampionship@gmail.com
- **Social Media:** @mountainwestchampionship (Instagram)
- **Event Website:** Direct link to event page

#### Sponsors
- Multiple sponsor logos with URLs
  - Scheels
  - Strong Coffee Company
  - GymReapers
- Rotating carousel display

#### Financial Breakdown
```
Prize Money: 20%
Venue Cost: 15%
Media Team: 8%
Emcee & DJ: 7%
Equipment Rentals: 20%
Signage (SignsRX): 15%
Organizers: 10%
Miscellaneous: 5%
```

---

### 2. Divisions Tab

**Structure:** Expandable cards for each division

#### Division Categories
- **Co-Ed** (RX, Intermediate, Rookie)
- **Men's** (RX, Intermediate, Rookie)
- **Women's** (RX, Intermediate, Rookie)
- **Masters Co-Ed** (RX, Intermediate)
- **Masters Men's** (RX, Intermediate, Rookie)
- **Masters Women's** (Intermediate)

**Total:** 15 divisions

#### Division Details (Expandable Content)
Each division contains:

1. **Team Size:** "A team of 2 division"
2. **Description:** Division-specific expectations and skill level
3. **Movement Expectations:**
   - List of gymnastics movements
   - Weightlifting movements with working loads (by gender)
   - Movement standards disclaimer

4. **Example Movement Data (RX Division):**
   ```
   Thruster: 95/65 lbs
   Snatch: 185/125 lbs
   Clean & Jerk: 225/155 lbs
   Deadlift: 315/245 lbs
   Double Dumbbell: 50s/35s lbs
   Single Dumbbell: 70/50 lbs
   Sandbag: 125/100 lbs
   ```

5. **Gymnastics Movements:**
   - Toes-to-Bar
   - Kipping Pull-Ups
   - Chest-to-Bar Pull-Ups
   - Bar/Ring Muscle-Ups
   - Wall Walks
   - Handstand Walks
   - Handstand Push-Ups
   - Double Unders

6. **Workout Structure:** 5-6 workouts over competition weekend

7. **Prizes:** Prize details based on registration revenue

8. **Financial Breakdown:** Division-specific budget allocation

---

### 3. Schedule Tab

**Features:**
- Real-time clock display (Current Time in timezone)
- Multiple view modes:
  - Grid View (default)
  - List View

#### Filters
- **Date Selector:** Dropdown for multi-day events (Friday/Saturday)
- **Division Filter:** Filter by specific divisions or "All divisions"
- **Search:** Text search for competitor or gym name

#### Schedule Structure
- **Multiple Stages:** Main Stage (others possible)
- **Workout Sessions:**
  - Time window (start - end)
  - Workout number and name
  - Sponsor presentation ("Presented By:")
  - Visual sponsor logos throughout

#### Example Sessions (Friday, Oct 10):
```
09:00 AM - 12:33 PM | Workout #1: Sawtooth (Propath Financial)
01:06 PM - 04:03 PM | Workout #2: Steelhead (Scheels)
04:36 PM - 07:09 PM | Workout #3: "Spud Nation" (RXSG)
```

**Note:** "* times subject to change" disclaimer

---

### 4. Workouts Tab

**Navigation:**
- Division dropdown selector (defaults to first division)
- Workout dropdown selector (defaults to first workout)
- Sponsor carousel display

#### Workout Details

**Metadata:**
- **Where:** Location/Stage (e.g., Main Stage)
- **When:** Date (e.g., Friday, October 10)
- **Scoring:**
  - "For Repetitions: More is Better"
  - "For Time: Less is Better"
  - "For Load: More is Better"

**Content:**
- **Workout Title:** Workout number + name + sponsor
- **Description:** Rich text/markdown description
- **External Resources:** Links to Google Drive with:
  - Movement Standards
  - Floor Layouts
  - Flows
  - Additional workout details

**Note:** Some workouts reference external folders rather than inline descriptions

---

### 5. Leaderboard Tab

**Features:**
- **Live Status Indicator:** Real-time updates badge
- **Division Tabs:** Horizontal scrollable tabs for all divisions
  - Format: "Division Name (T)" where T = Team
- **Quick Actions:**
  - Share button
  - Schedule button (modal/overlay)
  - Workouts button (modal/overlay)

#### Leaderboard Table Structure

**Table Headers:**
- **Participant # / Name**
  - Search textbox for "athlete or affiliate"
  - Team number (#)
  - Team name
  - Affiliate/gym name (uppercase)

- **Total Points**
  - Aggregate score across all workouts

- **Per Workout Columns** (dynamic based on number of workouts):
  - Workout name with sponsor
  - Points earned
  - Rank (placement)
  - Result (Reps/Time/Load)

#### Table Data
**Each Row Contains:**
- Team name (clickable for details)
- Affiliate/gym in all caps
- Total points (sortable)
- Per-workout breakdown:
  - Points (numeric)
  - Rank (numeric ordinal)
  - Result (format varies: reps, time, weight)
  - Shows "-" for incomplete workouts

**Example Row:**
```
Team Name: "Verdantside"
Affiliate: "INDEPENDENT"
Total Points: 0
Workout #1: - points, - rank, - reps
Workout #2: - points, - rank, - time
Workout #3: - points, - rank, - time
```

#### Navigation
- Previous/Next Workout buttons
- Division switching preserves context
- Responsive design for mobile/desktop

---

## API & Network Analysis

### Key API Endpoints

#### 1. Leaderboard Data
```
GET /api2/v1/leaderboard/ff/15905/results/json?per_page=99
```
- Returns aggregated leaderboard data
- Pagination support (`per_page` parameter)
- JSON format

#### 2. Division-Specific Leaderboard
```
GET /api2/v1/leaderboard/15905/tab/team_101884?start=0&end=50&athletesOnly=false
```
- Returns specific division data
- Pagination with `start` and `end`
- `athletesOnly` flag for filtering
- Division ID in URL path (`team_101884`)

#### 3. Event Tracking
```
GET /api2/v1/events/15905/tracking-codes
```
- Returns analytics/tracking configuration

#### 4. File Downloads
```
GET /api2/v1/files/download?filename=...
```
- Dynamic file serving
- Used for sponsor logos, event images
- Query parameter for file path

### Data Flow Pattern
1. Initial page load fetches event metadata
2. JavaScript fetches division/leaderboard data via API
3. Lazy loading of images and assets
4. Real-time updates via polling or WebSocket (indicated by "Live" badge)

---

## Recommended Database Schema

Based on the analysis, here's the recommended table structure for our system:

### 1. `competitions` Table

**Purpose:** Core competition information

```typescript
interface Competition {
  id: string                    // CUID
  teamId: string                // Multi-tenant isolation

  // Basic Info
  name: string                  // "Mountain West Fitness Championship"
  slug: string                  // URL-friendly identifier
  description: string           // Rich text/markdown
  shortDescription: string      // For cards/previews

  // Dates
  startDate: Date
  endDate: Date
  registrationOpenDate: Date | null
  registrationCloseDate: Date | null
  earlyCheckinStart: Date | null
  earlyCheckinEnd: Date | null

  // Location
  venueName: string
  venueAddress: string
  venueCity: string
  venueState: string
  venueZip: string
  venueCountry: string
  venueLatitude: number | null
  venueLongitude: number | null

  // Status
  status: 'draft' | 'published' | 'registration_open' | 'registration_closed' | 'live' | 'completed' | 'cancelled'
  isLive: boolean               // Real-time updates active

  // Organization
  organizerName: string
  organizerEmail: string
  organizerPhone: string | null
  eventWebsite: string | null
  socialMediaHandles: JSON      // {instagram: "@handle", facebook: "...", etc}

  // Registration
  registrationInfo: string | null     // Rich text
  refundPolicy: string | null         // Rich text
  fanShieldEnabled: boolean           // Insurance option

  // Financial
  prizeMoneyPercentage: number | null
  expenseBreakdown: JSON | null       // {venue: 15, media: 8, ...}

  // Spectators
  spectatorTicketsEnabled: boolean
  spectatorTicketPrices: JSON | null  // {oneDay: 15, twoDay: 25}

  // Media
  logoUrl: string | null
  coverImageUrl: string | null

  // Metadata
  createdAt: Date
  updatedAt: Date
  createdById: string

  // Relations (handled in separate tables)
  // - divisions
  // - workouts
  // - sponsors
  // - schedule
}
```

### 2. `competition_divisions` Table

**Purpose:** Define competition divisions/categories

```typescript
interface CompetitionDivision {
  id: string                    // CUID
  competitionId: string         // FK to competitions
  teamId: string                // Multi-tenant isolation

  // Basic Info
  name: string                  // "Co-Ed - RX"
  slug: string                  // "co-ed-rx"
  description: string | null    // Rich text
  type: 'individual' | 'team' | 'pairs'

  // Team/Size
  teamSize: number              // 1 for individual, 2 for pairs, etc.
  minTeamSize: number | null    // For flexible team sizes
  maxTeamSize: number | null

  // Category
  gender: 'male' | 'female' | 'mixed' | 'open'
  ageGroup: 'scaled' | 'rx' | 'elite' | 'teen' | 'masters' | 'custom'
  skillLevel: 'rookie' | 'intermediate' | 'rx' | 'elite' | 'custom'

  // Requirements
  movementExpectations: JSON | null   // List of movements
  workingLoads: JSON | null           // {thruster: {male: 95, female: 65}, ...}
  gymnasticsMovements: string[] | null

  // Workouts
  numberOfWorkouts: number | null     // 5-6 workouts

  // Display
  displayOrder: number
  isActive: boolean

  // Metadata
  createdAt: Date
  updatedAt: Date
}
```

### 3. `competition_sponsors` Table

**Purpose:** Manage event sponsors

```typescript
interface CompetitionSponsor {
  id: string
  competitionId: string
  teamId: string

  // Sponsor Info
  name: string
  logoUrl: string
  websiteUrl: string | null

  // Tier/Level
  tier: 'title' | 'presenting' | 'gold' | 'silver' | 'bronze' | 'partner'

  // Display
  displayOrder: number
  isActive: boolean

  createdAt: Date
  updatedAt: Date
}
```

### 4. `competition_workouts` Table

**Purpose:** Define individual workouts/events

```typescript
interface CompetitionWorkout {
  id: string
  competitionId: string
  teamId: string

  // Basic Info
  workoutNumber: number         // 1, 2, 3, etc.
  name: string                  // "Sawtooth"
  fullName: string | null       // "Workout #1: Sawtooth (Propath Financial)"
  description: string | null    // Rich text/markdown

  // Sponsor
  sponsorId: string | null      // FK to competition_sponsors

  // Timing
  workoutDate: Date
  startTime: Date
  endTime: Date | null

  // Location
  location: string              // "Main Stage", "Field A", etc.
  stage: string | null

  // Scoring
  scoringType: 'time' | 'reps' | 'load' | 'points' | 'amrap' | 'custom'
  scoringDescription: string    // "For Time: Less is Better"
  timeCapMinutes: number | null

  // Standards
  movementStandards: string | null      // Rich text
  floorLayout: string | null            // Description or URL
  externalResourcesUrl: string | null   // Google Drive, etc.

  // Divisions (many-to-many handled separately)
  isSharedAcrossDivisions: boolean

  // Display
  displayOrder: number
  isActive: boolean

  createdAt: Date
  updatedAt: Date
}
```

### 5. `competition_workout_divisions` Table

**Purpose:** Link workouts to specific divisions (many-to-many)

```typescript
interface CompetitionWorkoutDivision {
  id: string
  workoutId: string
  divisionId: string

  // Division-Specific Overrides (optional)
  scaledVersion: string | null     // Modified workout for this division
  timeCapMinutes: number | null    // Division-specific time cap

  createdAt: Date
}
```

### 6. `competition_schedule` Table

**Purpose:** Detailed scheduling information

```typescript
interface CompetitionSchedule {
  id: string
  competitionId: string
  teamId: string

  // Session Info
  workoutId: string | null      // FK to competition_workouts (null for general sessions)
  divisionId: string | null     // Specific division scheduled

  // Timing
  date: Date
  startTime: Date
  endTime: Date

  // Location
  stage: string                 // "Main Stage", "Warm-up Area", etc.
  location: string | null

  // Type
  sessionType: 'workout' | 'checkin' | 'warmup' | 'awards' | 'break' | 'custom'

  // Display
  title: string | null
  notes: string | null
  isPublished: boolean

  createdAt: Date
  updatedAt: Date
}
```

### 7. `competition_registrations` Table

**Purpose:** Track team/athlete registrations

```typescript
interface CompetitionRegistration {
  id: string
  competitionId: string
  divisionId: string
  teamId: string

  // Team Info
  teamName: string
  affiliateGym: string | null
  affiliateGymId: string | null    // FK to gyms if we track them

  // Registration
  registrationNumber: number        // Auto-increment per competition
  registrationDate: Date
  status: 'pending' | 'confirmed' | 'paid' | 'checked_in' | 'withdrawn' | 'disqualified'

  // Payment
  registrationFee: number | null
  isPaid: boolean
  paidAt: Date | null
  fanShieldPurchased: boolean       // Insurance

  // Contact
  primaryContactUserId: string      // FK to users

  // Team Members (handled in separate table)

  // Metadata
  createdAt: Date
  updatedAt: Date
  withdrawnAt: Date | null
  withdrawnReason: string | null
}
```

### 8. `competition_registration_members` Table

**Purpose:** Individual athletes in a team

```typescript
interface CompetitionRegistrationMember {
  id: string
  registrationId: string

  // Athlete Info
  userId: string | null         // FK to users if they have account
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  gender: 'male' | 'female' | 'other'
  dateOfBirth: Date | null

  // Position
  isPrimaryContact: boolean
  position: number              // 1, 2, etc. for team order

  // Waiver
  waiverSigned: boolean
  waiverSignedAt: Date | null

  createdAt: Date
  updatedAt: Date
}
```

### 9. `competition_results` Table

**Purpose:** Store workout results/scores

```typescript
interface CompetitionResult {
  id: string
  competitionId: string
  workoutId: string
  divisionId: string
  registrationId: string        // FK to team/athlete
  teamId: string

  // Result
  result: string                // Raw result: "100" reps, "12:34" time, "225" lbs
  resultType: 'time' | 'reps' | 'load' | 'points'
  resultNumeric: number         // Normalized for sorting (seconds, reps, lbs, etc.)

  // Scoring
  points: number                // Competition points earned
  rank: number                  // Placement in division for this workout

  // Status
  isComplete: boolean
  isValidated: boolean          // Judge validated
  notes: string | null          // Judge notes or violations

  // Penalties
  hasPenalty: boolean
  penaltyDescription: string | null
  penaltyTimeSeconds: number | null
  penaltyReps: number | null

  // Video
  videoUrl: string | null       // Submission video

  // Judge Info
  judgeUserId: string | null
  validatedAt: Date | null

  createdAt: Date
  updatedAt: Date
}
```

### 10. `competition_leaderboard_cache` Table

**Purpose:** Pre-computed leaderboard for performance

```typescript
interface CompetitionLeaderboardCache {
  id: string
  competitionId: string
  divisionId: string
  registrationId: string

  // Aggregate Scores
  totalPoints: number
  overallRank: number

  // Per-Workout Breakdown (JSON)
  workoutScores: JSON           // [{workoutId, points, rank, result}, ...]

  // Last Updated
  lastCalculatedAt: Date

  createdAt: Date
  updatedAt: Date
}
```

---

## Key Design Decisions

### 1. Multi-Tenancy
- All tables include `teamId` for data isolation
- Filters must always include team context

### 2. Flexibility
- JSON columns for complex/variable data (expense breakdown, social media)
- Rich text fields use markdown format
- Division requirements stored as structured JSON

### 3. Performance
- Separate leaderboard cache table for quick queries
- Indexes on common filters (competitionId, divisionId, status)
- Pre-computed ranks and points

### 4. Relationships
- Many-to-many: workouts ↔ divisions
- One-to-many: competition → divisions, workouts, sponsors
- Hierarchical: competition → registrations → members → results

### 5. Real-Time Features
- `isLive` flag on competitions
- Timestamp tracking for cache invalidation
- Status enums for registration and result workflows

### 6. External Integrations
- URLs for external resources (Google Drive)
- Payment tracking (prepare for Stripe)
- Fan Shield insurance flag
- Social media handles as JSON

---

## Feature Recommendations

### Must-Have Features (MVP)
1. ✅ Competition creation with basic info
2. ✅ Division management (15+ divisions)
3. ✅ Workout definition with scoring types
4. ✅ Team registration system
5. ✅ Result entry and validation
6. ✅ Real-time leaderboard display
7. ✅ Multi-day schedule management

### Nice-to-Have Features (V2)
1. Sponsor management with tiers
2. Spectator ticketing integration
3. Fan Shield insurance option
4. Video submission for results
5. Judge validation workflow
6. Financial reporting (expense breakdown)
7. Email notifications for registrants
8. Public/private leaderboards
9. Mobile app integration
10. Live scoring updates (WebSocket)

### Advanced Features (Future)
1. Heat management (breaking divisions into heats)
2. Lane assignments
3. Equipment tracking
4. Volunteer scheduling
5. Live streaming integration
6. Athlete profiles and history
7. Series/season tracking (multiple competitions)
8. Merchandise store integration
9. Custom branding per competition
10. White-label solutions for affiliates

---

## Implementation Notes

### Database Migrations
1. Create all tables with proper foreign keys
2. Add indexes on frequently queried columns:
   - `competitions.teamId`, `competitions.status`
   - `competition_divisions.competitionId`
   - `competition_results.workoutId`, `competition_results.divisionId`
   - `competition_leaderboard_cache.competitionId`, `competition_leaderboard_cache.divisionId`

### Validation Rules
1. Competition dates: `startDate` < `endDate`
2. Registration: `registrationOpenDate` < `registrationCloseDate` < `startDate`
3. Team size: Must match division requirements
4. Workout numbers: Sequential and unique per competition
5. Results: Match expected `scoringType` format

### Caching Strategy
1. Leaderboard: Recalculate on result updates
2. Schedule: Cache per day/division
3. Competition list: Cache with short TTL
4. Use Redis or in-memory cache for hot data

### Access Control
1. Public: View competitions, leaderboards, schedules
2. Athlete: Register, submit results (if allowed), view own data
3. Judge: Validate results, enter scores
4. Admin: Full CRUD on competitions, divisions, workouts
5. Super Admin: Cross-team management

---

## API Design Recommendations

### RESTful Endpoints

```typescript
// Competitions
GET    /api/competitions
GET    /api/competitions/:id
POST   /api/competitions
PATCH  /api/competitions/:id
DELETE /api/competitions/:id

// Divisions
GET    /api/competitions/:competitionId/divisions
POST   /api/competitions/:competitionId/divisions
PATCH  /api/divisions/:id
DELETE /api/divisions/:id

// Workouts
GET    /api/competitions/:competitionId/workouts
POST   /api/competitions/:competitionId/workouts
PATCH  /api/workouts/:id
DELETE /api/workouts/:id

// Registrations
GET    /api/competitions/:competitionId/registrations
POST   /api/competitions/:competitionId/registrations
PATCH  /api/registrations/:id
DELETE /api/registrations/:id

// Results
GET    /api/competitions/:competitionId/results
GET    /api/workouts/:workoutId/results
POST   /api/workouts/:workoutId/results
PATCH  /api/results/:id

// Leaderboard
GET    /api/competitions/:competitionId/leaderboard
GET    /api/competitions/:competitionId/leaderboard/:divisionId

// Schedule
GET    /api/competitions/:competitionId/schedule
POST   /api/competitions/:competitionId/schedule
PATCH  /api/schedule/:id
DELETE /api/schedule/:id

// Sponsors
GET    /api/competitions/:competitionId/sponsors
POST   /api/competitions/:competitionId/sponsors
PATCH  /api/sponsors/:id
DELETE /api/sponsors/:id
```

---

## UI/UX Considerations

### Competition Details Page
- Tabbed navigation (Details, Divisions, Schedule, Workouts, Leaderboard)
- Sticky header with competition name and status
- Sponsor carousel
- Share functionality
- Mobile-responsive design

### Leaderboard
- Real-time updates indicator
- Division tabs (horizontal scroll on mobile)
- Search/filter by team name or affiliate
- Sortable columns
- Per-workout breakdown
- Export functionality (CSV, PDF)

### Schedule
- Calendar view + list view toggle
- Filter by division, day, stage
- Time zone display
- Print-friendly format

### Registration Flow
- Multi-step form:
  1. Select division
  2. Enter team info
  3. Add team members
  4. Review & payment
  5. Confirmation
- Save progress (draft registrations)
- Email confirmation
- Waiver signing

---

## Conclusion

The Competition Corner platform provides a robust model for managing CrossFit competitions. Key takeaways:

1. **Flexible Division System:** Support for 15+ divisions with varying skill levels and team sizes
2. **Rich Metadata:** Extensive event information including financial breakdowns and sponsor management
3. **Comprehensive Scheduling:** Multi-day, multi-stage scheduling with real-time updates
4. **Performance-Optimized Leaderboards:** Cached aggregate scores for fast loading
5. **External Integration:** Support for external resources, insurance, and payment processing

Our recommended schema balances flexibility with performance, supports multi-tenancy, and provides a foundation for future enhancements.

### Next Steps
1. Review and approve database schema
2. Create Drizzle migrations
3. Implement core API endpoints
4. Build admin UI for competition management
5. Develop public-facing leaderboard views
6. Add registration flow
7. Implement result entry and validation
8. Deploy staging environment for testing

---

**Report Generated:** 2025-10-01
**Analyzed By:** Claude Code
**Source Platform:** Competition Corner (competitioncorner.net)
