# UI Library

The UI library boundary lets WODsmith evolve reusable primitives independently from route features while preserving app behavior during a stacked migration.

## Current boundary

PR 1 treats [[apps/wodsmith-start/src/components/ui/button.tsx#Button|the Start app primitive directory]] as the canonical runtime source and adds Storybook without changing route imports.

Stories live beside primitives and are discovered only under \`apps/wodsmith-start/src/components/ui\`. This makes the boundary visible without pulling feature components or route-owned components into the library.

The Crew app currently carries a mostly identical copy of the same primitive tree. Its differences are recorded in \`apps/wodsmith-start/docs/ui-library-inventory.md\`; reconciling them belongs in a later extraction slice.

## Shared package boundary

The target workspace package is \`@repo/ui\` under \`packages/ui\`, created only when the first reviewed primitives are extracted in a later PR.

The package may own presentational primitives, their variants, and portable styling contracts. It must not import TanStack route modules, server functions, database code, authentication state, or app feature types.

App-specific adapters and domain compositions remain under each app. Package extraction must preserve direct imports until the package API and tree-shaking behavior are validated; a broad barrel migration is not part of the foundation.

## Storybook contract

Storybook is the isolated development and static-build surface for the current boundary.

[[apps/wodsmith-start/.storybook/main.ts]] uses the React Vite framework with a dedicated [[apps/wodsmith-start/.storybook/vite.config.ts|Storybook Vite config]], avoiding the Start app's Cloudflare and server plugins. [[apps/wodsmith-start/.storybook/preview.tsx]] scopes global tokens, theme state, and tooltip context to a full-size story wrapper so dark stories do not restyle Docs chrome.

Representative stories cover button variants, badge states, card composition, and form-control states. Accessibility checks are configured as errors, and \`build-storybook\` is the production-like static validation.

## Inventory contract

The checked-in inventory makes route and component coupling visible before each extraction slice.

\`apps/wodsmith-start/scripts/generate-ui-library-inventory.mjs\` counts direct primitive consumers, classifies extraction candidates, compares the Start and Crew copies, and verifies the generated artifact is current.
