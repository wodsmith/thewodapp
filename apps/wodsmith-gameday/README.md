# Wodsmith Gameday — Development Guide

Capacitor-based mobile app for athletes and judges at CrossFit competitions. Provides score submission, heat schedules, live leaderboards, and offline reliability.

> **Architecture context**: See [ADR-0005](../../docs/adr/0005-wodsmith-gameday-mobile-architecture.md) for framework choice rationale and implementation phases.

## Prerequisites

| Tool | Version | Why |
|------|---------|-----|
| Node.js | 22+ | Runtime (matches `wodsmith-start`) |
| pnpm | 9+ | Monorepo package manager |
| Xcode | 15+ | iOS builds (macOS only) |
| Android Studio | Latest | Android builds |
| CocoaPods | Latest | iOS native deps (`sudo gem install cocoapods`) |
| Java JDK | 17+ | Android Gradle builds |

Install project dependencies from the monorepo root:

```bash
pnpm install
```

## Running the App

### Browser (fastest iteration)

```bash
pnpm --filter wodsmith-gameday dev
```

Opens on `http://localhost:3001` (or next available port). The app runs as a SPA — no SSR, matching the Capacitor production build.

Point API calls at your local `wodsmith-start` dev server (`http://localhost:3000`) or a deployed environment. Configure the API base URL in `.env`:

```
VITE_API_BASE=http://localhost:3000
```

### iOS Simulator

```bash
# Build the SPA bundle and sync native project
pnpm --filter wodsmith-gameday build
npx cap sync ios

# Open in Xcode (run from there, or use CLI)
npx cap open ios
# — or —
npx cap run ios
```

**First time?** Xcode may need to download simulator runtimes. Open Xcode → Settings → Platforms → install the latest iOS runtime.

### Android Emulator

```bash
pnpm --filter wodsmith-gameday build
npx cap sync android

npx cap open android
# — or —
npx cap run android
```

**First time?** Android Studio → SDK Manager → install an API 34+ system image. Create an AVD in Device Manager before running.

## Build Scripts

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start Vite dev server in SPA mode (browser) |
| `pnpm build` | Build SPA bundle via Vinxi (output: `dist/`) |
| `npx cap sync` | Copy `dist/` into `ios/` and `android/` native projects + sync plugins |
| `npx cap run ios` | Build & launch on iOS simulator |
| `npx cap run android` | Build & launch on Android emulator |
| `npx cap open ios` | Open Xcode project for manual build/debug |
| `npx cap open android` | Open Android Studio project for manual build/debug |

### Full mobile build cycle

```bash
pnpm --filter wodsmith-gameday build && npx cap sync && npx cap run ios
```

`cap sync` is required after every JS build — it copies the web assets into the native project. Skipping it means the simulator runs stale code.

## API Layer

The mobile app talks to REST endpoints on `wodsmith-start`, not `createServerFn`. These endpoints live at `apps/wodsmith-start/src/routes/api/`.

### Available Endpoints

#### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/token` | None | Exchange email + password for bearer token |
| POST | `/api/auth/token/refresh` | Bearer | Refresh an expiring bearer token |

#### Competitions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/compete/competitions/:slug` | Bearer | Competition details by slug |
| GET | `/api/compete/competitions/:id/heats` | Bearer | Heat schedule grouped by event |
| GET | `/api/compete/competitions/:id/leaderboard` | Bearer | Overall leaderboard (optional `?divisionId=`) |
| GET | `/api/compete/competitions/:id/events/:eventId/leaderboard` | Bearer | Per-event leaderboard |
| GET | `/api/compete/competitions/:id/workouts` | Bearer | Published workouts with movements |

#### Registrations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/compete/registrations/me` | Bearer | Current user's competition registrations |

#### Scores

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/compete/scores/window-status` | None | Submission window open/close status |
| POST | `/api/compete/scores/submit` | Bearer | Athlete score submission |
| POST | `/api/compete/scores/judge` | Bearer | Judge/organizer score entry |

#### Video

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/compete/video/submit` | Bearer | Video submission with optional claimed score |

### Bearer Token Auth

Mobile clients authenticate via bearer tokens instead of cookies (cookies are unreliable in Capacitor WebViews).

