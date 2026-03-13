# Mobile Gameday App: Approach Evaluation

> Decision report for wodsmith-compete gameday mobile app. Updated 2026-03-13.

## Context

WODsmith Compete is a competition management platform for CrossFit and functional fitness events. We want to build a **gameday app** — a distilled mobile experience for athletes at competitions. Core needs:

- **Score submission** — athletes enter their own scores or judges submit on their behalf
- **Heat schedules** — athletes see when and where they compete next
- **Leaderboards** — live standings throughout the day
- **Offline reliability** — venues often have poor or no connectivity
- **Video capture** — record and submit movement standard videos

Our backend uses a **PlanetScale MySQL database**. We are **not locked into Cloudflare** — mobile clients can connect to any backend via API. The existing web app is built with TanStack Start (React 19, TypeScript) and uses Drizzle ORM.

---

## Options Overview

### Native Swift (iOS-First)

Build a native iOS app in Swift/SwiftUI, adding Android later (Kotlin or cross-platform). This produces the highest-quality iOS experience with full access to every Apple API. Offline support is straightforward with Core Data or SwiftData backed by SQLite. The tradeoff is zero code reuse with the existing React/TypeScript codebase — the entire app is written from scratch. Going iOS-first means Android users wait, and maintaining two native codebases long-term requires platform-specific expertise.

### React Native / Expo

Build a cross-platform app using React and native UI components, managed through Expo's toolchain. The team's React and TypeScript skills transfer directly, and ~40-60% of non-UI code (schemas, stores, utilities, API clients) can be shared via a monorepo. The UI must be rewritten entirely since web components (shadcn/ui, Tailwind) don't work in React Native. Expo provides cloud builds, OTA updates, and a rich SDK for camera, push, biometric auth, and offline storage. This is the most mature cross-platform React option.

### Capacitor (Wrap Existing Web App)

Wrap the existing web app in a native shell (WKWebView on iOS, Android WebView) with plugin bridges to native APIs. This offers the highest code reuse — existing React + shadcn/ui + Tailwind renders directly in the WebView with no UI rewrite. Native features (camera, push, SQLite, biometrics) are accessed through a mature plugin ecosystem. The tradeoff is a WebView performance ceiling, though for a form-heavy, list-based app this is rarely a problem. OTA updates via Capgo let you push fixes without app store review.

### PWA (Progressive Web App)

Enhance the existing web app with a service worker for offline caching, a manifest for home screen install, and Web Push for notifications. Athletes access the app via URL — no download required. Android support is excellent (install prompt, reliable offline, Play Store distribution via TWA). iOS is workable but fragile: cache eviction after ~7 days of inactivity, push only works for home-screen-installed PWAs, and no background sync. Best suited as a complementary channel rather than the sole solution.

### Flutter

Build a cross-platform app with Dart and Flutter's own rendering engine (Skia/Impeller). Flutter produces genuinely native-feeling UI on both platforms from a single codebase, with strong offline support via drift (SQLite) or Hive. The rendering engine means pixel-perfect control and smooth animations. The tradeoff is zero code reuse with the existing TypeScript codebase — all logic must be rewritten in Dart. The team would need to learn Dart, and the Flutter ecosystem, while large, is less React-familiar than Expo.

---

## Comparison Matrix

| Dimension | Native Swift | React Native / Expo | Capacitor | PWA | Flutter |
|-----------|-------------|--------------------| ----------|-----|---------|
| **Time to first working prototype** | Slow (full rewrite) | Medium (UI rewrite, shared logic) | Fast (wrap existing app) | Fastest (enhance existing) | Slow (full rewrite in Dart) |
| **Offline reliability at venues** | Excellent (Core Data/SQLite) | Excellent (expo-sqlite, Legend State) | Good (SQLite plugin, IndexedDB) | Fragile on iOS (cache eviction) | Excellent (drift/SQLite, Hive) |
| **Native feel / performance** | Best | Very good (native components) | Adequate for forms/lists (WebView) | Web-level | Very good (own render engine) |
| **Code reuse with React/TS codebase** | None | Moderate (~40-60% non-UI) | Very high (~80-90%) | Full (~90%+) | None |
| **App Store distribution** | Native (easiest approval) | Yes (EAS Build/Submit) | Yes (native binary) | Android TWA only; iOS hostile | Yes (native binary) |
| **Team skillset required** | Swift/SwiftUI (new) | React (familiar) + RN specifics | Web only (existing) | Web only (existing) | Dart (new) |
| **Long-term maintenance burden** | High (separate codebase per platform) | Medium (one codebase, RN upgrade cycles) | Low (one codebase, web skills) | Lowest (same app) | Medium (one codebase, Dart ecosystem) |
| **Database connectivity** | Direct MySQL via API or SDK | API calls to PlanetScale | API calls to PlanetScale | API calls to PlanetScale | Direct MySQL via API or SDK |

