# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public competition visitors and athletes browse competition details, workouts, schedules, leaderboards, and announcements. For the Training Guide Benchmark, the primary job is browsing a large workout library by training domain.

## Product Purpose

WODsmith manages workout programming and public competition experiences. Success on the benchmark guide means a visitor can understand the library's breadth, move between training domains, and open a specific workout without scanning one long undifferentiated page.

## Positioning

Workouts remain first-class competition events with scoring schemes, division descriptions, movements, schedules, and athlete submission states rather than generic article content.

## Operating Context

The public Compete experience uses a competition header, route tabs, an overview content column, and registration context. Workout details open as dedicated event routes.

## Capabilities and Constraints

- Workouts may use time, capped time, rounds and reps, load, calories, meters, feet, points, pass/fail, or EMOM scoring.
- Movements are categorized as weightlifting, gymnastic, or monostructural and may carry searchable tags.
- Public workout cards can include schedules, venues, division scaling, child events, sponsors, submission status, movements, and tags.
- The requested concepts replace only the workout section. The existing competition header, tabs, and sidebar remain intact.
- The benchmark prototype must represent all 58 current published workouts and remain usable on desktop and mobile.

## Brand Commitments

The product name is WODsmith. The incumbent Compete surface uses a dark-first neutral interface with orange as the primary accent, compact sans-serif typography, rounded controls, and restrained borders.

## Evidence on Hand

- Live benchmark: https://demo.wodsmith.com/compete/training-guide-benchmark
- Current implementation: `apps/wodsmith-start/src/routes/compete/$slug/index.tsx` and `apps/wodsmith-start/src/components/competition-workout-card.tsx`
- Domain model: `lat.md/domain.md`
- The live benchmark contains 58 workout headings and produces a 13,182px document at a 1,000px desktop viewport.
- No testimonials, usage analytics, or athlete research were provided; prototypes must not imply them.

## Product Principles

- Optimize the benchmark guide for browsing by training domain.
- Keep recognition data visible; progressively disclose secondary workout detail.
- Preserve stable position and context while filtering or expanding groups.
- Treat all 58 workouts as navigable content, not a sample or teaser.
- Keep public competition context and detail routes intact.

## Accessibility & Inclusion

Use semantic headings, lists or tables, visible keyboard focus, labeled search and filter controls, minimum 44px mobile targets, and reduced-motion-safe interactions.
