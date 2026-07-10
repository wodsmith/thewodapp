# WODsmith UI Library Inventory

This generated inventory measures the current app-local UI boundary and its consumers so later migration PRs can stay narrow and observable.

Regenerate with `pnpm --filter wodsmith-start ui:inventory` and verify it with `pnpm --filter wodsmith-start check:ui-inventory`.

## Scope summary

The Start app owns 36 primitive modules in `src/components/ui`. They are consumed directly by 181 route-owned files and 149 shared component files.

- 4 primitive modules have representative Storybook stories.
- Direct barrel consumers: 0.
- Crew has 36 primitive modules; 36 filenames overlap with Start and 34 of those are byte-identical.
- Divergent Start/Crew copies: `searchable-select`, `sidebar`.

## Boundary classification

The classification is migration guidance, not a claim that every candidate is ready to extract unchanged.

- **foundation** — low-level visual or form primitives that are first candidates for a shared package.
- **composition** — reusable Radix/shadcn compositions that may need provider, portal, or browser-behavior review.
- **app adapter** — components with WODsmith-specific behavior or data contracts that remain app-owned unless their API is generalized deliberately.

## Primitive consumers

Counts are unique importing files. Route-owned components under `src/routes` count as routes; reusable components outside `components/ui` count as components.

| Primitive module | Classification | Route files | Component files | UI dependencies | Story |
| --- | --- | ---: | ---: | ---: | --- |
| `alert` | foundation | 24 | 10 | 0 | — |
| `alert-dialog` | composition | 18 | 4 | 0 | — |
| `avatar` | foundation | 18 | 2 | 0 | — |
| `badge` | foundation | 79 | 64 | 0 | yes |
| `breadcrumb` | composition | 1 | 2 | 0 | — |
| `button` | foundation | 151 | 108 | 4 | yes |
| `calendar` | composition | 3 | 1 | 0 | — |
| `card` | foundation | 114 | 50 | 0 | yes |
| `checkbox` | foundation | 23 | 12 | 0 | — |
| `collapsible` | composition | 11 | 15 | 0 | — |
| `dialog` | composition | 17 | 23 | 0 | — |
| `dropdown-menu` | composition | 4 | 4 | 0 | — |
| `file-upload` | app adapter | 0 | 1 | 0 | — |
| `form` | composition | 19 | 13 | 0 | — |
| `hover-card` | composition | 0 | 1 | 0 | — |
| `image-upload` | app adapter | 1 | 1 | 0 | — |
| `input` | foundation | 66 | 43 | 3 | yes |
| `label` | foundation | 38 | 25 | 1 | — |
| `list-item` | app adapter | 0 | 4 | 0 | — |
| `popover` | composition | 7 | 6 | 1 | — |
| `progress` | foundation | 5 | 0 | 0 | — |
| `radio-group` | composition | 4 | 2 | 0 | — |
| `scroll-area` | composition | 2 | 3 | 1 | — |
| `searchable-select` | app adapter | 1 | 1 | 0 | — |
| `select` | composition | 49 | 35 | 0 | — |
| `separator` | foundation | 7 | 4 | 1 | — |
| `sheet` | composition | 3 | 4 | 1 | — |
| `sidebar` | composition | 0 | 4 | 0 | — |
| `skeleton` | foundation | 4 | 8 | 1 | — |
| `spinner` | foundation | 1 | 0 | 0 | — |
| `table` | composition | 21 | 11 | 0 | — |
| `tabs` | composition | 12 | 6 | 0 | — |
| `textarea` | foundation | 21 | 20 | 0 | — |
| `toggle-group` | composition | 1 | 0 | 0 | — |
| `tooltip` | composition | 0 | 6 | 1 | — |
| `video-url-input` | app adapter | 0 | 2 | 0 | — |

## PR-1 migration constraint

This foundation PR does not rewrite runtime imports. Storybook renders the canonical Start copies, while future stack layers can extract reviewed candidates into `@repo/ui` and migrate consumers in measured slices.
