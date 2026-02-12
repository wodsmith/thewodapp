# iOS Game Day App: Capacitor Approach

> Research document exploring how to build an iOS game day app by wrapping the existing TanStack Start web app with Capacitor.

## Executive Summary

Capacitor wraps your existing React/Tailwind/TanStack Start web app in a native iOS shell, giving you App Store distribution, push notifications, and offline capability while reusing ~90% of your existing code. This is the lowest-effort path to a native iOS presence for game day functionality.

**Key advantage:** Your existing `createServerFn` calls, Zustand stores, TanStack Router navigation, Shadcn UI components, and Tailwind styles all work as-is inside the Capacitor WebView. No API layer to build.

**Current state:** Capacitor 7.4.4 stable (Swift Package Manager, iOS 18 support). ~930K weekly npm downloads. v8 in alpha.

---

## Architecture

### Monorepo Structure

```
apps/
  wodsmith-start/              # Existing TanStack Start app (unchanged)
  wodsmith-ios/                # New Capacitor project
    capacitor.config.ts        # Capacitor configuration
    ios/                       # Native iOS project (Xcode, auto-managed)
    src/                       # Optional: game-day-specific entry point
    package.json
packages/
  shared-schemas/              # (future) Zod schemas, types shared across apps
```

### Two Deployment Strategies

#### Strategy A: Remote URL (Recommended to Start)

The Capacitor app loads your deployed TanStack Start app from your Workers URL. The native shell adds push notifications, offline caching, and App Store presence.

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.wodsmith.gameday',
  appName: 'WODsmith Game Day',
  server: {
    url: 'https://app.wodsmith.com/compete',  // Point to deployed app
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}
```

**Pros:**
- Zero build pipeline changes to wodsmith-start
- Updates deploy instantly (no App Store review for content changes)
- Server functions work identically to the web app
- Session cookies carry over naturally

**Cons:**
- Requires network connectivity for initial load
- Slightly slower first render vs bundled assets
- App Store reviewers may flag as "web clipping" without enough native features

#### Strategy B: Bundled Assets with Remote API

Build the TanStack Start client bundle locally and ship it inside the Capacitor app. API calls point to the deployed Workers backend.

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.wodsmith.gameday',
  appName: 'WODsmith Game Day',
  webDir: '../wodsmith-start/dist/client',  // Bundled client assets
  server: {
    // API calls go to production Workers
    hostname: 'app.wodsmith.com',
  },
}
```

**Pros:**
- Instant app shell load (no network needed for UI)
- Feels more "native" to App Store reviewers
- Can work partially offline

**Cons:**
- Need to configure TanStack Start's client build for Capacitor
- Server function calls need base URL configuration
- Updates require OTA mechanism or App Store submission

**Recommendation:** Start with Strategy A. It's simpler and you can iterate on the web app without App Store releases. Add service worker caching to make the experience fast after first load. Graduate to Strategy B if App Store reviewers require it or if offline-first becomes critical.

---

## Game Day Feature Scope

### What Already Exists (Reusable As-Is)

These routes are already mobile-responsive and would work inside Capacitor immediately:

| Route | Feature | Game Day Use |
|---|---|---|
| `/compete/$slug` | Competition overview | Event info, schedule, sponsors |
| `/compete/$slug/schedule` | Heat schedule | Spectator: browse all heats |
| `/compete/$slug/leaderboard` | Live leaderboard | Real-time standings by division/event |
| `/compete/$slug/workouts` | Workout details | View events with scaling per division |
| `/compete/$slug/scores` | Volunteer score entry | Judges enter scores per heat |
| `/compete/$slug/my-schedule` | Volunteer schedule | Judge rotation and shift assignments |
| `/compete/$slug/register` | Registration | Pre-event registration |

### New Features to Build (Game Day Specific)

These would be new routes in wodsmith-start, usable on both web and the Capacitor app:

#### 1. Competitor Personal Schedule (`/compete/$slug/my-heats`)
```
- Show all heats where the logged-in athlete is assigned
- Display: heat number, scheduled time, lane number, venue
- Countdown timer to next heat
- Quick links to workout details for upcoming events
```
**Data source:** `getHeatsForCompetitionFn` filtered by user's registration ID

#### 2. Spectator Schedule Builder (`/compete/$slug/my-favorites`)
```
- Browse divisions/teams and "favorite" them
- Generate a personalized schedule of heats featuring favorited athletes
- Local storage for favorites (no auth required for spectators)
- Timeline view of the day with favorited heats highlighted
```
**Data source:** `getPublicScheduleDataFn` + client-side filtering with Zustand or localStorage

