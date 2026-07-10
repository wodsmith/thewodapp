# UI Library

The UI library boundary lets WODsmith evolve reusable primitives independently from route features while preserving app behavior during a stacked migration.

## Current boundary

PR 2 makes [[packages/ui/src/components/button.tsx#Button|the shared package primitive directory]] canonical for the first low-dependency extraction while preserving every Start and Crew route import.

\`@repo/ui\` owns \`badge\`, \`button\`, \`card\`, \`input\`, \`label\`, \`separator\`, \`skeleton\`, \`spinner\`, \`table\`, \`textarea\`, and \`cn\`. The two apps keep thin re-export files at their previous paths, so feature and route files do not churn.

Stateful, overlay, form, and domain components remain app-owned. \`use-mobile\` also stays app-local because none of the extracted primitives depends on it.

## Shared package boundary

The workspace package \`@repo/ui\` under \`packages/ui\` exposes direct component subpaths, \`cn\`, and a shared stylesheet without a root barrel migration.

The package may own presentational primitives, their variants, and portable styling contracts. It must not import TanStack route modules, server functions, database code, authentication state, or app feature types.

Its production TypeScript configuration includes only package source. Cross-app compatibility is verified separately, while Start and Crew type-check their adapters as consumers.

The shared Tailwind v4 stylesheet at \`packages/ui/src/styles.css\` owns semantic theme utilities, light/dark token values, and base body/border styles. Each app imports Tailwind first, then \`@repo/ui/styles.css\`, then its typography plugin, and retains only app-specific keyframes and range-control rules.

## Storybook contract

Storybook is the isolated development and static-build surface for the current boundary.

[[apps/wodsmith-start/.storybook/main.ts]] uses the React Vite framework with a dedicated [[apps/wodsmith-start/.storybook/vite.config.ts|Storybook Vite config]], avoiding the Start app's Cloudflare and server plugins. [[apps/wodsmith-start/.storybook/preview.tsx]] scopes global tokens, theme state, and tooltip context to a full-size story wrapper so dark stories do not restyle Docs chrome.

Representative stories cover button variants, badge states, card composition, and form-control states by importing direct \`@repo/ui/*\` entry points. Accessibility checks are configured as errors, and \`build-storybook\` is the production-like static validation.

## Compatibility contract

Focused package tests prove that Start and Crew adapters expose the same runtime objects as direct \`@repo/ui\` imports.

[[packages/ui/test/compatibility.test.ts]] also checks that the shared stylesheet owns the global token definitions, scans package component sources, and is imported once in the required order by both apps.

## Inventory contract

The checked-in inventory makes route and component coupling visible before each extraction slice.

\`apps/wodsmith-start/scripts/generate-ui-library-inventory.mjs\` counts direct primitive consumers, identifies package-owned implementations, compares Start and Crew paths, and verifies the generated artifact is current.