---

## Recommendation

**Capacitor** as the primary approach, with **React Native/Expo** as the upgrade path if native performance becomes necessary.

**Why Capacitor wins for gameday:**

1. **Speed to market.** The existing React + shadcn/ui + Tailwind app renders directly in the WebView. No UI rewrite. The main engineering work is building an API layer (needed by any mobile approach) and integrating native plugins for camera, push, and offline storage.

2. **Right tool for the job.** A gameday app is forms, lists, schedules, and leaderboards — exactly the kind of content where WebView performance is indistinguishable from native. This isn't a graphics-intensive game or a gesture-heavy social app.

3. **Team leverage.** The team knows React and TypeScript. Capacitor keeps everything in that world. No new language to learn, no new component library to master, no new build system to debug.

4. **Risk management.** If Capacitor proves insufficient (unlikely for this use case), the API layer and backend work transfer directly to a React Native or Swift rewrite. Nothing is wasted.

**Why not Swift or Flutter?** Both produce superior native experiences, but the gameday app doesn't need that. The months spent rewriting in a new language/framework would be better spent shipping features athletes actually want. Neither reuses any existing code.

**Why not PWA alone?** iOS offline fragility is a dealbreaker for a competition app where connectivity is unreliable. PWA makes a good complementary channel for athletes who won't download an app, but it can't be the primary offline solution.

**Why not React Native now?** It's the right choice if the app grows beyond gameday into a daily gym tool with rich interactions, complex animations, or heavy native integrations. For the initial gameday scope, the complete UI rewrite isn't justified.

---

## Architecture: Separate App vs Monorepo

The gameday mobile app should live **outside** wodsmith-start. The core question is whether it belongs in the same monorepo (as a sibling app) or in a completely separate repository. Both approaches keep wodsmith-start clean — the difference is how shared code is consumed.

### Option 1: Separate Repository (Recommended)

The Capacitor app lives in its own repo (e.g., `wodsmith-gameday`) and consumes wodsmith-start's backend via REST API routes. Shared types are published as a package or pulled via git submodule.

**Pros:**

- **Total separation of concerns.** wodsmith-start's dependency tree, build config, CI pipeline, and deploy process are completely untouched. Mobile concerns (Capacitor plugins, native build tooling, Xcode/Android Studio configs) never enter the web app's world.
- **Independent deployment cadence.** The gameday app ships on its own schedule — app store submissions, OTA updates via Capgo, and native build cycles have zero coupling to wodsmith-start deploys.
- **Clean ownership boundary.** Different contributors, different review standards, different test strategies. A web deploy can't accidentally break the mobile build and vice versa.
- **Smaller CI.** Each repo runs only its own checks. No "run mobile tests on every web PR" overhead.

**Cons:**

- **Shared types require explicit sync.** Zod schemas, API response types, and domain constants must be published (npm package, git submodule, or copy-paste). Drift is possible if not automated.
- **Two repos to manage.** PRs, issues, and releases live in separate places.

**How shared types work across repos:**

1. **Published package (best).** Extract shared schemas/types into `@wodsmith/shared` published to npm (or a private registry). Both repos depend on it. Version pinning prevents drift.
2. **Git submodule.** A `shared/` submodule in both repos pointing to a common source. More friction but no registry needed.
3. **API-first contract.** The mobile app treats the API as the contract. Generate TypeScript types from OpenAPI specs or a shared schema package. The mobile app never imports from wodsmith-start directly.

### Option 2: Monorepo Sibling App

The Capacitor app lives in the same monorepo as wodsmith-start (e.g., `apps/wodsmith-gameday`) with shared code in `packages/`.