#### 3. Push Notification Preferences (`/compete/$slug/notifications`)
```
- Opt-in to heat alerts: "Notify me 10 min before my heats"
- Opt-in to leaderboard updates: "Notify me when standings change"
- Opt-in to announcements from organizer
```
**Implementation:** Capacitor push notifications plugin + a Workers-based notification service

---

## Native Capabilities

### Push Notifications

The most important native capability for game day. Capacitor uses `@capacitor/push-notifications` with APNs on iOS.

#### Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌───────────┐
│  iOS Device │────▶│  Workers Backend  │────▶│   APNs    │
│  (Register) │     │  (Store tokens,   │     │  (Apple)  │
│             │◀────│   send via APNs)  │◀────│           │
│  (Receive)  │     └──────────────────┘     └───────────┘
└─────────────┘
```

#### Implementation Steps

1. **Client (Capacitor app):**
   ```typescript
   import { PushNotifications } from '@capacitor/push-notifications'

   // Request permission on first launch
   const result = await PushNotifications.requestPermissions()
   if (result.receive === 'granted') {
     await PushNotifications.register()
   }

   // Listen for token
   PushNotifications.addListener('registration', (token) => {
     // Send token to your Workers backend
     await fetch('https://app.wodsmith.com/api/push/register', {
       method: 'POST',
       body: JSON.stringify({
         token: token.value,
         platform: 'ios',
         competitionId: currentCompetition.id,
       }),
     })
   })

   // Listen for notifications
   PushNotifications.addListener('pushNotificationReceived', (notification) => {
     // Handle foreground notification
   })
   ```

2. **Backend (new Workers endpoints):**
   - `POST /api/push/register` — Store device token in D1 linked to user/competition
   - `POST /api/push/send` — Organizer triggers notification (heat reminder, announcement)
   - Cron trigger or Durable Object timer for scheduled heat reminders

3. **APNs integration:**
   - Use a lightweight APNs library compatible with Workers (HTTP/2 to Apple's API)
   - Store APNs auth key in Workers secrets
   - Send via `https://api.push.apple.com/3/device/{token}`

#### Notification Types for Game Day

| Trigger | Message | Timing |
|---|---|---|
| Heat reminder | "Heat 3 starts in 10 minutes — Lane 4, Main Floor" | 10 min before scheduledTime |
| Leaderboard update | "New standings posted for RX Division" | After score publication |
| Organizer announcement | Custom message | Manual trigger |
| Schedule change | "Heat 5 moved to 2:30 PM" | On schedule update |

### Offline Support

For game day in a gym with spotty WiFi, offline capability matters.

#### Service Worker Caching (Strategy A)

If using the remote URL strategy, add a service worker to wodsmith-start:

```typescript
// Cache the competition schedule and leaderboard
const CACHE_NAME = 'gameday-v1'
const PRECACHE_URLS = [
  '/compete/${slug}',
  '/compete/${slug}/schedule',
  '/compete/${slug}/leaderboard',
]

// Network-first with cache fallback for API calls
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          cache.put(event.request, response.clone())
          return response
        })
        .catch(() => caches.match(event.request))
    )
  }
})
```

#### SQLite Caching (Strategy B)

If bundling assets, use `@capacitor-community/sqlite` for structured offline data:

```typescript
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite'

// Cache the day's schedule locally
const db = new SQLiteConnection(CapacitorSQLite)
await db.execute(`
  CREATE TABLE IF NOT EXISTS cached_heats (
    id TEXT PRIMARY KEY,
    data TEXT,
    cached_at INTEGER
  )
`)
```

**Synergy with your stack:** Since D1 is SQLite and you use Drizzle, the schema patterns are familiar. You could share type definitions from `packages/shared-schemas/`.

### Other Native Features

| Feature | Plugin | Game Day Use |
|---|---|---|
| Haptic feedback | `@capacitor/haptics` | Confirmation on score entry, heat countdown |
| App badge | `@capacitor/badge` | Show number of upcoming heats |
| Status bar | `@capacitor/status-bar` | Match competition branding |
| Splash screen | `@capacitor/splash-screen` | Competition logo on launch |
| Share | `@capacitor/share` | Share leaderboard position |
| Camera | `@capacitor/camera` | QR code check-in (future) |

---

## App Store Considerations

### Guideline 4.2 Risk Mitigation

Apple rejects apps that are "not sufficiently different from a mobile web browsing experience." To pass review:

1. **Push notifications** — Demonstrates native integration. This is the #1 differentiator.
2. **Offline mode** — Cache schedule data for offline viewing. Show a meaningful offline experience.
3. **Native tab bar** — Consider adding a Capacitor-native bottom tab bar for Schedule / Leaderboard / My Heats.
4. **Haptic feedback** — Add subtle haptics on score entry and heat transitions.
5. **App icon badge** — Show upcoming heat count on the app icon.

