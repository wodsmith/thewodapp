# Public and auth-entry coverage audit

This audit records the first deployed browser-evidence slice for WODsmith Start and Crew without presenting deployed output as verification of the stacked PR source.

## Scope and provenance

The slice covers 14 route records and 32 scenarios. It contains 25 verified observations, seven explicit blockers, 28 screenshots, four console observations, one redirect trace, and one machine-readable capture manifest.

Start evidence came from fresh anonymous sessions against `https://wodsmith.com`. Crew evidence came from `https://crew-demo.wodsmith.com` because `crew.wodsmith.com` did not resolve. No form was submitted and no destructive action was attempted.

Every live artifact is SHA-256 pinned in `page-coverage.plan.json`. The capture manifest records requested and final URLs, deployed environment, host, timestamp, viewport, requested and effective color scheme, tool version, and `deploymentRevision: "unknown"` because neither deployment exposed a source revision.

## Route dispositions

| Surface | Route records | Disposition | Observed UI pattern |
| --- | ---: | --- | --- |
| Start competition discovery | 1 | route-specific | Competition filters, tabs, search, and domain cards remain app-owned. |
| Start legal pages | 2 | library-candidate | Terms and privacy share a long-form document shell, back link, heading treatment, prose width, and footer. |
| Start maintenance | 1 | library-candidate | A centered status-page shell can cover maintenance, empty, and unavailable states. |
| Start auth entry | 5 | library-candidate | Sign-in, sign-up, forgot-password, and missing-token states repeat card/form/status composition around shared primitives. |
| Start team invite | 1 | unassessed | Only the missing-token source gate was observed; authenticated invite UI needs a disposable token fixture. |
| Crew home | 1 | library-candidate | Hero copy, action groups, and an informational route-list card form a reusable public landing pattern. |
| Crew calculator | 1 | route-specific | Staffing assumptions, estimates, and role tables are domain-specific despite using reusable controls. |
| Crew auth entry | 2 | library-candidate | Sign-in and sign-up repeat the same auth-card family observed in Start with different copy and fields. |

The strongest next composite is an auth-entry shell that composes the existing shared `Card`, `Form`, `Input`, and `Button` primitives without owning routing, validation, or server actions. Legal-document and centered-status layouts are smaller follow-up candidates.

## Blockers and inconsistencies

Crew did not activate dark styling when Chromium reported `prefers-color-scheme: dark`. All four dark attempts rendered with an empty `html.className`, `effectiveDark: false`, and no console messages, so those scenarios are `blocked` with `THEME_NOT_IMPLEMENTED` rather than verified.

Valid password-reset, email-verification, and authenticated team-invite paths are blocked with `FIXTURE_TOKEN_UNAVAILABLE`. Missing-token error and redirect behavior was verified separately and does not stand in for the token-backed happy paths.

The remaining 225 pending scenarios are intentionally untouched by this slice.