**Pros:**

- **Atomic changes.** A single PR can update an API route, its types, and the mobile consumer simultaneously. No version coordination needed.
- **Trivial code sharing.** Import from `@wodsmith/schemas` or `@wodsmith/utils` — standard monorepo workspace references, always at head.
- **Single CI.** One pipeline validates everything. Type errors across boundaries are caught immediately.

**Cons:**

- **Muddies wodsmith-start's concerns.** Even though the mobile app is a separate directory, the monorepo's root config (pnpm-workspace, turbo/nx pipeline, CI matrix) must account for Capacitor, native builds, Xcode, Android SDK, etc. This is exactly the kind of cross-contamination the user wants to avoid.
- **Coupled deploys.** CI runs against the whole workspace — a mobile change can block a web deploy if the pipeline isn't carefully partitioned.
- **Heavier root.** Native build dependencies (CocoaPods, Gradle) pollute the dev environment for web-only contributors.

### Recommendation: Separate Repository + Shared Package

**Start with a separate repo.** This enforces the cleanest boundary and ensures wodsmith-start stays entirely focused on the web platform.

The key enabler is an **API-first architecture**:

1. **Build REST API routes in wodsmith-start** (`src/routes/api/`). These already exist for some features and are the natural extension point. This work benefits the web app too (third-party integrations, webhooks, future clients).

2. **Extract shared types into `@wodsmith/shared`** — a small package containing Zod schemas, TypeScript interfaces, and domain constants. Publish to npm (private scope) or use a GitHub Packages registry. Both repos pin to the same version.

3. **The gameday app is a standalone Capacitor project** that:
   - Builds as a pure SPA (no SSR, no server functions)
   - Calls wodsmith-start API routes for all data
   - Uses bearer token auth (not cookies)
   - Has its own CI/CD for native builds and app store submission
   - Ships OTA updates via Capgo independently

This approach means:
- **wodsmith-start never knows the mobile app exists.** No Capacitor config, no native dependencies, no mobile-specific build steps.
- **The gameday app can ship daily** without touching wodsmith-start's deploy pipeline.
- **If the team later decides to move into the monorepo**, the migration is straightforward — move the directory, update imports to workspace references, remove the published package. The reverse is much harder.

### When to Reconsider

Move to a monorepo sibling if:
- Shared code changes are happening multiple times per week and version coordination becomes painful
- The team grows and wants atomic cross-project PRs as the default workflow
- A shared package registry feels like unnecessary infrastructure

But for a v1 gameday app with a small team, the separate repo keeps complexity where it belongs — in the mobile project, not in wodsmith-start.

---

## Appendix A: Capacitor Deep Dive

### How It Works

Capacitor creates a native iOS/Android project that embeds a WebView loading your bundled web assets. A plugin bridge connects JavaScript to native APIs. The web app runs locally (no server needed at runtime), with API calls to your backend for data.

### Integration with Existing Stack

