# WODsmith UI Library Inventory

This generated inventory measures the shared package, compatibility adapters, and their consumers so later migration PRs can stay narrow and observable.

Regenerate with `pnpm --filter wodsmith-start ui:inventory` and verify it with `pnpm --filter wodsmith-start check:ui-inventory`.

## Scope summary

The Start app exposes 37 primitive import paths in `src/components/ui`. They are consumed directly by 181 route-owned files and 149 shared component files.

- `@repo/ui` owns 29 extracted primitive implementations under `packages/ui/src/components`.
- 17 primitive modules have representative Storybook stories.
- Direct barrel consumers: 0.
- Crew exposes 37 primitive import paths; 37 filenames overlap with Start and 35 of those adapters or app-local implementations are byte-identical.
- Divergent Start/Crew paths: `searchable-select`, `sidebar`.

## Boundary classification

The classification is migration guidance, not a claim that every candidate is ready to extract unchanged.

- **foundation** — low-level visual or form primitives that are first candidates for a shared package.
- **composition** — reusable Radix/shadcn compositions that may need provider, portal, or browser-behavior review.
- **app adapter** — components with WODsmith-specific behavior or data contracts that remain app-owned unless their API is generalized deliberately.

## Primitive consumers

Counts are unique importing files. Route-owned components under `src/routes` count as routes; reusable components outside `components/ui` count as components.

| Primitive module | Classification | Shared package | Route files | Component files | UI dependencies | Story |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `alert` | foundation | yes | 24 | 10 | 0 | yes |
| `alert-dialog` | composition | — | 18 | 4 | 0 | — |
| `avatar` | foundation | yes | 18 | 2 | 0 | yes |
| `badge` | foundation | yes | 79 | 64 | 0 | yes |
| `breadcrumb` | composition | yes | 1 | 2 | 0 | yes |
| `button` | foundation | yes | 151 | 108 | 4 | yes |
| `calendar` | composition | — | 3 | 1 | 0 | — |
| `card` | foundation | yes | 113 | 50 | 0 | yes |
| `checkbox` | foundation | yes | 23 | 12 | 0 | — |
| `collapsible` | composition | yes | 11 | 15 | 0 | yes |
| `dialog` | composition | yes | 17 | 23 | 0 | yes |
| `dropdown-menu` | composition | yes | 4 | 4 | 0 | yes |
| `field` | foundation | yes | 3 | 1 | 0 | yes |
| `file-upload` | app adapter | — | 0 | 1 | 0 | — |
| `form` | composition | yes | 19 | 13 | 0 | yes |
| `hover-card` | composition | yes | 0 | 1 | 0 | yes |
| `image-upload` | app adapter | — | 1 | 1 | 0 | — |
| `input` | foundation | yes | 66 | 43 | 3 | yes |
| `label` | foundation | yes | 38 | 25 | 0 | — |
| `list-item` | app adapter | — | 0 | 4 | 0 | — |
| `popover` | composition | yes | 7 | 6 | 1 | — |
| `progress` | foundation | yes | 5 | 0 | 0 | yes |
| `radio-group` | composition | yes | 4 | 2 | 0 | — |
| `scroll-area` | composition | yes | 2 | 3 | 1 | yes |
| `searchable-select` | app adapter | — | 1 | 1 | 0 | — |
| `select` | composition | yes | 49 | 35 | 0 | — |
| `separator` | foundation | yes | 7 | 4 | 1 | — |
| `sheet` | composition | yes | 3 | 4 | 1 | — |
| `sidebar` | composition | — | 0 | 4 | 0 | — |
| `skeleton` | foundation | yes | 4 | 8 | 1 | — |
| `spinner` | foundation | yes | 1 | 0 | 0 | — |
| `table` | foundation | yes | 21 | 11 | 0 | — |
| `tabs` | composition | yes | 12 | 6 | 0 | yes |
| `textarea` | foundation | yes | 21 | 20 | 0 | — |
| `toggle-group` | composition | — | 1 | 0 | 0 | — |
| `tooltip` | composition | yes | 0 | 6 | 1 | — |
| `video-url-input` | app adapter | — | 0 | 2 | 0 | — |

## Migration constraint

Extracted primitives keep Start and Crew runtime imports stable through thin app-local re-exports. Storybook imports `@repo/ui` directly; divergent adapters, form controllers, and domain components stay app-owned for later reviewed slices.