### App Store Metadata

- **Category:** Sports
- **Keywords:** CrossFit, competition, WOD, leaderboard, heat schedule
- **Screenshots:** Show the heat schedule, live leaderboard, competitor view
- **Review notes:** "This app provides push notifications for heat schedules, offline access to competition data, and real-time leaderboard updates for CrossFit competitions managed through WODsmith."

### Distribution Timeline

1. **Apple Developer Account** — $99/year, required for App Store and push notifications
2. **TestFlight** — Use for beta testing during development (supports up to 10,000 testers)
3. **App Store Review** — Typically 24-48 hours for first submission
4. **Updates** — Strategy A (remote URL) allows instant content updates without review. Only native shell changes require new submissions.

---

## Development Plan

### Phase 1: Foundation (1-2 weeks)

1. Create `apps/wodsmith-ios/` Capacitor project
2. Configure with Strategy A (remote URL pointing to deployed app)
3. Set up iOS project with proper bundle ID, signing
4. Test existing `/compete/$slug/*` routes in the Capacitor shell
5. Add splash screen and app icon
6. Deploy to TestFlight

### Phase 2: Push Notifications (1-2 weeks)

1. Add `@capacitor/push-notifications` plugin
2. Build Workers endpoints for token registration and notification sending
3. Create D1 table for device tokens (`push_tokens`: id, userId, competitionId, token, platform)
4. Implement APNs integration on Workers
5. Build heat reminder scheduling (Durable Objects or D1-backed cron)
6. Add notification preferences UI in wodsmith-start

### Phase 3: Game Day Features (2-3 weeks)

1. Build `/compete/$slug/my-heats` — competitor personal schedule
2. Build `/compete/$slug/my-favorites` — spectator schedule builder
3. Add service worker for offline schedule caching
4. Implement countdown timers for upcoming heats
5. Add haptic feedback and app badge support

### Phase 4: Polish & Submit (1 week)

1. App Store screenshots and metadata
2. Add native bottom tab bar if needed for review
3. Submit to App Store review
4. Set up CI/CD for Capacitor builds (Appflow or GitHub Actions + Fastlane)

---

## Build & CI/CD

### Local Development

```bash
# Install Capacitor in the new app
cd apps/wodsmith-ios
pnpm add @capacitor/core @capacitor/ios @capacitor/cli
npx cap init

# Add iOS platform
npx cap add ios

# Open in Xcode
npx cap open ios

# Sync changes after web app updates
npx cap sync
```

### CI/CD Options

**Option A: Appflow (Ionic's CI/CD)**
- Cloud builds for iOS (no Mac needed in CI)
- Automated App Store submissions
- Live updates for web layer changes
- Cost: $499/mo for production plan

**Option B: GitHub Actions + Fastlane**
- Use macOS runners for iOS builds
- Fastlane handles signing, building, and uploading
- Free for open source, pay-per-minute for private repos
- More setup, more control

**Option C: Manual**
- Open Xcode, archive, upload
- Fine for early stages with infrequent releases
- Not sustainable long-term

**Recommendation:** Start with Option C during development. Move to Option B when approaching App Store submission. Consider Option A only if the overhead of managing signing certificates and provisioning profiles becomes a burden.

---

## Cost Analysis

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Account | $99 | Annual |
| Capacitor (open source) | Free | — |
| Appflow (if used) | $499/mo | Monthly |
| GitHub Actions macOS | ~$0.08/min | Per build |
| APNs | Free | — |

**Minimum viable cost:** $99/year (just the Apple Developer Account).

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| App Store 4.2 rejection | Medium | Add push notifications, offline mode, haptics before first submission |
| TanStack Start SSR incompatibility in WebView | Low | Strategy A loads the full production app; test SSR hydration in WebView early |
| Poor performance in WebView | Low | Game day features are read-heavy CRUD — WebView handles this well |
| Push notification token management complexity | Medium | Keep it simple: one token per device per competition, expire after competition ends |
| Service worker conflicts between web and Capacitor | Medium | Use Capacitor's `server.url` config to control which origin the WebView loads |

---

## Decision Criteria: When to Graduate from Capacitor

Consider moving to React Native / Expo if:

- You need Home Screen widgets (e.g., "Next heat in 8 min" on lock screen)
- You need Live Activities for real-time heat progress
- The WebView performance ceiling becomes noticeable
- App Store reviewers repeatedly reject despite native integrations
- You want to build a standalone "WODsmith Compete" app with a significantly different UX from the web app
- You need deep device integrations (Bluetooth for heart rate monitors, HealthKit)

Until then, Capacitor gives you 90% of the value at 10% of the effort.