- TanStack Start supports **SPA build mode** for Capacitor — builds a client-only bundle without SSR
- `createServerFn` does NOT work from a mobile app (posts to `/__server` on the current origin, which doesn't exist). All mobile data access goes through **REST API routes** in `src/routes/api/`
- Cookie-based auth is broken in WebViews — use **bearer tokens** stored via Capacitor Preferences or Secure Storage plugin
- CORS must be configured for Capacitor origins (`capacitor://localhost`, `http://localhost`)

### Offline Strategy

- App shell is always offline — web assets are bundled in the native binary
- Use **@capacitor-community/sqlite** for structured offline data (schedules, athlete lists, scores)
- Pre-cache competition data when athlete opens the app (on WiFi before venue)
- Queue score submissions locally, sync when connectivity returns
- `@capacitor/background-runner` for opportunistic background sync

### Native Features via Plugins

| Feature | Plugin | Status |
|---------|--------|--------|
| Camera / video | @capacitor/camera | Stable |
| Push notifications | @capacitor/push-notifications | Stable (FCM/APNs) |
| Barcode/QR scanning | @capacitor-mlkit/barcode-scanning | Stable |
| Biometric auth | @aparajita/capacitor-biometric-auth | Stable |
| SQLite offline DB | @capacitor-community/sqlite | Stable |
| OTA updates | @capgo/capacitor-updater | Stable |
| Background tasks | @capacitor/background-runner | Stable |
| Network detection | @capacitor/network | Stable |

### Build & Distribution

- `npx cap sync` copies web assets and syncs plugins
- Build via Xcode (iOS) and Android Studio (Android) — standard native toolchains
- Appflow (Ionic's CI/CD) or GitHub Actions for automated builds
- OTA updates via Capgo push JS/asset changes without app store review

### Key Risks

- WebView performance on low-end Android devices (mitigated: app is form-heavy)
- Bearer token auth migration required (effort: ~1-2 days)
- API route layer required (effort: ~3-5 days, benefits web app too)

---

## Appendix B: React Native / Expo Deep Dive

### How It Works

React Native renders native UI components (not WebView) using React as the component model. Expo provides a managed workflow with cloud builds (EAS), OTA updates, and a curated SDK of native modules. The Hermes JavaScript engine runs the app logic.

### Code Sharing in a Monorepo

| What | Shares? | Notes |
|------|---------|-------|
| Zod schemas | Yes | Platform-agnostic validation |
| Zustand stores | Yes | Works identically in RN |
| TanStack Query | Yes | Data fetching layer |
| API client / types | Yes | Fetch calls, response types |
| Utility functions | Yes | Any pure TypeScript |
| shadcn/ui components | **No** | DOM-based, need RN equivalent |
| Tailwind CSS | **No** | NativeWind is a partial substitute |
| TanStack Router | **No** | Expo Router for native navigation |

Monorepo structure: shared packages in `packages/` (schemas, utils, api-client, stores), mobile app in `apps/wodsmith-mobile`.

### Offline Strategy

- **expo-sqlite + Legend State** — reactive state that persists to SQLite, syncs via custom plugin to API
- **WatermelonDB** — purpose-built for complex offline-first apps, pull-based delta sync
- Both approaches use local SQLite as source of truth, sync to PlanetScale MySQL via API

### Build & Distribution

- EAS Build: cloud builds for iOS/Android (no Mac required). 30 free builds/month
- EAS Submit: automated App Store Connect / Google Play submission
- EAS Update: OTA JS-only updates without app store review
- Target SDK 53+ with New Architecture from day one

### Key Risks

- Complete UI rewrite required (~40-60% total code reuse)
- Higher learning curve for team (RN specifics, Metro bundler, native debugging)
- Push notifications require dev builds (no Expo Go) on SDK 53+

---

## Appendix C: PWA Deep Dive

### How It Works

A PWA adds a service worker (for offline caching and background tasks), a web manifest (for home screen install), and Web Push API (for notifications) to the existing web app. No native binary — the browser IS the runtime.

### Offline Strategy

| Strategy | Use For |
|----------|---------|
| Cache-First | App shell, CSS/JS, fonts, logos |
| Network-First | Live scores, leaderboards |
| Stale-While-Revalidate | Athlete profiles, workout descriptions, event info |

- Pre-cache all event data on first open
- On iOS, re-cache critical assets on every launch (cache may be evicted after ~7 days)
- Use Workbox for service worker caching strategies

### TanStack Start Compatibility

TanStack Start has no first-party PWA support. `vite-plugin-pwa` is broken in production builds due to SSR detection. The workaround is a **post-build script** using Workbox's `injectManifest()` to generate the service worker — proven but not first-party.

### Platform Support

| Capability | Android | iOS |
|-----------|---------|-----|
| Offline caching | Excellent | Fragile (eviction after ~7 days) |
| Push notifications | Full | Home Screen PWA only (iOS 16.4+) |
| Install prompt | Native `beforeinstallprompt` | Manual "Add to Home Screen" |
| Camera/video | Full | Full (MediaRecorder supported) |
| App Store | Google Play via TWA | Not viable (Apple hostile) |
| Background sync | Supported | Not supported |

### Best Role for Gameday

PWA works best as a **complementary channel**: athletes who won't install an app can access schedules and leaderboards via browser. It should not be the primary offline solution for score submission at venues with poor connectivity — iOS limitations make it too unreliable for that critical path.

---

## Appendix D: API Layer Extraction Deep Dive

### Current State

The wodsmith-start web app uses **~420 `createServerFn` calls** for all server-side logic. These functions use TanStack Start's RPC mechanism — the client POSTs to `/__server` on the same origin, and the framework routes to the correct handler. This mechanism is fundamentally incompatible with mobile clients because:

1. **Origin-bound** — `createServerFn` posts to the current page origin. A Capacitor app, React Native app, or any external client has no `/__server` endpoint.
2. **Cookie-based auth** — server functions read session cookies set by the web app. Mobile WebViews and native apps can't reliably share these cookies.
3. **No OpenAPI/schema** — server functions have no discoverable API contract. Mobile clients need explicit endpoints.

The codebase has **7 existing API routes** in `src/routes/api/` (session, upload, Stripe webhooks, workout search, cron, Stripe Connect callback, OG data). These are standard HTTP handlers — the pattern for mobile-consumable endpoints already exists.

### Gameday-Critical Server Functions

Not all 420 server functions need API equivalents. The gameday mobile app needs a focused subset. Here's the inventory, organized by mobile feature:

#### Score Submission (athlete self-entry + judge entry)
| Function | File | Role |
|----------|------|------|
| `submitAthleteScoreFn` | athlete-score-fns.ts | Athlete submits own score |
| `getSubmissionWindowStatusFn` | athlete-score-fns.ts | Check if window is open |
| `getAthleteEventScoreFn` | athlete-score-fns.ts | Get athlete's existing score |
| `getEventWorkoutDetailsFn` | athlete-score-fns.ts | Workout details for score UI |
| `saveEventScoreFn` | competition-score-fns.ts | Judge/organizer enters score |
| `getEventScoreEntryDataWithHeatsFn` | competition-score-fns.ts | Score entry data grouped by heat |
| `canInputScoresFn` | competition-score-fns.ts | Check score input permission |

#### Heat Schedules
| Function | File | Role |
|----------|------|------|
| `getHeatsForCompetitionFn` | competition-heats-fns.ts | All heats with assignments |
| `getCompetitionVenuesFn` | competition-heats-fns.ts | Venue list (locations) |
| `getHeatSchedulePublishStatusFn` | competition-heats-fns.ts | Which schedules are published |

#### Leaderboards
| Function | File | Role |
|----------|------|------|
| `getCompetitionLeaderboardFn` | leaderboard-fns.ts | Overall standings |
| `getEventLeaderboardFn` | leaderboard-fns.ts | Per-event standings |

#### Registration Lookup
| Function | File | Role |
|----------|------|------|
| `getUserCompetitionRegistrationFn` | registration-fns.ts | User's registration details |
| `getUpcomingCompetitionsForUserFn` | registration-fns.ts | User's upcoming competitions |
| `getCompetitionBySlugFn` | competition-fns.ts | Competition details |

#### Video Submission
| Function | File | Role |
|----------|------|------|
| `submitVideoFn` | video-submission-fns.ts | Submit video + claimed score |
| `getVideoSubmissionFn` | video-submission-fns.ts | Get existing submission |
| `getBatchSubmissionStatusFn` | video-submission-fns.ts | Batch check submission status |

#### Competition Context
| Function | File | Role |
|----------|------|------|
| `getPublishedCompetitionWorkoutsFn` | competition-workouts-fns.ts | Published workout list |
| `getPublicEventDetailsFn` | competition-workouts-fns.ts | Event details for athletes |

**Total: ~21 server functions need API equivalents for gameday.** This is ~5% of the total codebase surface — a manageable extraction.

### Option 1: REST API Routes in TanStack Start

Add REST endpoints in `src/routes/api/compete/` alongside the existing 7 API routes. The server functions' internal logic (database queries, auth checks, business rules) is extracted into shared service modules that both `createServerFn` and API routes call.

**Architecture:**
```
src/
├── server/compete/           # Shared business logic (new)
│   ├── scores.ts
│   ├── heats.ts
│   ├── leaderboards.ts
│   └── registrations.ts
├── server-fns/               # Existing (calls server/compete/)
│   └── athlete-score-fns.ts
├── routes/api/compete/       # New REST endpoints (calls server/compete/)
│   ├── scores.ts             # POST /api/compete/scores
│   ├── heats.ts              # GET /api/compete/heats
│   └── leaderboards.ts       # GET /api/compete/leaderboards
```

**Auth:** Bearer token (JWT or opaque token stored in KV). Mobile sends `Authorization: Bearer <token>` header. A new `/api/auth/token` endpoint exchanges credentials for a token. Existing session logic in `kv-session.ts` adapts to support both cookie-based (web) and token-based (mobile) auth.

**Effort:** ~3-5 days

**Pros:**
- Same deployment, same codebase, same Cloudflare Worker
- Existing business logic reused directly — no serialization boundary
- D1 database access works identically (same Worker binding)
- Incremental — add endpoints as needed, no big-bang migration
- The existing `src/routes/api/` pattern is proven (7 routes already work)
- CORS configuration is straightforward (add Capacitor origins)

**Cons:**
- API routes share the Worker's CPU/memory limits with the web app
- No independent scaling — a spike in mobile API traffic affects web users
- Routing and middleware are TanStack Start's, not a purpose-built API framework
- Risk of the API growing organically without structure

### Option 2: Separate Hono API on Cloudflare Workers

Deploy a standalone Hono (or ElysiaJS) API as its own Cloudflare Worker, connecting to the same D1 database. The API has its own codebase (or monorepo package) with explicit contracts.

**Architecture:**
```
apps/
├── wodsmith-start/           # Web app (existing)
├── wodsmith-api/             # New Hono API Worker
│   ├── src/
│   │   ├── routes/
│   │   │   ├── scores.ts
│   │   │   ├── heats.ts
│   │   │   └── leaderboards.ts
│   │   ├── middleware/
│   │   │   └── auth.ts
│   │   └── db/               # Drizzle schema (shared via package)
│   └── wrangler.jsonc
packages/
├── db-schema/                # Shared Drizzle schema
└── shared-types/             # Shared TypeScript types
```

**Auth:** Same bearer token approach. Auth middleware in Hono validates tokens against the same KV namespace (shared D1 or KV binding between Workers).

**Effort:** ~5-8 days

**Pros:**
- Clean separation — API has its own deployment, scaling, and error budget
- Hono is purpose-built for Cloudflare Workers APIs (middleware, OpenAPI generation, Zod validation)
- Independent deployments — ship API fixes without redeploying the web app
- Natural fit for OpenAPI spec generation (Hono has first-party `@hono/zod-openapi`)
- Can scale independently from web traffic

**Cons:**
- Duplicate Drizzle schema/connection setup (mitigated by shared package)
- Business logic must be extracted to shared packages or duplicated
- Two Cloudflare Workers to manage (billing, monitoring, deployment)
- D1 binding requires both Workers on the same Cloudflare account
- More upfront setup for the monorepo package structure

### Option 3: tRPC Server

Add a tRPC server that both the web app and mobile clients consume. The existing `createServerFn` calls migrate to tRPC procedures, giving type-safe contracts across all clients.

**Architecture:**
```
packages/
├── trpc-router/              # Shared tRPC router
│   ├── src/
│   │   ├── routers/
│   │   │   ├── scores.ts
│   │   │   ├── heats.ts
│   │   │   └── leaderboards.ts
│   │   └── context.ts
apps/
├── wodsmith-start/           # Web app (tRPC client)
├── wodsmith-mobile/          # Mobile app (tRPC client)
```

**Auth:** tRPC context receives the auth token (from cookie or bearer header) and resolves the session. Both web and mobile use the same context creation.

**Effort:** ~8-12 days (includes migrating web app away from createServerFn)

**Pros:**
- End-to-end type safety between server and all clients
- Single source of truth for API contracts
- Both web and mobile call the same procedures
- Built-in batching, subscriptions (WebSocket) for live leaderboards
- Strong ecosystem (TanStack Query integration is first-party)

**Cons:**
- Largest migration effort — web app must also switch from createServerFn to tRPC
- tRPC is not RESTful — third-party integrations or webhooks still need REST routes
- Tight coupling between server and TypeScript clients (non-TS clients need an adapter)
- Additional complexity in the monorepo (tRPC router package, shared context)
- Risk of over-engineering for ~21 gameday endpoints

### Option 4: Direct Database Connection from Mobile

Mobile clients connect directly to the database, bypassing the API layer entirely.

**Architecture:** Mobile app → PlanetScale MySQL (or D1 via API) → reads/writes directly.

**Effort:** N/A — not viable.

**Why this doesn't work:**
- **D1 has no external connection protocol.** Cloudflare D1 is only accessible from Workers via bindings. There is no MySQL-compatible wire protocol, no connection string, no external SDK. Mobile cannot connect.
- **Security.** Even with PlanetScale MySQL (which does support external connections), embedding database credentials in a mobile app is a critical security vulnerability. Credentials can be extracted from the binary.
- **Business logic bypass.** Score validation, permission checks, submission window enforcement, and other rules live in the server layer. Direct DB access skips all of this.
- **Connection pooling.** Mobile apps create unpredictable connection storms. PlanetScale connection limits would be exhausted at a 500-person competition with everyone checking leaderboards.

**Verdict: Not viable. Do not pursue.**

### Recommendation: Option 1 (REST API Routes in TanStack Start)

**Start with REST routes in the existing app. Evolve to a separate Hono API if scaling demands it.**

**Why Option 1 wins:**

1. **Smallest delta.** The pattern already exists (7 API routes). Adding ~10 more endpoints for gameday is incremental. No new deployment infrastructure, no new package dependencies, no migration of existing web code.

2. **Shared business logic without extraction.** Server functions and API routes run in the same Worker process. They can call the same internal functions directly — no need to extract logic to a shared package. As the codebase matures, logic naturally consolidates into `src/server/` modules.

3. **Auth is straightforward.** Add a `/api/auth/token` endpoint that issues bearer tokens. Add middleware to API routes that validates `Authorization` headers against the same KV session store. Web auth continues unchanged.

4. **Timeline alignment.** Capacitor (the recommended mobile approach) needs API routes regardless. Building them in the existing app is the fastest path to a working mobile prototype.

5. **Clean upgrade path.** If mobile API traffic outgrows the shared Worker, the API routes can be extracted to a standalone Hono Worker with minimal refactoring — the route handlers and auth middleware are already HTTP-native.

**Why not tRPC?** The gameday scope is ~21 endpoints. tRPC's value (end-to-end type safety) is most compelling when you have hundreds of procedures and multiple clients evolving together. For 21 focused endpoints, the migration cost outweighs the benefit. If the mobile app grows significantly beyond gameday, tRPC becomes worth revisiting.

**Why not Hono now?** Hono is the right answer if mobile traffic needs independent scaling or if the API surface grows to 50+ endpoints. For initial gameday, the deployment complexity isn't justified.

### Implementation Plan

**Phase 1: Auth (1 day)**
- Add bearer token support to the auth layer
- Create `POST /api/auth/token` (email/password → token)
- Create `POST /api/auth/token/refresh` (refresh flow)
- Add auth middleware for API routes that validates bearer tokens

**Phase 2: Read-only endpoints (2 days)**
- `GET /api/compete/competitions/:slug` — competition details
- `GET /api/compete/competitions/:id/heats` — heat schedules
- `GET /api/compete/competitions/:id/leaderboard` — overall leaderboard
- `GET /api/compete/competitions/:id/events/:eventId/leaderboard` — event leaderboard
- `GET /api/compete/competitions/:id/workouts` — published workouts
- `GET /api/compete/registrations/me` — user's registrations

**Phase 3: Write endpoints (2 days)**
- `POST /api/compete/scores/submit` — athlete score submission
- `POST /api/compete/scores/judge` — judge/organizer score entry
- `POST /api/compete/video/submit` — video submission
- `GET /api/compete/scores/window-status` — submission window check

**Phase 4: CORS & mobile testing (0.5 days)**
- Configure CORS for Capacitor origins
- Test full flow from Capacitor app to API routes

**Total: ~5.5 days** — aligns with the Capacitor deep dive estimate of "3-5 days for API route layer."

---

## Sources

- Capacitor Documentation: capacitorjs.com/docs
- Expo Documentation: docs.expo.dev
- Apple SwiftUI: developer.apple.com/xcode/swiftui
- Flutter: flutter.dev
- Workbox: developer.chrome.com/docs/workbox
- TanStack Start SPA Mode: tanstack.com/start/latest/docs/framework/react/guide/spa-mode
