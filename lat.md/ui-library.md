# UI Library

The UI library boundary lets WODsmith evolve reusable primitives independently from route features while preserving app behavior during a stacked migration.

## Current boundary

The shared package now includes a dependency-closed feedback, identity, navigation, disclosure, progress, and scrolling slice while preserving every Start and Crew route import.

\`@repo/ui\` owns [[packages/ui/src/components/alert.tsx#Alert|alert]], avatar, breadcrumb, collapsible, hover-card, progress, [[packages/ui/src/components/scroll-area.tsx#ScrollArea|scroll-area]], and children-driven field composition in addition to the earlier foundation, form, and overlay primitives. The apps keep thin re-exports at their previous paths.

[[packages/ui/src/components/auth-entry.tsx#AuthEntry|Auth entry]] is a children-driven compound pattern for responsive account-entry composition. It owns structure and semantics only; route controllers, forms, auth state, branding, and theme activation remain app-owned. Start and Crew sign-in are its first consumers.

\`list-item\` remains an app adapter because its prop and compound APIs need a separate composition decision. The custom \`toggle-group\` remains app-owned pending an accessibility/API review. Divergent \`searchable-select\`, \`sidebar\`, domain components, and \`use-mobile\` also remain app-owned.

### Field composition

[[packages/ui/src/components/field.tsx#Field|Field]] and FieldGroup own portable label, control, description, error, fieldset, and legend semantics without owning validation state or form controllers.

Callers provide a stable id plus optional description and error content to the compound root. Field.Control slots exactly one concrete child, preserves existing described-by tokens, appends deduplicated metadata ids in description/error order, and marks invalid state only for renderable error content.

Metadata renderers read the root contract and omit themselves when their content is absent. FieldGroup uses a native fieldset with a direct legend and the same description/error semantics. Compound parts fail fast outside their matching root.

Start and Crew expose identity-only \`field\` adapters, but no feature route migrates in this extraction slice. Existing React Hook Form primitives and their misuse guard remain unchanged until separately reviewed consumer migrations.

#### Accessible field metadata

The field control receives its accessible name, ordered description and error references, invalid state, enforced ids, semantic error role, and metadata refs.

#### Absent field metadata

A field without description or error content omits metadata nodes, described-by references, and invalid state while preserving root props and classes.

#### Slotted control precedence

A custom slotted child cannot override the field id, metadata references, or invalid state, while native props, classes, and composed refs remain intact.

#### Single slotted control

Field.Control rejects zero, multiple, or Fragment children so Radix Slot always receives exactly one concrete control.

#### Stable field id

Field.Root rejects a blank id because label and metadata relationships require a caller-owned stable identifier.

#### Field context misuse

Every Field compound part fails with a specific error when rendered outside Field.Root.

#### Accessible field group

FieldGroup renders a native fieldset with a direct legend, ordered description and error references, invalid state, native props, classes, and refs.

#### Absent group metadata

A field group without description or error content omits metadata nodes and ARIA state, while FieldGroup.Root rejects blank ids.

#### Field group context misuse

Every FieldGroup compound part fails with a specific error when rendered outside FieldGroup.Root.

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

Representative stories cover foundations plus form validation, field and fieldset composition, selection controls, dialogs, sheets, menus, popovers, tooltips, tabs, alerts, avatars, breadcrumbs, collapsibles, hover cards, progress, and scroll areas by importing direct \`@repo/ui/*\` entry points.

The new stories verify field naming, descriptions, invalid transitions, disabled and slotted controls, native fieldset groups, alert and breadcrumb semantics, image and fallback identity, disclosure state, portal hover behavior, visible progress, and real overflow. Existing semantic-contrast tests exercise every added Canvas story in both themes.

Auth-entry stories cover the standard Card and unframed Plain surfaces, a forced-dark composition under opposite operating-system preference, composed error and pending status regions, keyboard order, long copy, and 320/390 px overflow safety.

### Semantic contrast audit

Semantic primary and destructive foreground pairs meet WCAG AA contrast for normal text in both themes.

Primary contrast is 4.729:1 in light mode and 5.538:1 in dark mode. Destructive contrast is 4.619:1 in light mode and 5.251:1 in dark mode. Standalone primary/destructive text also exceeds 4.5:1 against its theme background.

The Start, Crew, and shared-package audit covers 267 \`bg-primary\`, 82 \`text-primary-foreground\`, 265 standalone \`text-primary\`, 94 \`bg-destructive\`, 24 \`text-destructive-foreground\`, and 1,039 \`dark:\` utility occurrences.

Foreground exceptions are state-matched: light \`bg-black\` becomes dark \`bg-primary\`, group-hover foreground changes accompany group-hover backgrounds, and destructive foreground hover states accompany destructive hover backgrounds. No unmatched foreground/background pair needs a local color override.

[[apps/wodsmith-start/storybook-tests/semantic-contrast.spec.ts]] reads every Canvas story id from the static \`index.json\`, runs light and dark with opposite OS preferences, exercises portal states, and requires zero axe color-contrast violations. The confirmation dialog coverage explicitly audits the shared default Button's pointer-hover state, including its dark-theme foreground pair. The suite separately verifies Docs theme isolation.

## Compatibility contract

Focused package tests prove that Start and Crew adapters expose the same runtime objects and exact export names as direct \`@repo/ui\` imports.

[[packages/ui/test/compatibility.test.ts]] checks exact export names and runtime identity for the added adapters as well as the shared stylesheet contract.

[[packages/ui/test/primitives.test.tsx]] verifies alert, avatar fallback, breadcrumb, collapsible, progress, and scroll-area behavior alongside the existing form and overlay accessibility contracts. Hover timing and portal behavior stay in the browser-backed Storybook play test.

[[packages/ui/test/field.test.tsx]] verifies accessible names, metadata id order and deduplication, omission, invalid state, slotted custom controls, native props and refs, fieldset legend semantics, stable ids, and strict compound-context errors.

The same package suite verifies auth-entry heading semantics, native props, refs, class merging, and both explicit surfaces without coupling the package to any auth controller.

## Inventory contract

The checked-in inventory makes route and component coupling visible before each extraction slice.

\`apps/wodsmith-start/scripts/generate-ui-library-inventory.mjs\` counts direct primitive consumers, identifies package-owned implementations, compares Start and Crew paths, and verifies the generated artifact is current.

## Page coverage contract

The checked-in page contract makes every browser surface and explicit non-page decision visible before route components move into the shared library.

The human-owned plan lives at `docs/ui-library/page-coverage.plan.json`. Deterministic discovery joins it into generated JSON and Markdown ledgers without treating generated output as a planning surface.

### Discovery identity

Route identity preserves framework semantics while URL patterns represent the browser address that evidence will eventually exercise.

TanStack discovery starts from each registered `routeTree.gen.ts`, joins every generated alias to its source `createFileRoute` or `createRootRoute` declaration, and then scans declarations only to reject orphans. Route filenames alone are never inventory inputs.

TypeScript syntax trees identify route option properties and calls, so comments, strings, regex literals, and braces inside comments cannot create false component, handler, or redirect classifications.

Canonical TanStack IDs preserve pathless and index identity. For example, source ID `/compete/$slug/` becomes `tanstack:wodsmith-start:/compete/$slug/_index`, while its URL pattern is `/compete/:slug`.

### Tree and source reconciliation

Generated routes and source declarations must form a one-to-one mapping before any coverage plan can be rendered.

The gate rejects unregistered app packages, missing imports, source/tree ID mismatches, orphan declarations, duplicate IDs, and unknown classifications. Shared URL patterns remain valid because layouts, pathless groups, and index pages can intentionally address the same URL.

### Classification priority

Mechanical classification distinguishes visual pages from infrastructure without using target counts as an input.

Root and pathless routes are layouts. Server handlers and API routes are nonvisual; component-free redirects are redirect-only. Components with descendants and an index are layouts, those without an index are page-layouts, and other components are pages.

Crew `/events` is therefore a page-layout/list, while `/events/$eventId` is a layout covered through its index descendant. Conditional redirects do not hide routes that also render components.

The reconciled baseline is 328 records: 239 page/page-layout records and 89 explicit non-page decisions. The 239 visual records plus 17 redirects equal 256 browser-addressable patterns; the earlier ~203 estimate incorrectly treated trailing-slash index pages as layouts.

### Docs and service decisions

Docusaurus and service-only surfaces remain full records even when they do not produce browser evidence scenarios.

Docs discovery records Markdown and MDX with YAML frontmatter plus category metadata. The configured route base is validated against Docusaurus and applied to every URL; `intro` keeps its ID while its slug maps to `/` today.

Team Memory contributes seven HTTP endpoints and one scheduled surface, OG Worker contributes three wildcard-aware HTTP decisions, and the PostHog proxy contributes one wildcard decision. Protocol and method remain part of every service ID.

Service discovery walks TypeScript syntax rather than matching source text. Team Memory chains and mounts plus pathname-derived Worker predicates reconcile against the registry; unknown path flow fails closed. PostHog requires straight-line delegation through the unshadowed canonical `./proxy` import.

### Validation invariants

The plan validator requires explicit placeholders for every page and page-layout while keeping exclusions reasoned and scenario-free.

Each scenario names persona, fixture, params, query, data state, theme, viewport, evidence, blockers, and status. Required axis values need coverage but not a Cartesian product; dynamic parameters must have values even while a scenario is pending.

Verified scenarios require hash-matched evidence and no blockers. Each evidence item names a known kind, portable repository-relative `ref`, and SHA-256; absolute and escaping refs are rejected on POSIX and Windows. Supported kinds include capture manifests alongside browser artifacts.

Live browser evidence requires a capture manifest entry tied to the route and scenario. The requested path, params, query, viewport profile and dimensions, themes, environment, revision, tool, and exact artifact set must match; duplicate, unreferenced, missing, or on-disk orphan evidence fails validation.

Scenario IDs must be nonblank strings. Blocked scenarios require a code and detail; pending and verified scenarios cannot retain blockers. Layout-only records must name a visual descendant, and other exclusions require a reason.

### Checked-in ledger gate

Generation and CI fail whenever the human plan, discovered repository surfaces, generated JSON, or generated Markdown drift apart.

`page-coverage:scaffold` adds explicit pending or exclusion decisions, `page-coverage:generate` joins the ledger, and `check:page-coverage` performs read-only validation. No initial record claims verified browser evidence.

### Public and auth-entry evidence

The first deployed evidence slice covers anonymous Start and Crew public/auth-entry surfaces while keeping deployed observations distinct from PR-head verification.

`docs/ui-library/public-entry-coverage-audit.md` records 14 route records and 32 scenarios: 25 verified observations and seven explicit blockers. Evidence came from fresh anonymous sessions against Start production and the Crew demo deployment without submitting forms or mutating data.

Start verified responsive light/dark behavior for competition discovery, legal, maintenance, and basic auth-entry pages. Missing-token reset and verification error states were observed separately from their blocked token-backed happy paths.

Crew verified desktop and mobile light output, but all four requested-dark scenarios remained light and are blocked with `THEME_NOT_IMPLEMENTED`. At 390 px, Crew home expands to 600 px and calculator to 759 px; these verified overflow observations require responsive follow-up. Valid token paths remain blocked until disposable fixtures exist.

Observed repetition makes auth-entry composition, long-form legal documents, and centered status pages shared-library candidates. Competition discovery and the Crew staffing calculator remain route-specific; the team-invite UI stays unassessed because only its source gate was observed.

### Docs and auxiliary app evidence

The second deployed evidence slice covers all public Docs pages plus anonymous CRM and Ledger entry and redirect behavior, while preserving explicit blockers for authenticated content and Gameday.

[The Docs and auxiliary app coverage audit](../docs/ui-library/docs-aux-coverage-audit.md) records 101 scenarios across 51 visual records: 84 verified and 17 blocked. The complete plan now has 109 verified, 24 blocked, and 174 pending scenarios.

All 34 Docs records have desktop/light and mobile/dark accessibility and DOM evidence. Representative screenshots cover six representative routes in both variants; every captured Docs route honored the requested theme and reported no horizontal overflow.

CRM and Ledger password roots verified dark desktop and mobile output without overflow. Their hard-coded dark state blocks requested-light scenarios, while anonymous probes verify redirects for all 12 protected visual routes without claiming authenticated page output.

Gameday remains blocked because no deployed DNS target or exact-revision local Vite/API runtime was available. Its browser output and component disposition are not inferred from source inspection.

The duplicated CRM and Ledger password experience supports a shared authentication-entry composition. Docs stays Docusaurus-owned and route-specific; authenticated auxiliary-app patterns remain unassessed until reproducible credentials and seeded data exist.

### Protected athlete evidence

The third evidence slice covers a bounded authenticated Start workflow across the dashboard, workouts, logs, programming, and personal settings using only disposable local infrastructure.

[The protected athlete coverage audit](../docs/ui-library/protected-athlete-coverage-audit.md) records 35 scenarios across 15 visual records: 33 verified and two blocked. The complete plan now has 142 verified, 26 blocked, and 159 pending scenarios.

The owner fixture verifies responsive light/dark output for scheduled-workout emptiness, populated workouts, filtered emptiness, workout detail and forms, missing-workout states, empty logs, a preselected log form, empty subscriptions, and representative settings pages. A separate seeded athlete verifies the dashboard workout-tracking redirect.

Programming browse remains blocked because the required base seed exposes a public track instead of the audited empty state. Profile settings remains a verified error state. Athlete settings now verifies its route-specific imperial and metric form output after the form-context fix.

Observed repetition supports a children-driven shared empty state and presentation-only settings header or section composition. Workout forms, calendars, scoring, navigation state, authentication, and route controllers remain app-owned.

### Crew organizer evidence

The fourth evidence slice covers the authenticated Crew organizer workflow from event discovery and setup through staffing, confirmations, event-day operations, and exports.

[The Crew organizer coverage audit](../docs/ui-library/crew-organizer-coverage-audit.md) records 24 verified scenarios across 12 visual records. The complete plan now has 166 verified, 26 blocked, and 147 pending scenarios.

Every route verifies desktop and mobile light output from the populated `e2e_competition` fixture with scrubbed accessibility, DOM, console, and network evidence. Thirteen representative screenshots cover the primary list, form, overview, roster, day-of, setup, and export surfaces.

The follow-up responsive slice makes the public Crew header wrap navigation below the brand and account row on narrow screens. The print packet constrains its screen-only outer table while preserving internal schedule scrolling and automatic print layout.

Focused browser coverage verifies Events, New event, and all three print-packet tabs at 390 × 844, including visible header actions, document containment, the nested schedule scroller, and print-only header/chrome behavior.

The route records remain route-specific. Repetition supports presentation-only page headers, metric/status panels, empty states, responsive table containment, and the shared non-RHF field composition; Crew navigation, permissions, scheduling state, print semantics, and route actions remain app-owned.
