# WODsmith Product Display Strategy

## Overview

This document outlines the strategy for presenting WODsmith's two products on the website, with the goal of clearly communicating our mission while driving athlete acquisition through competition participation.

---

## Brand Architecture

### Company Mission

**WODsmith** exists to:
- Make it easy to glean insights from the data athletes work hard to track
- Support the functional fitness community with purpose-built tools

### Product Portfolio

| Product | Target Audience | Value Proposition |
|---------|-----------------|-------------------|
| **Workout Tracking** | Athletes & Coaches | Track workouts, analyze progress, gain insights from your training data |
| **WODsmith Compete** | Competition Organizers | Efficiency in planning, accuracy in game day operations, ease of use for athletes |

### Key Distinction

- **Workout Tracking** is B2C — athletes are the direct customer
- **WODsmith Compete** is B2B — organizers are the customer, athletes benefit as users

---

## Homepage Strategy

### Current State

The homepage currently focuses on workout tracking with a "beast mode" messaging style. There's no mention of WODsmith Compete or the broader company mission.

### Proposed Structure

```
┌─────────────────────────────────────────────────────────────┐
│ 1. HERO - Mission Statement                                  │
│    "Tools for the functional fitness community"              │
│    Focus on data insights + community support                │
├─────────────────────────────────────────────────────────────┤
│ 2. PRODUCTS - Two clear offerings                           │
│    ┌─────────────────────┐  ┌─────────────────────────────┐ │
│    │ For Athletes        │  │ For Competition Organizers  │ │
│    │ Workout Tracking    │  │ WODsmith Compete            │ │
│    │ [Start Tracking]    │  │ [Host a Competition]        │ │
│    └─────────────────────┘  └─────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ 3. FEATURES - Data insights focus                           │
│    Progress tracking, movement analytics, programming       │
├─────────────────────────────────────────────────────────────┤
│ 4. SOCIAL PROOF                                             │
│    Testimonials from athletes AND organizers                │
├─────────────────────────────────────────────────────────────┤
│ 5. FOOTER                                                   │
│    Links to both product areas                              │
└─────────────────────────────────────────────────────────────┘
```

### Hero Section Copy Direction

**Current:**
> "TRACK YOUR WORKOUTS LIKE A BEAST"
> "Stop overthinking your fitness journey..."

**Proposed Direction:**
> "Tools Built for Functional Fitness"
> "Track your training. Run your competitions. Get insights that matter."

The hero should establish WODsmith as a platform/company, not just a single product.

---

## Product Cards

### Workout Tracking Card

**Headline:** For Athletes & Coaches

**Subhead:** Track your training, see your progress

**Key Points:**
- Log any workout type (AMRAP, For Time, strength, etc.)
- Follow programming from your gym or build your own
- Analyze your progress with meaningful insights
- Works for individuals and gym teams

**CTA:** Start Tracking Free

**Route:** `/workouts` (or consider `/train`)

### WODsmith Compete Card

**Headline:** For Competition Organizers

**Subhead:** Run competitions like a pro

**Key Points:**
- Efficient heat scheduling and lane assignments
- Accurate live scoring and leaderboards
- Easy athlete registration with payment processing
- Revenue tracking and sponsor management

**CTA:** Host Your Competition

**Route:** `/compete/organizer`

---

## WODsmith Compete Positioning

### Current State

The `/compete` page is athlete-focused:
> "Find and register for CrossFit competitions"

This makes sense for athletes browsing events, but doesn't communicate value to organizers.

### Proposed Changes

#### Option A: Separate Organizer Landing Page

Create `/compete/for-organizers` with:
- Hero focused on organizer pain points
- Feature breakdown (scheduling, scoring, registration)
- Pricing/plans for organizers
- CTA to create first competition

Keep `/compete` as the athlete-facing event directory.

#### Option B: Dual-Purpose Compete Landing

Update `/compete` with:
- Hero that speaks to both audiences
- "Browse Events" section for athletes
- "Host Your Own" section for organizers
- Clear navigation to organizer dashboard

### Recommended: Option A

Keeps the athlete experience clean while providing dedicated sales content for organizers.

---

## Athlete Acquisition Funnel

### The Goal

> Drive athletes who sign up for competitions into the platform for tracking workouts

### The Funnel

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ORGANIZER DISCOVERY                                       │
│    Gym owner finds WODsmith Compete                          │
│    Signs up to host competition                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ATHLETE EXPOSURE                                          │
│    Athletes register for competition                         │
│    Create WODsmith account (required for registration)       │
│    Experience the platform during competition                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. CONVERSION TOUCHPOINTS                                    │
│    Post-competition: "Track your training between events"   │
│    Results page: "See how you stack up. Keep improving."    │
│    Email follow-up: "Your next competition is X weeks away" │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. RETENTION                                                 │
│    Athlete uses workout tracking                             │
│    Registers for more competitions                           │
│    Becomes long-term platform user                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Conversion Touchpoints