**Token format**: `Bearer {userId}:{sessionToken}`

**Login flow**:

1. `POST /api/auth/token` with `{ email, password }` → returns `{ token, expiresAt, userId }`
2. Store the token in `capacitor-secure-storage-plugin` (iOS Keychain / Android Keystore)
3. Attach to all API requests: `Authorization: Bearer {userId}:{sessionToken}`
4. On 401, call `POST /api/auth/token/refresh` to get a new token

Bearer tokens reuse the same KV session infrastructure as cookie-based web auth. The server utility `getSessionFromBearerOrCookie()` in `src/utils/bearer-auth.ts` supports both auth methods, so API routes work for web and mobile clients.

### CORS

All `/api/compete/` routes include CORS headers for Capacitor origins:
- `capacitor://localhost` (iOS)
- `http://localhost` (Android)
- `https://localhost`

CORS is handled by `corsHeaders()` in `src/utils/bearer-auth.ts`.

### Adding a New Endpoint

1. **Create the route file** in `apps/wodsmith-start/src/routes/api/compete/`:

   ```
   # File-based routing — the path IS the URL
   src/routes/api/compete/heats/my-schedule.ts
   → GET /api/compete/heats/my-schedule
   ```

2. **Implement the API handler** using the standard pattern:

   ```typescript
   import { json } from "@tanstack/react-start"
   import { createAPIFileRoute } from "@tanstack/react-start/api"
   import { getSessionFromBearerOrCookie } from "@/utils/bearer-auth"
   import { corsHeaders } from "@/utils/bearer-auth"

   export const APIRoute = createAPIFileRoute("/api/compete/heats/my-schedule")({
     GET: async ({ request }) => {
       // CORS preflight
       const origin = request.headers.get("Origin")
       if (request.method === "OPTIONS") {
         return new Response(null, { status: 204, headers: corsHeaders(origin) })
       }

       // Auth
       const session = await getSessionFromBearerOrCookie(request)
       if (!session) {
         return json({ error: "Unauthorized" }, {
           status: 401,
           headers: corsHeaders(origin),
         })
       }

       // Business logic
       const data = await getMySchedule(session.userId)

       return json(data, { headers: corsHeaders(origin) })
     },
   })
   ```

3. **Add the Effect-TS client function** in the gameday app (see below).

## Effect-TS API Client

The mobile app uses [Effect-TS](https://effect.website) with its Schema module for typed API calls. This gives runtime validation of API responses with full TypeScript inference.

### Pattern

```typescript
import { Effect, Schema } from "effect"

// 1. Define the response schema
const CompetitionSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  startDate: Schema.String,
  endDate: Schema.String,
})

// 2. Create a typed API function
export const getCompetition = (slug: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(`${API_BASE}/api/compete/competitions/${slug}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      }),
    catch: (error) => new ApiError({ error }),
  }).pipe(Effect.flatMap(Schema.decodeUnknown(CompetitionSchema)))

// 3. Run the effect
const result = await Effect.runPromise(getCompetition("spring-throwdown-2026"))
// result is fully typed as { id: string, slug: string, name: string, ... }
```

### Key concepts

- **`Schema.Struct`** defines the expected shape — catches API contract drift at runtime
- **`Effect.tryPromise`** wraps fetch in an Effect with typed error handling
- **`Schema.decodeUnknown`** validates the raw JSON and narrows the type
- **`Effect.runPromise`** executes the effect and returns a Promise (for use in React components)

### Error handling

```typescript
class ApiError {
  readonly _tag = "ApiError"
  constructor(readonly error: unknown) {}
}

class AuthError {
  readonly _tag = "AuthError"
  constructor(readonly status: number) {}
}

