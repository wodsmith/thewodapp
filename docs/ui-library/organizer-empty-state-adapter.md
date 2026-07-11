# Organizer empty-state adapter inventory

This inventory records the audited Start and Crew organizer adapters that now compose the shared `@repo/ui` EmptyState without changing their feature-facing prop API.

## Audited surface

The two adapter definitions were byte-identical before migration and remain byte-identical after migration. No feature consumer changes are part of this slice.

| App | Adapter definition | Consumer files | Render sites | Plain | Default card |
| --- | --- | ---: | ---: | ---: | ---: |
| WODsmith Start | `apps/wodsmith-start/src/components/organizer/empty-state.tsx` | 11 | 16 | 3 | 13 |
| Crew | `apps/crew/src/components/organizer/empty-state.tsx` | 4 | 5 | 3 | 2 |
| Total | 2 mirrored definitions | 15 | 21 | 6 | 15 |

## Compatibility mapping

The adapter maps `variant="plain"` to `EmptyState.Root` and the default `variant="card"` to `EmptyState.Card`. Both surfaces compose `Icon`, `Title`, `Description`, and optional `Actions` children.

- The required icon, title, and description props are unchanged.
- The caller-owned title remains an `h3` at every existing render site.
- Primary and secondary actions still require both their label and callback.
- Buttons retain their order, variants, supplied icons, and callbacks.
- The legacy card's outer presentation and nested `CardContent` spacing are preserved; this slice intentionally does not normalize the audited double padding without page-level visual evidence.
- The icon wrapper is now explicitly decorative with `aria-hidden="true"`; the icon was already visual-only and no accessible label or interactive behavior is removed.

## Verification contract

Mirrored Start and Crew tests cover plain and card presentations, incomplete action omission, action ordering and callbacks, icon rendering, heading level, and byte-identical source parity. Shared primitive behavior remains covered by the package EmptyState tests and Storybook stories.
