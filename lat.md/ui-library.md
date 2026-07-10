# UI Library

The UI library boundary lets WODsmith evolve reusable primitives independently from route features while preserving app behavior during a stacked migration.

## Current boundary

PR 3 expands [[packages/ui/src/components/button.tsx#Button|the shared package primitive directory]] with a dependency-closed form and overlay layer while preserving every Start and Crew route import.

\`@repo/ui\` owns the foundation primitives plus \`checkbox\`, \`dialog\`, \`dropdown-menu\`, \`form\`, \`popover\`, \`radio-group\`, \`select\`, \`sheet\`, \`tabs\`, and \`tooltip\`. The two apps keep thin re-export files at their previous paths, so feature and route files do not churn.

\`switch\` and \`command\` are not present in either app at this layer. Divergent \`searchable-select\`, \`sidebar\`, domain components, and \`use-mobile\` remain app-owned.

## Shared package boundary

The workspace package \`@repo/ui\` under \`packages/ui\` exposes direct component subpaths, \`cn\`, and a shared stylesheet without a root barrel migration.

The package may own presentational primitives, their variants, and portable styling contracts. It must not import TanStack route modules, server functions, database code, authentication state, or app feature types.

React and React DOM are explicit peer contracts, while package tests pin both runtimes to the same 19.2.3 resolution used by Start and Crew.

Its production TypeScript configuration includes only package source. Cross-app compatibility is verified separately, while Start and Crew type-check their adapters as consumers.

The package build transpiles source to ignored JavaScript under \`dist\`. Declarations are not configured, and direct subpath exports continue to resolve the package TypeScript sources.

The shared Tailwind v4 stylesheet at \`packages/ui/src/styles.css\` owns semantic theme utilities, light/dark token values, and base body/border styles. Its \`dark\` variant follows a \`.dark\` ancestor, matching app theme state rather than the operating-system preference.

Each app imports Tailwind first, then \`@repo/ui/styles.css\`, then its typography plugin, and retains only app-specific keyframes and range-control rules.

## Storybook contract

Storybook is the isolated development and static-build surface for the current boundary.

[[apps/wodsmith-start/.storybook/main.ts]] uses the React Vite framework with a dedicated [[apps/wodsmith-start/.storybook/vite.config.ts|Storybook Vite config]], avoiding the Start app's Cloudflare and server plugins. [[apps/wodsmith-start/.storybook/preview.tsx]] scopes Docs theme state to story wrappers so dark examples do not restyle Docs chrome.

Canvas theme state also reaches its iframe root and body. This lets body-portalled overlays inherit the toolbar-selected semantic tokens even when the operating-system preference is the opposite theme.

Representative stories cover foundations plus form validation, selection controls, dialogs, sheets, menus, popovers, tooltips, and tabs by importing direct \`@repo/ui/*\` entry points. Their play functions exercise keyboard and pointer interactions.

### Semantic contrast audit

Semantic primary and destructive foreground pairs meet WCAG AA contrast for normal text in both themes.

Primary contrast is 4.729:1 in light mode and 5.538:1 in dark mode. Destructive contrast is 4.619:1 in light mode and 5.251:1 in dark mode. Standalone primary/destructive text also exceeds 4.5:1 against its theme background.

The Start, Crew, and shared-package audit covers 267 \`bg-primary\`, 82 \`text-primary-foreground\`, 265 standalone \`text-primary\`, 94 \`bg-destructive\`, 24 \`text-destructive-foreground\`, and 1,039 \`dark:\` utility occurrences.

Foreground exceptions are state-matched: light \`bg-black\` becomes dark \`bg-primary\`, group-hover foreground changes accompany group-hover backgrounds, and destructive foreground hover states accompany destructive hover backgrounds. No unmatched foreground/background pair needs a local color override.

[[apps/wodsmith-start/storybook-tests/semantic-contrast.spec.ts]] reads every Canvas story id from the static \`index.json\`, runs light and dark with opposite OS preferences, exercises portal states, and requires zero axe color-contrast violations. It separately verifies Docs theme isolation.

## Compatibility contract

Focused package tests prove that Start and Crew adapters expose the same runtime objects and exact export names as direct \`@repo/ui\` imports.

[[packages/ui/test/compatibility.test.ts]] also checks the shared stylesheet contract. [[packages/ui/test/primitives.test.tsx]] verifies checkbox and dialog accessibility plus the diagnostic for form controls rendered outside a field context.

## Inventory contract

The checked-in inventory makes route and component coupling visible before each extraction slice.

\`apps/wodsmith-start/scripts/generate-ui-library-inventory.mjs\` counts direct primitive consumers, identifies package-owned implementations, compares Start and Crew paths, and verifies the generated artifact is current.