// Pipe errors into specific types for match/recovery
export const getCompetition = (slug: string) =>
  Effect.tryPromise({
    try: async () => {
      const r = await fetch(`${API_BASE}/api/compete/competitions/${slug}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (r.status === 401) throw new AuthError({ status: 401 })
      if (!r.ok) throw new ApiError({ error: `HTTP ${r.status}` })
      return r.json()
    },
    catch: (error) => error as ApiError | AuthError,
  }).pipe(Effect.flatMap(Schema.decodeUnknown(CompetitionSchema)))
```

## Offline Testing

The app is designed for competition venues with poor connectivity. Offline behavior has two phases:

### Phase 1: Read-Only Cache (IndexedDB)

Pre-cached data (competitions, events, heats, workouts) is stored in IndexedDB when the user opens the app on WiFi.

**To test read-only offline**:

1. Open the app in Chrome and load a competition page (this populates the cache)
2. Open DevTools → Network → check "Offline"
3. Navigate between cached pages — they should load from IndexedDB
4. Uncached pages should show a graceful "No connection" state

### Phase 2: Submission Queue

Score and video submissions queue locally when offline and drain when connectivity returns.

**To test the submission queue**:

1. Open DevTools → Network → check "Offline"
2. Submit a score — it should be accepted locally with a "queued" indicator
3. Uncheck "Offline" — the queued submission should sync automatically
4. Verify the score appears on the leaderboard

**On a real device** (more realistic):

1. Enable Airplane Mode before submitting scores
2. Verify the local queue indicator shows pending submissions
3. Disable Airplane Mode — watch the queue drain
4. Use `@capacitor/network` listeners to confirm the app detects connectivity changes

### Network simulation in simulators

- **iOS Simulator**: Use Network Link Conditioner (Xcode → Open Developer Tool → More Developer Tools → download "Additional Tools for Xcode")
- **Android Emulator**: Extended Controls → Cellular → set to "No connection" or throttle speeds

## Agent-Browser Smoke Tests

The repo includes agent-browser verification scripts for automated smoke testing.

**Running smoke tests**:

```bash
# From the monorepo root
pnpm --filter wodsmith-gameday test:smoke
```

These tests use Playwright-based browser automation to verify critical paths:

1. **Login flow** — Enter credentials, receive token, land on dashboard
2. **Competition loading** — Navigate to a competition, verify data renders
3. **Score submission** — Fill score form, submit, verify confirmation
4. **Leaderboard** — Check leaderboard displays scores correctly

**Writing new smoke tests**: Add test scripts in the `test/smoke/` directory. Each test should:
- Launch the app in a browser context
- Perform a user flow end-to-end
- Assert on visible outcomes (not implementation details)

## Project Structure

```
apps/wodsmith-gameday/
├── src/
│   ├── routes/              # TanStack Router file-based routes (SPA)
│   │   ├── index.tsx        # Login / competition picker
│   │   ├── competition/     # Competition detail views
│   │   ├── scores/          # Score entry forms
│   │   └── leaderboard/     # Leaderboard views
│   ├── components/          # Mobile-adapted React components
│   ├── lib/
│   │   └── api/             # Effect-TS typed API client
│   │       ├── client.ts    # Base fetch + auth header injection
│   │       ├── competitions.ts
│   │       ├── scores.ts
│   │       └── schemas.ts   # Shared Schema definitions
│   ├── state/               # Zustand stores (auth token, offline queue)
│   └── utils/               # Shared utilities
├── ios/                     # Xcode project (generated by `cap init`)
├── android/                 # Android Studio project (generated by `cap init`)
├── capacitor.config.ts      # Capacitor configuration
├── app.config.ts            # TanStack Start config (SPA mode)
├── package.json
├── tsconfig.json
└── DEVELOPMENT.md           # ← You are here
```

## Common Issues

**`cap sync` fails with "web assets not found"**
→ Run `pnpm build` first. Capacitor copies from `dist/`, which doesn't exist until you build.

**iOS build fails with signing errors**
→ Open Xcode → select the project → Signing & Capabilities → set your development team. For simulator builds, "Automatically manage signing" works fine.

**Android SDK not found**
→ Set `ANDROID_HOME` in your shell profile: `export ANDROID_HOME=~/Library/Android/sdk`

**API calls return CORS errors in browser dev mode**
→ The CORS headers only allow Capacitor origins. For browser dev, either:
- Run `wodsmith-start` locally (same-origin, no CORS needed)
- Or add `http://localhost:3001` to the `allowedOrigins` set in `bearer-auth.ts`

**Bearer token expired / 401 on every request**
→ Check that `POST /api/auth/token/refresh` is being called before the token expires. Tokens share the same 30-day TTL as web sessions via KV.
