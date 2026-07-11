# Organizer empty-state adapter inventory

This inventory records the remaining compatibility-adapter surface and the first direct organizer consumers of the shared `@repo/ui` EmptyState.

## Audited surface

The two adapter definitions remain byte-identical. Ten component-owned render sites now compose the shared primitive directly, while nine Start route-owned sites retain the legacy adapter for later slices.

| App | Remaining adapter consumer files | Remaining render sites | Plain | Default card |
| --- | ---: | ---: | ---: | ---: |
| WODsmith Start | 6 | 9 | 0 | 9 |
| Crew | 0 | 0 | 0 | 0 |
| Total | 6 | 9 | 0 | 9 |

## Direct consumer migration

The mirrored component cluster keeps Start and Crew source parity while making surface, heading, copy, and actions explicit at each call site.

| Consumer | Sites per app | Surface | Heading | Action |
| --- | ---: | --- | --- | --- |
| `registration-questions-editor.tsx` | 1 | plain | h3 | Add Question opens the existing dialog |
| `event-division-mapper.tsx` | 2 | plain | h3 | none |
| `organizer/invites/invite-sources-list.tsx` | 1 | card | h2 | optional Add source callback |
| `organizer/schedule/venue-manager.tsx` | 1 | card | h3 beneath the Venues h2 | Add venue opens the existing dialog |

The two apps therefore migrate five render sites each and ten total. Copy, icon treatment, plain/card classes, card nesting, callbacks, action omission, and route/domain logic remain stable. The Sources tab title moves from the adapter-forced h3 to the caller-correct h2 below the Invites h1.

## Compatibility mapping

For the nine remaining sites, the adapter maps `variant="plain"` to `EmptyState.Root` and the default `variant="card"` to `EmptyState.Card`. Both surfaces compose `Icon`, `Title`, `Description`, and optional `Actions` children.

- The required icon, title, and description props are unchanged.
- The caller-owned title remains an `h3` at every existing render site.
- Primary and secondary actions still require both their label and callback.
- Buttons retain their order, variants, supplied icons, callbacks, and mobile equal-width stretch before returning to a centered row at `sm`.
- The legacy card's outer presentation and nested `CardContent` spacing are preserved; this slice intentionally does not normalize the audited double padding without page-level visual evidence.
- The icon wrapper is now explicitly decorative with `aria-hidden="true"`; the icon was already visual-only and no accessible label or interactive behavior is removed.

## Verification contract

Adapter tests continue to cover its compatibility API. Mirrored consumer tests cover the registration action, both event-mapping prerequisites, optional invite action, venue action, and caller-owned heading levels. Shared primitive behavior remains covered by package tests and Storybook stories.
