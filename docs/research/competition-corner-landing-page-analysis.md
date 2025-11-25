# Competition Corner Landing Page Analysis

**Source:** [Mountain West Fitness Championship (MWFC 2025)](https://competitioncorner.net/events/15905/details)
**Date Analyzed:** November 25, 2025

## Overview

Competition Corner is the industry-standard platform for CrossFit competition management. This analysis examines their event landing page structure, UI patterns, and information architecture to inform our competition landing page design.

---

## Page Structure

### Global Navigation
- **Header:** Logo, search bar ("Search by event or location"), language selector, user account
- **Dark theme** by default with light mode toggle
- **Sticky header** persists across all pages

### Event Hero Section
- **Event logo** (circular badge style)
- **Event title** in large display font (ALL CAPS, stylized)
- **Event type badge:** "Onsite Competition for teams"
- **Share button** in top-right
- **Background:** Blurred/darkened event imagery

### Tab Navigation
Horizontal tabs for main sections:
1. **Event details** (default landing)
2. **Divisions**
3. **Schedule**
4. **Workouts**
5. **Leaderboard** (opens in new tab)

---

## Section Analysis

### 1. Event Details Page

**Layout:** Two-column (content left, sidebar right)

**Left Column - Content:**
- Event description (rich text)
- Schedule overview (text-based)
- Logistics info (what to bring, venue details)
- Spectator information & pricing
- Refund policy overview
- Expense breakdown (transparency about where money goes)
- Contact information

**Right Column - Sidebar:**
- **Status badge:** "EVENT ENDED" (or registration CTA when active)
- **Vendor/Sponsor CTA button**
- **Date/Time block:** Oct 10-11, 2025 with icons
- **Venue block:** Address with Google Maps link
- **Refund Policy** expandable section
- **Contact organizer** button
- **Weather widget:** Current conditions at venue location

**Below Fold:**
- **Sponsors section:** Logo carousel with links
- **Event website link**
- **Organizer attribution:** "Organized by: CrossFit Canvas"

### 2. Divisions Page

**Layout:** Card list (full width)

**Division Cards:**
- Division name as heading (e.g., "Co-Ed - RX")
- Team size indicator: "A team of 2 division"
- **Expandable accordion** with "Show details" toggle

**Expanded Division Content:**
- Division description & athlete expectations
- Movement expectations disclaimer
- Workout structure info
- **Weightlifting movements & loads** (detailed list with M/F weights)
- **Gymnastics movements** (capability expectations)
- Prize information
- Expense/prize breakdown

**Division Categories:**
- Co-Ed (RX, Intermediate, Rookie)
- Men's (RX, Intermediate, Rookie)
- Women's (RX, Intermediate, Rookie)
- Masters Co-Ed (RX, Intermediate)
- Masters Men's (RX, Intermediate, Rookie)
- Masters Women's (Intermediate)

### 3. Schedule Page

**Layout:** Full-width with filters

**Controls:**
- **View toggle:** Grid View / List View
- **Date selector:** Dropdown (Friday — October 10)
- **Division filter:** Dropdown (All divisions)
- **Search:** "Find by Competitor or Gym"

**Schedule Display:**
- **Stage tabs:** "MAIN STAGE" (supports multiple stages)
- **Workout blocks:** Time range + Workout name + Sponsor
- **Expandable heats:** Click to show all heats

**Heat Detail (Expanded):**
| Lane # | Competitor | Affiliate | Division |
|--------|------------|-----------|----------|
| 1 | Team Name | GYM NAME | Co-Ed - Rookie |

- Shows team logos where available
- Mixed divisions in same heat (color-coded badges)
- 15-minute heat intervals typical

### 4. Workouts Page

**Layout:** Two-column (filters + content)

**Filters:**
- Division selector dropdown
- Workout selector dropdown

**Workout Display:**
- **Metadata bar:** Where, When, Scoring method
- **Workout title** (includes sponsor name)
- **Link to athlete folder** (Google Drive)
- **Workout poster graphics** (branded, visual)
- **Workout details by division:**
  - RX version
  - Intermediate version
  - Rookie version
- **Floor layout diagram** (visual representation of lanes/equipment)

**Workout Poster Design:**
- Event branding/logo
- Workout number & name
- Sponsor logo prominently displayed
- "Presented by [Sponsor]" tagline

### 5. Leaderboard Page

**Layout:** Full-width data table

**Header:**
- Event logo + "Live" badge
- Event name
- Sponsor logos (scrolling banner)
- Schedule/Workouts quick links

**Division Tabs:**
- Horizontal scrollable tabs for each division
- Format: "Division Name (T)" where T = Team

**Leaderboard Table:**
| # | Name/Affiliate | Total Points | WOD 1 (Pts/Rank/Score) | WOD 2 | WOD 3 |
|---|----------------|--------------|------------------------|-------|-------|

**Features:**
- Search by athlete or affiliate
- Point differential from leader shown: "433 (-16)"
- Per-workout breakdown (Points, Rank, Score/Time)
- CAP notation for time-capped workouts
- Previous/Next workout navigation
- Clickable rows for athlete detail

---

## UI Patterns & Components

### Visual Design
- **Color scheme:** Dark theme (black/dark gray background, white text)
- **Accent color:** Teal/cyan for active states and links
- **Typography:**
  - Display: ALL CAPS stylized headings
  - Body: Clean sans-serif
- **Cards:** Rounded corners, subtle borders
- **Buttons:** Outlined style (white border on dark)

### Interaction Patterns
- **Accordions:** Used for expandable content (divisions, heats)
- **Dropdowns:** Styled comboboxes for filters
- **Tabs:** Horizontal for main nav, horizontal scrollable for divisions
- **Tables:** Dense data display with hover states
- **Modals:** Not observed in main flow

### Sponsor Integration
- **Rotating banner:** Sponsor logos in horizontal carousel
- **Workout naming:** "[Workout Name] (Sponsor)" convention
- **"Presented By"** attribution on schedule items
- **Dedicated vendor/sponsor page** linked from sidebar

### Mobile Considerations
- Responsive design observed
- Tab navigation likely collapses to dropdown on mobile
- Tables may require horizontal scroll

---

## Strengths

### Information Architecture
1. **Clear hierarchy:** Tab structure makes navigation intuitive
2. **Progressive disclosure:** Accordions hide complexity until needed
3. **Consistent sidebar:** Key info (dates, venue, contact) always visible
4. **Division clarity:** Clear separation of skill levels

### User Experience
1. **Quick access:** Schedule and leaderboard accessible from multiple points
2. **Search functionality:** Find competitors by name or gym
3. **Filter options:** Division and date filtering on schedule
4. **Real-time updates:** "Live" indicator and current time display

### Transparency
1. **Expense breakdown:** Shows where registration fees go
2. **Movement standards:** Clear expectations per division
3. **Refund policy:** Upfront about non-refundable nature

### Sponsor Value
1. **Multiple touchpoints:** Logos appear throughout
2. **Workout naming rights:** High visibility for sponsors
3. **Dedicated sponsor page:** Vendor application portal

---

## Weaknesses

### Content Issues
1. **Text-heavy event details:** Wall of text, poor formatting
2. **Inconsistent content:** Some workouts have no description
3. **External links:** Workout details in Google Drive (fragmented UX)
4. **No imagery:** Event details lack photos/videos

### UX Issues
1. **Leaderboard in new tab:** Breaks navigation flow
2. **No workout preview in schedule:** Must navigate away to see details
3. **Limited mobile optimization:** Tables may be hard to read
4. **No athlete profiles:** Can't click through to see individual stats

### Design Issues
1. **Cookie banner:** Persistent and intrusive
2. **Sponsor carousel:** Auto-scrolling can be distracting
3. **Heat tables:** Dense, no visual distinction between divisions in same heat
4. **No dark/light preference persistence:** Resets on navigation

### Missing Features
1. **No countdown timer:** No urgency for registration deadlines
2. **No social proof:** No participant count or testimonials
3. **No FAQ section:** Common questions buried in description
4. **No notification system:** Can't subscribe for updates
5. **No calendar integration:** No "Add to Calendar" button
6. **No athlete check-in info:** Heat times but no warm-up scheduling

---

## Recommendations for WodSmith

### Must-Have Features
1. **Tab-based navigation:** Event Details, Divisions, Schedule, Workouts, Leaderboard
2. **Sticky sidebar:** Date, venue, registration CTA
3. **Division accordion:** Expandable details with movement standards
4. **Heat schedule:** Filterable by division with team assignments
5. **Live leaderboard:** Real-time scoring with workout breakdowns

### Improvements to Make
1. **Inline workout previews:** Show workout details in schedule without navigation
2. **Rich content editor:** Better formatting for event descriptions
3. **Media gallery:** Photos/videos from past events
4. **Athlete profiles:** Click-through to individual performance history
5. **Integrated workouts:** No external links needed
6. **Calendar integration:** One-click "Add to Calendar"
7. **Notification preferences:** Email/SMS updates for athletes
8. **FAQ section:** Dedicated accordion for common questions

### Design Enhancements
1. **Better heat visualization:** Color-code by division, show lane assignments visually
2. **Countdown timers:** Registration deadline, event start
3. **Progress indicators:** "X spots remaining" for divisions
4. **Social sharing:** Pre-formatted share cards with event details
5. **Responsive tables:** Card-based layout on mobile for leaderboard

### Sponsor Features
1. **Tiered sponsor levels:** Different visibility based on sponsorship level
2. **Sponsor dashboard:** Self-service logo upload and link management
3. **Analytics:** Show sponsors their logo impressions

---

## Data Model Implications

Based on this analysis, competition landing pages need:

```
Competition
├── Basic Info (name, dates, venue, description)
├── Settings (registration, refund policy, spectator pricing)
├── Divisions[]
│   ├── Name, type, team size
│   ├── Movement standards
│   └── Prize info
├── Schedule
│   ├── Days[]
│   ├── Stages[]
│   └── Heats[]
│       ├── Workout reference
│       ├── Time
│       └── Assignments[] (team, lane)
├── Workouts[]
│   ├── Name, description
│   ├── Scoring type
│   ├── Division variations[]
│   ├── Floor layout
│   └── Sponsor
├── Sponsors[]
│   ├── Tier level
│   ├── Logo, link
│   └── Workout associations
└── Leaderboard
    ├── Division standings[]
    └── Workout results[]
```

---

## Screenshots Reference

Screenshots captured and saved to `.playwright-mcp/`:
- `cc-event-details.png` - Main event details page
- `cc-divisions.png` - Division listing
- `cc-division-detail.png` - Expanded division details
- `cc-schedule.png` - Schedule overview
- `cc-schedule-expanded.png` - Schedule with heats
- `cc-schedule-heat-detail.png` - Heat assignments table
- `cc-workouts.png` - Workout display with posters
- `cc-leaderboard.png` - Live leaderboard table
