---
status: accepted
date: 2026-03-14
decision-makers: [Ian Jones]
consulted: []
informed: []
---

# ADR-0005: Wodsmith Gameday Mobile Architecture

## Context and Problem Statement

WODsmith Compete needs a **gameday mobile app** — a distilled native experience for athletes at CrossFit competitions. Core needs: score submission, heat schedules, live leaderboards, offline reliability at venues with poor connectivity, and video capture for movement standards.

The existing web app is TanStack Start (React 19, TypeScript) on Cloudflare Workers with Drizzle ORM and D1. Any mobile approach must account for a critical constraint: `createServerFn` (the app's ~420 server functions) is incompatible with mobile clients — it posts to `/__server` on the current origin, which doesn't exist outside the web context.

Should we use Capacitor, React Native, native Swift, Flutter, or PWA? And should the app live in the existing monorepo or a separate repository?

## Decision Drivers

- **Speed to market** — A competition season is time-boxed; weeks matter
- **Code reuse** — The existing React + shadcn/ui + Tailwind UI should transfer
- **Team skills** — The team knows React and TypeScript; new languages add risk
- **Offline reliability** — Competition venues have poor or no connectivity
- **Maintenance burden** — Long-term, one codebase is better than two
- **API surface** — ~21 server functions need REST equivalents for any mobile approach

## Considered Options

### Mobile Framework
1. **Capacitor** — WebView wrapper with native plugin bridge
2. **React Native / Expo** — Native UI with React component model
3. **Native Swift** — iOS-first with native UIKit/SwiftUI
4. **Flutter** — Cross-platform with Dart and Skia render engine
5. **PWA** — Service worker + manifest on the existing web app

### Monorepo vs Separate Repo
1. **Monorepo sibling** (`apps/wodsmith-gameday`) — Capacitor app lives alongside `apps/wodsmith-start`
2. **Separate repository** — Independent repo consuming the web app's API

### API Client Layer
1. **Effect-TS typed client** — Functional typed HTTP client with Schema-based validation
2. **Plain fetch** — Untyped fetch calls with manual Zod validation
3. **tRPC client** — Type-safe RPC that would require migrating the web app off `createServerFn`
4. **OpenAPI-generated client** — Generated from spec, requires maintaining OpenAPI definitions

## Decision Outcome

### Framework: Capacitor

Chosen option: **Capacitor**, because it maximizes code reuse from the existing React/TypeScript codebase while delivering a real native app (not a PWA) with sufficient performance for a form-and-list-heavy gameday experience.

### Monorepo: Same Monorepo (User Decision)

The Capacitor app will live as `apps/wodsmith-gameday` in the existing monorepo, despite research recommending a separate repo. This is an explicit user override — the atomic PR workflow and trivial shared package imports outweigh the deployment coupling concerns for the team's current size and velocity.

### API Client: Effect-TS

The mobile app's data layer will use **Effect-TS** with its Schema module for typed API calls to the ~21 REST endpoints exposed from `apps/wodsmith-start/src/routes/api/compete/`.

### Auth: Bearer Tokens

Mobile clients use bearer token auth (`Authorization: Bearer <token>`). Cookie-based auth is broken in Capacitor WebViews (isolated cookie storage, `capacitor://` scheme causes WebKit to refuse cookies). Tokens are stored in `capacitor-secure-storage-plugin` (iOS Keychain / Android Keystore).

### Build: Separate SPA Build for Capacitor

TanStack Start's SPA mode produces a client-only bundle without SSR. Mobile and web share components and styles but have separate build targets — `pnpm build` (web, SSR) and `pnpm build:mobile` (SPA for Capacitor).

### Consequences

- Good, because ~80-90% of UI code (React components, shadcn/ui, Tailwind) transfers directly to the WebView
- Good, because the team needs zero new languages — everything stays in React/TypeScript
- Good, because Capacitor produces a real native binary that ships through App Store and Google Play
- Good, because Effect-TS Schema provides end-to-end type safety from API response to component without tRPC migration overhead
- Good, because monorepo placement allows atomic PRs that update an API route and its mobile consumer simultaneously
- Good, because the ~21 REST endpoints needed for gameday benefit the web app too (third-party integrations, webhooks)
- Bad, because `createServerFn` calls must be replaced with explicit API route calls in mobile context — no shared data-fetching code between web and mobile
- Bad, because monorepo placement means mobile CI (Xcode, Android Studio, CocoaPods) runs alongside web CI — careful pipeline partitioning required
- Bad, because offline sync (submission queuing, pre-cache) requires building a local-first data layer with no existing patterns in the codebase
- Bad, because Effect-TS has a learning curve for developers unfamiliar with functional programming patterns
- Neutral, because cookie → bearer token migration requires a new auth code path, but existing web auth is unchanged

### Confirmation

The architecture will be confirmed successful when:

1. A Capacitor app in `apps/wodsmith-gameday` builds and runs on iOS and Android simulators
2. Bearer token auth flow works end-to-end (`/api/auth/token` → secure storage → API calls)
3. All ~21 gameday REST endpoints are live and consumed by the mobile app
4. Offline: competition data caches before gameday and score submissions queue locally
5. CI pipeline runs mobile and web checks independently (no mobile check blocking web deploys)

## Pros and Cons of the Options

### Option 1: Capacitor (Chosen)

Wrap a TanStack Start SPA build in Capacitor's native WebView container.

- Good, because existing React + shadcn/ui + Tailwind renders directly in WebView — no UI rewrite
- Good, because team stays in React/TypeScript — no Swift, Dart, or new framework
- Good, because the gameday use case (forms, lists, schedules) is squarely in WebView's comfort zone
- Good, because Capacitor 8 is production-mature with large plugin ecosystem (camera, push, SQLite, biometrics, OTA updates via Capgo)
- Good, because OTA updates via Capgo push JS/asset fixes without App Store review
- Bad, because WebView performance ceiling on low-end Android (mitigated: app is not animation-heavy)
- Bad, because `createServerFn` is incompatible — API route layer is required (effort: ~5.5 days, benefits web app too)
- Neutral, because SPA mode in TanStack Start is supported but is a separate build configuration

### Option 2: React Native / Expo

Native UI rendering with React component model, Expo toolchain.

- Good, because native components give the best cross-platform feel
- Good, because TanStack Query, Zod, Zustand, and TypeScript transfer directly
- Good, because EAS Build/Submit handles app store distribution without a Mac
- Bad, because **complete UI rewrite required** — shadcn/ui and Tailwind don't work in React Native
- Bad, because the team must learn React Native specifics, Metro bundler, and native debugging
- Bad, because estimated 300-500 dev hours (vs 120-200 for Capacitor) and $30k-$75k development cost

### Option 3: Native Swift

iOS-first native app, Android later.

- Good, because best-in-class iOS experience with full Apple API access
- Good, because Core Data/SwiftData + SQLite provides excellent offline
- Bad, because **zero code reuse** — entire app written from scratch
- Bad, because iOS-first means Android users wait
- Bad, because estimated 500-800 dev hours and $50k-$160k development cost
- Bad, because the team would need to hire or learn Swift/SwiftUI

### Option 4: Flutter

Cross-platform with Dart and Skia render engine.

- Good, because pixel-perfect cross-platform UI from a single codebase
- Good, because excellent offline via drift/Hive
- Bad, because **zero code reuse** — all logic must be rewritten in Dart
- Bad, because the team needs to learn an entirely new language and ecosystem
- Bad, because estimated 400-700 dev hours and $30k-$105k development cost

### Option 5: PWA

Service worker + manifest on the existing web app.

- Good, because zero new tooling — same deployment, same codebase
- Good, because Android support is excellent (install prompt, reliable offline, Play Store via TWA)
- Bad, because **iOS offline is fragile** — cache eviction after ~7 days of inactivity is a dealbreaker for competition venues
- Bad, because push notifications on iOS require home-screen install (iOS 16.4+) — unreliable for athletes
- Bad, because no App Store distribution on iOS (Apple hostile to PWA)
- Neutral, because PWA can serve as a complementary channel for athletes who won't install the native app

## Architecture Details

### Monorepo Structure

```
apps/
├── wodsmith-start/           # Existing web app (TanStack Start, SSR)
│   └── src/routes/api/compete/  # New REST endpoints for mobile
└── wodsmith-gameday/         # New Capacitor app (TanStack Start, SPA mode)
    ├── src/
    │   ├── routes/           # Mobile-specific routes (login, competition, score entry)
    │   ├── components/       # Mobile-adapted components (shared or extended from start)
    │   └── lib/
    │       └── api/          # Effect-TS typed API client
    ├── ios/                  # Xcode project (generated by cap init)
    ├── android/              # Android Studio project (generated by cap init)
    └── capacitor.config.ts
packages/
└── ui/                       # Shared shadcn/ui components (if extracted)
```

### API Layer (~21 Endpoints)

REST endpoints added to `apps/wodsmith-start/src/routes/api/compete/`:

| Endpoint | Source Server Function |
|----------|----------------------|
| `GET /api/compete/competitions/:slug` | `getCompetitionBySlugFn` |
| `GET /api/compete/competitions/:id/heats` | `getHeatsForCompetitionFn` |
| `GET /api/compete/competitions/:id/venues` | `getCompetitionVenuesFn` |
| `GET /api/compete/competitions/:id/leaderboard` | `getCompetitionLeaderboardFn` |
| `GET /api/compete/competitions/:id/events/:eventId/leaderboard` | `getEventLeaderboardFn` |
| `GET /api/compete/competitions/:id/workouts` | `getPublishedCompetitionWorkoutsFn` |
| `GET /api/compete/events/:eventId` | `getPublicEventDetailsFn` |
| `GET /api/compete/registrations/me` | `getUserCompetitionRegistrationFn` |
| `GET /api/compete/registrations/upcoming` | `getUpcomingCompetitionsForUserFn` |
| `GET /api/compete/scores/:eventId` | `getAthleteEventScoreFn` |
| `GET /api/compete/scores/:eventId/window` | `getSubmissionWindowStatusFn` |
| `GET /api/compete/scores/:eventId/details` | `getEventWorkoutDetailsFn` |
| `GET /api/compete/scores/entry-data` | `getEventScoreEntryDataWithHeatsFn` |
| `GET /api/compete/scores/can-input` | `canInputScoresFn` |
| `POST /api/compete/scores/submit` | `submitAthleteScoreFn` |
| `POST /api/compete/scores/judge` | `saveEventScoreFn` |
| `GET /api/compete/video/:eventId` | `getVideoSubmissionFn` |
| `GET /api/compete/video/batch-status` | `getBatchSubmissionStatusFn` |
| `POST /api/compete/video/submit` | `submitVideoFn` |
| `GET /api/compete/heats/publish-status` | `getHeatSchedulePublishStatusFn` |
| `POST /api/auth/token` | (new) Exchange credentials for bearer token |

### Effect-TS API Client Pattern

```typescript
// apps/wodsmith-gameday/src/lib/api/client.ts
import { Effect, Schema } from 'effect'

const CompetitionSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  // ...
})

export const getCompetition = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(`${API_BASE}/api/compete/competitions/${slug}`, {
        headers: {Authorization: `Bearer ${getToken()}`},
      }).then((r) => r.json()),
    catch: (error) => new ApiError({error}),
  }).pipe(Effect.flatMap(Schema.decodeUnknown(CompetitionSchema)))
```

### Build Scripts

```jsonc
// apps/wodsmith-gameday/package.json
{
  "scripts": {
    "build": "vinxi build",           // SPA mode (for Capacitor)
    "build:ios": "cap sync ios && cap open ios",
    "build:android": "cap sync android && cap open android",
    "dev": "vinxi dev"                // Browser dev with mock API
  }
}
```

### Authentication Flow

1. Mobile app calls `POST /api/auth/token` with email + password
2. Server issues a short-lived access token + long-lived refresh token (stored in KV)
3. Mobile stores refresh token in `capacitor-secure-storage-plugin` (iOS Keychain / Android Keystore)
4. Access token stored in memory (lost on app restart → silently refresh from secure storage)
5. API routes read `Authorization: Bearer <token>` header; same KV session validation as cookies

### Offline Strategy

Phase 1 (launch): Read-only offline cache via IndexedDB. Pre-cache competition data, events, and heats when athlete opens the app on WiFi.

Phase 2 (post-launch): Write queue for score and video submissions. Use `@capacitor/network` to detect connectivity and drain the queue when online returns.

## Implementation Phases

### Phase 1: API Layer + Auth (5.5 days, in wodsmith-start)

- Add bearer token auth path to session validation
- Create `POST /api/auth/token` and `POST /api/auth/token/refresh`
- Implement all ~21 REST endpoints in `src/routes/api/compete/`
- Configure CORS for Capacitor origins (`capacitor://localhost`, `http://localhost`)

### Phase 2: Capacitor Shell (3 days)

- Initialize `apps/wodsmith-gameday` with TanStack Start SPA config
- Add Capacitor, configure iOS and Android projects
- Implement Effect-TS API client
- Wire login flow with bearer token storage

### Phase 3: Core Gameday Features (5 days)

- Competition overview + event/workout details
- Heat schedule view (offline-first with IndexedDB)
- Score submission form
- Leaderboard views

### Phase 4: Native Features (3 days)

- Push notifications for submission window open/close
- Direct video capture via `@capacitor/camera` (replacing YouTube URL paste)
- QR code check-in via `@capacitor-mlkit/barcode-scanning`

### Phase 5: Offline Robustness (3 days)

- Write queue for score/video submissions
- Background sync via `@capacitor/background-runner`
- Conflict resolution for duplicate submissions

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `createServerFn` incompatibility | Certain | High | Required: build API route layer (Phase 1) |
| Cookie auth broken in WebView | Certain | High | Required: bearer token auth (Phase 1) |
| Monorepo CI coupling | Medium | Medium | Partition pipelines: mobile checks only run on `apps/wodsmith-gameday/**` changes |
| Offline sync complexity | Medium | Medium | Ship read-only cache first; write queue is Phase 5 |
| Android WebView on low-end devices | Low | Medium | App is form-heavy — test on mid-range Android early |
| Effect-TS learning curve | Medium | Low | Scope Effect-TS to API client only; rest of app uses familiar React patterns |
| App Store rejection | Low | High | Capacitor apps are standard native binaries — no unusual patterns |

## More Information

### Related Documents

- [Mobile Gameday Research](../mobile-gameday-research.md) — Full evaluation matrix, cost breakdown, and architecture analysis
- [Mobile Research](../mobile-research.md) — Tauri 2.0 and Capacitor deep dives
- [ADR-0001: Migrate to TanStack Start](./0001-migrate-to-tanstack-start.md) — Web app foundation this decision builds on

### External Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [TanStack Start SPA Mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [Effect-TS Schema](https://effect.website/docs/schema/introduction)
- [Capgo OTA Updates](https://capgo.app)
- [TanStack Start + Capacitor Template](https://github.com/aaronksaunders/tanstack-capacitor-mobile-1)

### Decision Timeline

- **2026-03-12**: Mobile research completed (Capacitor and Tauri deep dives)
- **2026-03-13**: Gameday approach evaluation completed (framework + API layer analysis)
- **2026-03-14**: ADR drafted and accepted
- **TBD**: Phase 1 (API layer + auth) begins
