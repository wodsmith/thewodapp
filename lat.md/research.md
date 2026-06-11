# Research

Research notes capture external product, market, and workflow analysis that informs WODsmith product decisions and downloadable resources.

## Open Scorecard Downloadables

The Open scorecard downloadable research describes a two-page WODsmith score kit based on recent CrossFit Open scorecard patterns.

The source note is `docs/research/crossfit-open-scorecard-template.md`, and the refresh script is `scripts/research/crossfit-open-scorecards.mjs`. The script preserves decoded PDF URLs as published and skips failed workout pages so one unavailable page does not abort the matrix refresh.

## Organic Organizer Acquisition Plan

The organic organizer acquisition plan defines the one-year content, activation, and measurement path for earning a real non-referred competition organizer.

The source plan is `docs/plans/organic-organizer-acquisition-strategy.md`. It separates Sales Safari research, Ebomb production, and self-serve draft activation across a weekly execution cadence from May 30, 2026 through May 28, 2027.

## Route Docs Rollout Plan

The route docs rollout plan ranks organizer features by user-facing complexity against business importance to sequence in-app documentation authored with the docs drawer CMS from PR #505.

The source plan is `docs/plans/route-docs-rollout-strategy.md`. It phases coverage: day-one link docs to existing Docusaurus pages plus a layout-level overview doc, deep markdown how-tos for results publishing, event-division mappings, and the registration money path, videos for judge rotations and series templates, then cohost and athlete surface expansion. Drafted drawer content for the first two phases lives in `docs/route-docs-content/`, one file per CMS entry with frontmatter mirroring the CMS fields.