| Location | Message | CTA |
|----------|---------|-----|
| Competition results page | "Keep the momentum going" | "Track Your Training" |
| Athlete profile (Compete) | "Prepare for your next event" | "Log a Workout" |
| Registration confirmation | "While you train for [Event]..." | "Start Tracking" |
| Post-competition email | "You placed #X. Here's how to improve" | "View Your Stats" |

### Technical Consideration

When an athlete registers for a competition:
1. They create a WODsmith account (if new)
2. They join the competition team
3. **Opportunity:** Auto-create a personal team for workout tracking
4. This removes friction from trying the core product

---

## Navigation Updates

### Main Nav (Workout Tracking)

Current links: Workouts, Log, Team, Compete, Settings

**Proposed:** Keep as-is, "Compete" link already exists

### Compete Nav

Current links: Events, Organize (conditional), Athlete Profile

**Proposed additions:**
- "Track Training" link → `/workouts` (for logged-in users)
- Footer: "Powered by WODsmith" → `/`

### Cross-Product Awareness

Both navs should subtly acknowledge the other product exists without being disruptive.

---

## Implementation Phases

### Phase 1: Homepage Refresh

**Files to modify:**
- `src/app/(marketing)/page.tsx`
- `src/components/landing/hero.tsx`
- `src/components/landing/features.tsx`

**New components:**
- `src/components/landing/product-cards.tsx`
- `src/components/landing/mission-hero.tsx`

**Outcome:** Homepage communicates mission + both products

### Phase 2: Compete Organizer Landing

**Files to create:**
- `src/app/(compete)/compete/for-organizers/page.tsx`

**Files to modify:**
- `src/components/nav/compete-nav.tsx` (add link)

**Outcome:** Dedicated sales page for competition organizers

### Phase 3: Cross-Product Navigation

**Files to modify:**
- `src/components/nav/compete-nav.tsx`
- `src/components/nav/main-nav.tsx`

**Outcome:** Easy movement between products

### Phase 4: Conversion Touchpoints

**Files to modify:**
- `src/app/(compete)/compete/[slug]/page.tsx` (competition page)
- `src/app/(compete)/compete/[slug]/register/success/page.tsx`
- `src/app/(compete)/compete/athlete/page.tsx`

**Outcome:** Strategic CTAs driving athletes to workout tracking

### Phase 5: Auto-Create Personal Team

**Files to modify:**
- Registration flow server actions
- Post-registration logic

**Outcome:** Zero friction for athletes to try workout tracking

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Athletes who register for competition AND log a workout | ? | Track this |
| Competition → Workout tracking conversion rate | ? | Establish baseline |
| Organizer signups from `/compete/for-organizers` | N/A | Track after launch |

---

## Open Questions

1. **Naming:** Should the workout tracking product have its own name? (e.g., "WODsmith Train" or just "WODsmith")

2. **Pricing Display:** Should homepage show pricing for both products or link to separate pricing pages?

3. **Organizer Acquisition:** What's the current strategy for finding organizers? Should we add more marketing content?

4. **Mobile App:** Is there a mobile app in the roadmap? This affects messaging.

---

## Appendix: Current File Structure

### Relevant Files

```
src/
├── app/
│   ├── (marketing)/
│   │   ├── layout.tsx
│   │   └── page.tsx              # Current homepage
│   ├── (main)/
│   │   └── ...                   # Workout tracking routes
│   └── (compete)/
│       └── compete/
│           ├── page.tsx          # Competition listing
│           ├── organizer/        # Organizer dashboard
│           └── athlete/          # Athlete profile
├── components/
│   ├── landing/
│   │   ├── hero.tsx
│   │   ├── features.tsx
│   │   └── pricing.tsx
│   └── nav/
│       ├── main-nav.tsx
│       └── compete-nav.tsx
└── constants.ts                   # Site name, descriptions
```

### Current Constants

```typescript
SITE_NAME = "WODsmith"
SITE_DESCRIPTION = "Track your workouts and progress."
```

**Proposed:**
```typescript
SITE_NAME = "WODsmith"
SITE_DESCRIPTION = "Tools for the functional fitness community. Track your training. Run your competitions."
PRODUCT_TRACKING_NAME = "WODsmith"  // or "WODsmith Train"
PRODUCT_COMPETE_NAME = "WODsmith Compete"
```
