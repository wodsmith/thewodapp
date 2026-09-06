---
timestamp: 2026-09-05T23-53-44Z
slug: apps-wodsmith-gameday-gameday-features
---
# Game Day design review

Method: dual-agent (A: `/root/impeccable_design`; B: `/root/impeccable_evidence`). The assessments were isolated; the parent read A before B. Both reviewed SwiftUI and real light-mode simulator screenshots.

## Baseline assessment

The first implementation had genuine competition data and native navigation, but its composition was too promotional and repetitive. The independent usability score was 24/40; the native technical score was 12/20. These describe the baseline, not a post-fix certification.

| Heuristic | Baseline score | Main finding |
| --- | --- | --- |
| System status | 2/4 | Global freshness and no active countdown feedback |
| Real-world match | 3/4 | Authentic heat/lane vocabulary obscured by slogans |
| User control | 3/4 | Native exits; countdown stop too distant |
| Consistency | 3/4 | Native structures, inconsistent internal-link arrows |
| Error prevention | 2/4 | Date-less personal schedule could mislead |
| Recognition | 2/4 | Later heats displaced by repeated content |
| Efficiency | 2/4 | Too much discovery/hero chrome before assignments |
| Minimalist design | 2/4 | Oversized cards, eyebrows, and repeated next heat |
| Error recovery | 2/4 | Generic or wrong-resource recovery |
| Help | 3/4 | Useful domain-specific guidance |

## Consolidated findings and corrections

The two assessments agreed on the important defects: inaccessible orange text, fixed display sizes, oversized next-heat presentation, duplicate immediate heat rows, missing date context, and template copy. The technical assessment additionally traced the global-freshness bug, public-competition retry mismatch, and ambiguous leaderboard states.

Corrections replace the marketing homepage with native competition rows, preserve the requested registered-first home order, compact the next heat, remove its duplicated schedule entry, and use plain subsequent-heat rows. Display text follows Dynamic Type; critical metrics stack at accessibility sizes. Orange has appearance-aware text contrast. Heat dates use the competition timezone.

Home, competition, and leaderboard resources now own separate successful-download times, loading state, errors, and retries. Cached schedules retain their own timestamp after unrelated successful requests. Live Activity controls show an active end action. Sign-in progress remains labeled; errors receive accessible feedback.

The recommendation to change the default home tab to My day was not adopted because the user explicitly requested registered competitions and discovery on the home page. Native tabs, grouped Profile lists, SF Symbols, and iOS tab-bar glass were preserved as platform behavior.

## Evidence and limits

The web detector was attempted once and returned an empty array because it supports no Swift files. Automated native rules evaluated: zero. This is not a clean design result. No browser overlay was injected, and no live detector server was started; native source and simulator screenshots were the evidence.

Target slug: `apps-wodsmith-gameday-gameday-features`. No critique ignore list was applied. Initial screenshots and isolated reports were saved under `/tmp/gameday-design-before/` and `/tmp/gameday-impeccable-{A,B}.md`. Confirmation must cover the corrected light/dark screens, accessibility text size, native flow tests, and schedule freshness regression tests. No untested state is certified by these baseline scores.
