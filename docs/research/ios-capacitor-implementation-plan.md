# Capacitor Implementation Plan: WODsmith Game Day iOS App

> Comprehensive implementation plan for wrapping the existing TanStack Start web app in Capacitor for iOS distribution, with game-day-specific features.

## Current State Assessment

### What We Have

**Infrastructure:**
- TanStack Start app deployed on Cloudflare Workers via Alchemy IaC
- D1 database with Drizzle ORM (SQLite, 100 param limit, `autochunk` batching)
- KV session storage with cookie-based auth (HttpOnly, SameSite=lax, 30-day TTL)
- R2 for file uploads
- PWA manifest exists at `public/manifest.json` (standalone display mode, maskable icons)
- No service worker currently implemented

**Public Competition Routes (work in Capacitor as-is):**

| Route | Purpose | Auth | Mobile-Ready |
|---|---|---|---|
| `/compete` | Browse competitions | Public | Yes - flex layout, responsive search |
| `/compete/$slug` | Competition layout + hero | Public (optional session) | Yes - glassmorphism hero, responsive banner |
| `/compete/$slug/` (index) | Overview with workouts | Public | Yes - grid layout, sticky sidebar |
| `/compete/$slug/schedule` | Heat schedule (in-person) or submission windows (online) | Public | Yes - card-based |
| `/compete/$slug/leaderboard` | Live standings | Public | Yes - mobile collapsible rows, desktop table |
| `/compete/$slug/workouts/$eventId` | Workout details | Public | Yes |
| `/compete/$slug/volunteer` | Volunteer signup form | Public | Yes - centered card |
| `/compete/$slug/judges-schedule` | Printable judge schedule | Public (obscured) | Yes - print styles |

**Authenticated Competition Routes:**

| Route | Purpose | Auth Check | Mobile-Ready |
|---|---|---|---|
| `/compete/$slug/register` | Registration + payment | `getSessionFromCookie()` → redirect to `/sign-in` | Yes |
| `/compete/$slug/registered` | Post-registration confirmation | Session + registration check | Yes - different layouts mobile/desktop |
| `/compete/$slug/teams/$registrationId` | Team roster management | Session + team membership check | Yes - responsive grid |
| `/compete/$slug/scores` | Volunteer score entry | Session + `canInputScoresFn()` entitlement | Yes - top nav with back button |
| `/compete/$slug/my-schedule` | Volunteer schedule | Session + volunteer membership | Yes - full-width responsive |

**Key Data Flows for Game Day:**
- `getHeatsForCompetitionFn({ competitionId })` → heats with assignments, venues, divisions, athlete names
- `getPublicScheduleDataFn({ competitionId })` → events grouped by trackWorkoutId, sorted by trackOrder
- `getCompetitionLeaderboardFn({ competitionId, divisionId? })` → ranked entries with event results
- `getEventLeaderboardFn({ competitionId, trackWorkoutId, divisionId? })` → single event rankings
- `getEventScoreEntryDataWithHeatsFn({ competitionId, organizingTeamId, trackWorkoutId, divisionId? })` → score entry with heat groupings

**Auth Session Shape (KV):**
```typescript
{
  id, userId, expiresAt, createdAt,
  user: { id, email, firstName, lastName, role, emailVerified, avatar, currentCredits },
  teams: [{ id, name, slug, type, role: { id, name }, permissions: string[], plan? }],
  entitlements?: [{ id, type, metadata, expiresAt }],
  authenticationType?: "passkey" | "password" | "google-oauth",
  version: 5
}
```

**What's Missing for Game Day:**
1. No push notification infrastructure (no APNs, no device token storage)
2. No service worker for offline caching
3. No competitor personal schedule view (only volunteer `my-schedule` exists)
4. No spectator favorites feature
5. No native app shell (Capacitor)
6. No countdown timers for heats
7. Leaderboard uses `?division=` and `?event=` search params but no subscription/polling for live updates

---

## Architecture Decisions

### Strategy: Remote URL with Service Worker Enhancement

The Capacitor app loads the deployed TanStack Start app from `https://wodsmith.com/compete` (or `https://demo.wodsmith.com/compete` for staging). A service worker adds offline caching for schedule and leaderboard data.

**Why Remote URL:**
- All existing routes work immediately without build changes
- TanStack Start's `createServerFn` calls work identically (same-origin, cookies carry over)
- Content updates deploy instantly (no App Store review for web changes)
- Simpler CI/CD (only rebuild the native shell for plugin changes)
- Competition pages are already mobile-responsive

**Why not bundled assets:**
- TanStack Start's SSR hydration with Cloudflare Workers env bindings makes local-only serving complex
- `createServerFn` relies on same-origin fetch — bundled would require base URL reconfiguration
- No meaningful first-load latency issue (Workers edge response <100ms globally)

### Monorepo Structure

```
apps/
  wodsmith-start/              # Existing (modifications for push, offline, game day routes)
  wodsmith-ios/                # NEW: Capacitor shell
    capacitor.config.ts
    ios/                       # Xcode project (gitignored except App/)
    package.json
packages/                      # No new packages needed for this approach
```

The Capacitor project is thin — it's just configuration and the native iOS project. All feature code lives in `wodsmith-start`.

---

## Implementation Plan

### Phase 1: Capacitor Shell & TestFlight

**Goal:** Get the existing web app running in a Capacitor iOS shell and deploy to TestFlight.

#### 1.1 Create Capacitor Project

Create `apps/wodsmith-ios/` with Capacitor pointing to the deployed app:

```
apps/wodsmith-ios/
  capacitor.config.ts          # Config: remote URL, plugin settings
  package.json                 # Capacitor dependencies
  ios/                         # Native iOS project (auto-generated)
    App/
      Info.plist               # Entitlements, capabilities
```

**capacitor.config.ts:**
```typescript
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.wodsmith.compete',
  appName: 'WODsmith Compete',
  server: {
    url: 'https://wodsmith.com/compete',
    // Allow navigation to auth routes
    allowNavigation: ['wodsmith.com', 'demo.wodsmith.com', 'accounts.google.com'],
  },
  ios: {
    scheme: 'WODsmith Compete',
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#ffffff',
    },
    StatusBar: {
      style: 'dark',
    },
  },
}
```

**Key decisions:**
- `server.url` points to `/compete` (the competition section, not the full app)
- `allowNavigation` includes Google OAuth domain for login flow
- App ID `com.wodsmith.compete` — separate from a future full `com.wodsmith.app`

#### 1.2 iOS Project Configuration

- Bundle ID: `com.wodsmith.compete`
- Deployment target: iOS 16+ (Capacitor 7 requires iOS 16+)
- Orientation: Portrait + landscape
- App icon: Generate from existing competition branding
- Splash screen: WODsmith logo on white/dark background

#### 1.3 Auth Flow in WebView

The existing cookie-based auth works in Capacitor's WKWebView because:
- Cookies are shared within the WebView session
- `SameSite=lax` allows normal navigation
- `Secure=true` works because the remote URL is HTTPS

**OAuth flow:** Google OAuth redirects will work because `allowNavigation` includes `accounts.google.com`. The redirect back to `wodsmith.com` stays within the WebView.

**Passkey support:** WKWebView supports WebAuthn/passkeys natively on iOS 16+. The existing `@simplewebauthn/browser` implementation should work, but needs testing. If passkeys fail in WebView, fall back to password/OAuth login.

#### 1.4 TestFlight Deployment

1. Enroll in Apple Developer Program ($99/year)
2. Create App ID in Apple Developer portal
3. Generate provisioning profile
4. Archive and upload via Xcode
5. Submit to TestFlight for internal testing

**Validation checklist before TestFlight:**
- [ ] All `/compete/*` routes load correctly
- [ ] Login/logout works (password, Google OAuth)
- [ ] Registration flow works (including Stripe redirect)
- [ ] Leaderboard renders correctly on iPhone and iPad
- [ ] Schedule page renders correctly
- [ ] Score entry works for volunteers
- [ ] Back/forward navigation works in WebView
- [ ] Deep links from external sources open in the app
- [ ] Status bar is visible and styled correctly
- [ ] Safe area insets are respected (notch, dynamic island)

---

### Phase 2: Push Notifications

**Goal:** Enable heat reminders, leaderboard updates, and organizer announcements via APNs.

#### 2.1 Database Schema

Add a new schema file for push notification device tokens:

**`apps/wodsmith-start/src/db/schemas/push-notifications.ts`:**

```sql
-- New table: push_device_tokens
CREATE TABLE push_device_tokens (
  id TEXT PRIMARY KEY,            -- Format: pdt_*
  userId TEXT NOT NULL,           -- FK → user.id
  competitionId TEXT NOT NULL,    -- FK → competitions.id
  token TEXT NOT NULL,            -- APNs device token
  platform TEXT NOT NULL,         -- 'ios' | 'android' (future)
  createdAt TEXT NOT NULL,        -- ISO timestamp
  lastUsedAt TEXT,                -- Updated on each notification send
  UNIQUE(userId, competitionId, token)
);

-- New table: push_notification_preferences
CREATE TABLE push_notification_preferences (
  id TEXT PRIMARY KEY,            -- Format: pnp_*
  userId TEXT NOT NULL,
  competitionId TEXT NOT NULL,
  heatReminders INTEGER DEFAULT 1,        -- boolean
  leaderboardUpdates INTEGER DEFAULT 1,   -- boolean
  announcements INTEGER DEFAULT 1,        -- boolean
  reminderMinutesBefore INTEGER DEFAULT 10,
  UNIQUE(userId, competitionId)
);

-- New table: push_notifications_log
CREATE TABLE push_notifications_log (
  id TEXT PRIMARY KEY,            -- Format: pnl_*
  competitionId TEXT NOT NULL,
  type TEXT NOT NULL,             -- 'heat_reminder' | 'leaderboard_update' | 'announcement'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sentAt TEXT NOT NULL,
  recipientCount INTEGER DEFAULT 0,
  metadata TEXT                   -- JSON: { heatId?, trackWorkoutId?, divisionId? }
);
```

**Indexes:**
- `push_device_tokens(userId, competitionId)` — find user's tokens for a competition
- `push_device_tokens(competitionId)` — broadcast to all users of a competition
- `push_notification_preferences(userId, competitionId)` — lookup preferences

#### 2.2 Capacitor Push Plugin

Add `@capacitor/push-notifications` to `apps/wodsmith-ios/`:

```typescript
// apps/wodsmith-ios/src/push-setup.ts
import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

export async function initializePush() {
  if (!Capacitor.isNativePlatform()) return

  const permResult = await PushNotifications.requestPermissions()
  if (permResult.receive !== 'granted') return

  await PushNotifications.register()

  PushNotifications.addListener('registration', async (token) => {
    // Store token for later registration with competition
    localStorage.setItem('apns_token', token.value)
    // Post to web app via postMessage or direct API call
    window.postMessage({ type: 'PUSH_TOKEN', token: token.value }, '*')
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Foreground notification — show in-app banner
    // notification.data contains { competitionSlug, type, heatId?, etc. }
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    // User tapped notification — navigate to relevant page
    const data = action.notification.data
    if (data.type === 'heat_reminder' && data.competitionSlug) {
      window.location.href = `/compete/${data.competitionSlug}/schedule`
    } else if (data.type === 'leaderboard_update' && data.competitionSlug) {
      window.location.href = `/compete/${data.competitionSlug}/leaderboard`
    }
  })
}
```

**Bridge pattern:** The Capacitor native layer needs to communicate with the TanStack Start web app. Two approaches:

1. **localStorage bridge:** Native layer writes `apns_token` to localStorage. Web app reads it and sends to server.
2. **postMessage bridge:** Native layer posts message to WebView. Web app listens and handles.

Recommend approach 1 (localStorage) for simplicity — the web app checks for the token when mounting competition pages.

#### 2.3 Server Functions for Push

**`apps/wodsmith-start/src/server-fns/push-notification-fns.ts`:**

| Function | Method | Input | Auth | Purpose |
|---|---|---|---|---|
| `registerDeviceTokenFn` | POST | `{ competitionId, token, platform }` | Session required | Store device token |
| `unregisterDeviceTokenFn` | POST | `{ competitionId, token }` | Session required | Remove device token |
| `getNotificationPreferencesFn` | GET | `{ competitionId }` | Session required | Get user's preferences |
| `updateNotificationPreferencesFn` | POST | `{ competitionId, prefs }` | Session required | Update preferences |
| `sendAnnouncementFn` | POST | `{ competitionId, title, body }` | MANAGE_COMPETITIONS | Organizer broadcast |
| `sendHeatRemindersFn` | POST | `{ competitionId, heatId }` | Internal/Cron | Trigger heat reminders |

#### 2.4 APNs Integration on Workers

Cloudflare Workers support HTTP/2 to Apple's APNs endpoint. Use JWT-based authentication (no certificate needed):

```typescript
// apps/wodsmith-start/src/server/push/apns.ts
// Uses createServerOnlyFn pattern for env access

// APNs endpoint: https://api.push.apple.com/3/device/{token}
// Auth: JWT signed with APNs auth key (stored in Workers secret)
// Payload: { aps: { alert: { title, body }, sound: "default", badge: N } }
```

**Secrets to add to Workers:**
- `APNS_KEY_ID` — Key ID from Apple Developer
- `APNS_TEAM_ID` — Team ID from Apple Developer
- `APNS_PRIVATE_KEY` — .p8 key contents (base64 encoded)
- `APNS_BUNDLE_ID` — `com.wodsmith.compete`

#### 2.5 Cron-Based Heat Reminders

The existing cron trigger (`*/15 * * * *` in `alchemy.run.ts`) can be extended to check for upcoming heats and send reminders:

```
Every 15 minutes:
1. Query heats where scheduledTime is within next 15 minutes
2. For each heat, get assigned registrations
3. For each registration, check if user has device tokens and heatReminders=true
4. Send APNs notification: "Heat {N} starts in {minutes} — Lane {lane}, {venue}"
```

Since the cron runs every 15 minutes and the default reminder is 10 minutes before, notifications will arrive 10-15 minutes before the heat.

#### 2.6 Competition Page Push Registration UI

Add a push notification opt-in component to the competition layout (`/compete/$slug.tsx`):

- Show only when running in Capacitor (`Capacitor.isNativePlatform()`)
- Check localStorage for `apns_token`
- If token exists and user is logged in, register with `registerDeviceTokenFn`
- Show notification preferences (heat reminders, leaderboard, announcements)
- Store preferences server-side via `updateNotificationPreferencesFn`

---

### Phase 3: Competitor Personal Schedule ("My Heats")

**Goal:** Build `/compete/$slug/my-heats` — a competitor's personalized view of their heat assignments across all events.

#### 3.1 Data Source

The data already exists. `getHeatsForCompetitionFn` returns all heats with assignments including `registration.user.id`. We need to filter by the current user's registration.

**New server function:**

```typescript
// getMyHeatsFn({ competitionId, userId })
// 1. Get user's competition registration (getUserCompetitionRegistrationFn pattern)
// 2. If team registration, get athleteTeam members to find all registrationIds
// 3. Query competition_heat_assignments where registrationId IN userRegistrationIds
// 4. Join with heats for scheduledTime, heatNumber, venue, division
// 5. Join with track_workouts for event name and order
// 6. Return sorted by scheduledTime ASC
```

**Return shape:**
```typescript
interface MyHeat {
  heatId: string
  heatNumber: number
  scheduledTime: string | null       // ISO timestamp
  durationMinutes: number | null
  laneNumber: number
  venue: { id: string; name: string } | null
  division: { id: string; label: string } | null
  event: {
    trackWorkoutId: string
    trackOrder: number
    name: string                     // Workout name
  }
  registration: {
    id: string
    teamName: string | null
  }
}
```

#### 3.2 Route

**`apps/wodsmith-start/src/routes/compete/$slug/my-heats.tsx`:**

- **Auth:** Required — redirect to `/sign-in` if not authenticated
- **Loader:** Call `getMyHeatsFn` with competition ID and user ID
- **Error states:**
  - Not registered → "You're not registered for this competition" with link to register
  - No heats assigned yet → "Heats haven't been assigned yet. Check back later."
  - Heats not published → "The heat schedule hasn't been published yet."

#### 3.3 UI Components

**MyHeatsPage:**
```
┌─────────────────────────────────┐
│  My Heats                       │
│  Competition Name               │
├─────────────────────────────────┤
│                                 │
│  ┌─ UP NEXT ──────────────────┐ │
│  │ 🔴 LIVE   Heat 3           │ │
│  │ Event 2: Fran              │ │
│  │ 10:45 AM • Lane 4          │ │
│  │ Main Floor • RX Division   │ │
│  │                             │ │
│  │ ████████████░░░░  8 min     │ │
│  │ (countdown bar)             │ │
│  └─────────────────────────────┘ │
│                                 │
│  ── COMING UP ──                │
│                                 │
│  ┌─────────────────────────────┐ │
│  │ Heat 5           11:30 AM  │ │
│  │ Event 3: DT                │ │
│  │ Lane 2 • Outside Rig       │ │
│  └─────────────────────────────┘ │
│                                 │
│  ┌─────────────────────────────┐ │
│  │ Heat 1           1:00 PM   │ │
│  │ Event 4: Murph             │ │
│  │ Lane 6 • Main Floor        │ │
│  └─────────────────────────────┘ │
│                                 │
│  ── COMPLETED ──                │
│                                 │
│  ┌─────────────────────────────┐ │
│  │ ✓ Heat 2         9:15 AM   │ │
│  │ Event 1: Grace             │ │
│  │ Lane 3 • Main Floor        │ │
│  └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Features:**
- Group heats into "Up Next" (current/next), "Coming Up" (future), "Completed" (past)
- Countdown timer for the next heat (updates every second via `setInterval`)
- Visual "LIVE" indicator when a heat is currently in progress
- Tap a heat card to navigate to the event details (`/compete/$slug/workouts/$eventId`)
- Pull-to-refresh pattern (refetch from server)

**Countdown logic:**
```typescript
// Current time from device
const now = new Date()
// Next heat = first heat where scheduledTime > now
// Time remaining = scheduledTime - now (in minutes/seconds)
// "LIVE" = scheduledTime < now && scheduledTime + durationMinutes > now
```

#### 3.4 Navigation Integration

Add "My Heats" to the competition tabs (`competition-tabs.tsx`):
- Show only when user is registered for the competition
- Position: After "Schedule", before "Leaderboard"
- Mobile select: Add option to the dropdown
- Desktop tabs: Add tab button

The parent route loader (`/compete/$slug.tsx`) already calls `getUserCompetitionRegistrationFn` for logged-in users, so we know if the user is registered.

---

### Phase 4: Spectator Favorites

**Goal:** Build `/compete/$slug/favorites` — spectators can favorite athletes/teams and get a personalized schedule.

#### 4.1 Storage: Client-Side Only

Favorites are stored in localStorage, not the database. This means:
- No auth required — spectators can use this without an account
- No server load for favorites management
- Data persists across sessions on the same device
- Favorites are per-competition

```typescript
// localStorage key: `favorites:${competitionId}`
// Value: JSON array of registration IDs
interface FavoritesStore {
  competitionId: string
  favorites: string[]    // registrationId[]
}
```

#### 4.2 Data Source

Use the existing `getPublicScheduleDataFn({ competitionId })` which returns all published heats with assignments. Filter client-side by favorited registration IDs.

For browsing athletes to favorite, use the existing leaderboard data which includes `registrationId`, athlete names, and division.

#### 4.3 Route

**`apps/wodsmith-start/src/routes/compete/$slug/favorites.tsx`:**

- **Auth:** None required
- **Loader:** Same data as schedule page (heats with assignments)
- **State:** Zustand store or `useSyncExternalStore` wrapping localStorage

#### 4.4 UI Flow

**Step 1: Browse & Favorite**
- Navigate to Favorites tab → shows "No favorites yet" with instructions
- "Browse Athletes" button → opens a searchable list from leaderboard data
- Each athlete row has a heart/star toggle
- Search by name, filter by division

**Step 2: Personal Schedule**
- After favoriting, the page shows a filtered timeline
- Only heats containing favorited athletes are shown
- Grouped by time, with the athlete name highlighted in each heat card

```
┌─────────────────────────────────┐
│  My Favorites                   │
│  3 athletes selected  [Edit]    │
├─────────────────────────────────┤
│                                 │
│  ── 10:00 AM ──                 │
│                                 │
│  Heat 2 • Main Floor            │
│  ★ Sarah Jones — Lane 3, RX    │
│                                 │
│  ── 10:45 AM ──                 │
│                                 │
│  Heat 3 • Main Floor            │
│  ★ Mike Chen — Lane 4, RX      │
│                                 │
│  Heat 1 • Outside Rig           │
│  ★ Alex Park — Lane 2, Scaled  │
│                                 │
│  ── 11:30 AM ──                 │
│  ...                            │
└─────────────────────────────────┘
```

#### 4.5 Navigation Integration

Add "Favorites" to competition tabs:
- Always visible (no auth required)
- Badge showing count of favorites (from localStorage)
- Position: After "Leaderboard"

---

### Phase 5: Offline Support via Service Worker

**Goal:** Cache competition schedule and leaderboard for use when WiFi is unreliable in a gym.

#### 5.1 Service Worker Registration

TanStack Start doesn't have built-in service worker support. Register manually in the root layout:

**`apps/wodsmith-start/src/routes/__root.tsx`** (add to existing):

```typescript
// Register service worker for competition pages
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

#### 5.2 Service Worker Strategy

**`apps/wodsmith-start/public/sw.js`:**

Cache strategy: **Network-first with cache fallback** for API responses, **Cache-first** for static assets.

**What to cache:**
| Resource | Strategy | TTL |
|---|---|---|
| Static assets (JS, CSS, images) | Cache-first | Until next deploy |
| `/compete/$slug` HTML | Network-first, cache fallback | 5 min |
| `/compete/$slug/schedule` HTML | Network-first, cache fallback | 5 min |
| `/compete/$slug/leaderboard` HTML | Network-first, cache fallback | 2 min |
| Server function responses | Network-first, cache fallback | 2-5 min |
| Competition images (R2) | Cache-first | 24 hours |

**What NOT to cache:**
- `/compete/$slug/register` — payment flow must be live
- `/compete/$slug/scores` — score entry must be live
- Authentication endpoints

#### 5.3 Cache Invalidation

The service worker uses a versioned cache name. On new deploy, the old cache is purged:

```javascript
const CACHE_VERSION = 'gameday-v1'
const CACHE_NAMES = {
  static: `${CACHE_VERSION}-static`,
  pages: `${CACHE_VERSION}-pages`,
  api: `${CACHE_VERSION}-api`,
  images: `${CACHE_VERSION}-images`,
}
```

#### 5.4 Offline Indicator

Add an offline indicator component that shows when the device has no network:

```typescript
// components/offline-indicator.tsx
// Uses navigator.onLine + 'online'/'offline' events
// Shows a banner: "You're offline. Showing cached data."
```

---

### Phase 6: Live Leaderboard Polling

**Goal:** Make the leaderboard feel "live" during game day with automatic refreshes.

#### 6.1 Current State

The leaderboard page (`/compete/$slug/leaderboard`) uses `LeaderboardPageContent` which calls server functions on mount. There's no polling or subscription mechanism.

#### 6.2 Polling Implementation

Add polling to the leaderboard component when the competition is active (between `startDate` and `endDate`):

```typescript
// In LeaderboardPageContent
const isCompetitionActive = useMemo(() => {
  const now = new Date()
  return now >= new Date(competition.startDate) && now <= new Date(competition.endDate)
}, [competition])

// Poll every 30 seconds during active competition
useEffect(() => {
  if (!isCompetitionActive) return
  const interval = setInterval(() => {
    refetchLeaderboard()
  }, 30_000)
  return () => clearInterval(interval)
}, [isCompetitionActive])
```

#### 6.3 Visual Update Indicator

When new data arrives, briefly highlight changed positions:
- Position improved: Green flash on the row
- Position dropped: Red flash on the row
- New score posted: Subtle pulse animation

This uses `useRef` to track previous data and compare rank positions on refetch.

---

### Phase 7: App Store Polish & Submission

**Goal:** Pass App Store review on first submission.

#### 7.1 Native Enhancements for App Store Review

App Store guideline 4.2 requires the app to be "sufficiently different from a mobile web browsing experience." Our differentiators:

1. **Push notifications** (Phase 2) — primary differentiator
2. **Offline caching** (Phase 5) — demonstrates native capability
3. **Haptic feedback** — add via `@capacitor/haptics`:
   - Score submission confirmation (medium impact)
   - Heat countdown reaching zero (heavy impact)
   - Pull-to-refresh completion (light impact)
4. **App badge** — show count of upcoming heats on app icon via `@capacitor/badge`
5. **Splash screen** — branded launch screen with competition theme

#### 7.2 App Store Assets

- **App icon:** 1024x1024 — WODsmith competition branding (orange/amber accent)
- **Screenshots:** iPhone 15 Pro (6.7") and iPad Pro (12.9"):
  1. Heat schedule view
  2. Live leaderboard
  3. My Heats with countdown timer
  4. Push notification on lock screen
  5. Score entry interface
- **App Preview video (optional):** 15-30s showing the game day experience

#### 7.3 App Store Metadata

```
App Name: WODsmith Compete
Subtitle: Game Day for CrossFit Competitions
Category: Sports
Keywords: CrossFit, competition, WOD, leaderboard, heat schedule, game day, fitness
Description: WODsmith Compete is the game day companion for CrossFit competitions.
  Athletes: View your heat schedule, lane assignments, and countdown timers.
  Spectators: Follow your favorite athletes with a personalized schedule.
  Judges: Enter scores and manage your judging rotation.
  Everyone: Watch the live leaderboard update in real-time.

  Features:
  - Live leaderboard with automatic updates
  - Personal heat schedule with countdown timers
  - Push notifications for heat reminders
  - Offline schedule access for spotty gym WiFi
  - Spectator favorites for following friends and athletes

  WODsmith Compete works with competitions managed through WODsmith (wodsmith.com).
```

#### 7.4 Review Notes for Apple

```
This app provides a native game day experience for CrossFit competitions managed
through WODsmith. Key native features include:

1. Push notifications for heat schedules and leaderboard updates
2. Offline caching for competition data when WiFi is unreliable
3. Haptic feedback for score entry and countdown events
4. App badge showing upcoming heat count

For testing, use these credentials:
  Email: [test account]
  Password: [test password]
  Competition: [link to test competition]
```

---

## File Changes Summary

### New Files

| File | Purpose |
|---|---|
| `apps/wodsmith-ios/capacitor.config.ts` | Capacitor configuration |
| `apps/wodsmith-ios/package.json` | Capacitor dependencies |
| `apps/wodsmith-ios/ios/` | Native Xcode project (auto-generated) |
| `apps/wodsmith-start/src/db/schemas/push-notifications.ts` | Push token & preference tables |
| `apps/wodsmith-start/src/server-fns/push-notification-fns.ts` | Push notification server functions |
| `apps/wodsmith-start/src/server/push/apns.ts` | APNs integration (server-only) |
| `apps/wodsmith-start/src/routes/compete/$slug/my-heats.tsx` | Competitor personal schedule route |
| `apps/wodsmith-start/src/routes/compete/$slug/favorites.tsx` | Spectator favorites route |
| `apps/wodsmith-start/src/components/my-heat-card.tsx` | Heat card with countdown timer |
| `apps/wodsmith-start/src/components/favorites-browser.tsx` | Athlete browser for favorites |
| `apps/wodsmith-start/src/components/favorites-schedule.tsx` | Filtered schedule for favorites |
| `apps/wodsmith-start/src/components/offline-indicator.tsx` | Offline state banner |
| `apps/wodsmith-start/src/components/push-opt-in.tsx` | Push notification preferences UI |
| `apps/wodsmith-start/public/sw.js` | Service worker for offline caching |
| `apps/wodsmith-start/src/server-fns/my-heats-fns.ts` | My Heats server function |

### Modified Files

| File | Change |
|---|---|
| `apps/wodsmith-start/src/db/schema.ts` | Export new push notification tables |
| `apps/wodsmith-start/src/routes/compete/$slug.tsx` | Add push registration bridge, "My Heats" and "Favorites" tabs |
| `apps/wodsmith-start/src/components/competition-tabs.tsx` | Add "My Heats" and "Favorites" tab entries |
| `apps/wodsmith-start/src/components/leaderboard-page-content.tsx` | Add polling for live updates during active competition |
| `apps/wodsmith-start/src/routes/__root.tsx` | Service worker registration |
| `apps/wodsmith-start/src/routes/api/` | New cron handler for push reminders (extend existing cron) |
| `apps/wodsmith-start/alchemy.run.ts` | Add APNS secrets to Worker bindings |
| `pnpm-workspace.yaml` | Add `apps/wodsmith-ios` to workspace |

### No Changes Needed

| File | Reason |
|---|---|
| `src/routes/compete/$slug/schedule.tsx` | Works as-is in Capacitor |
| `src/routes/compete/$slug/leaderboard.tsx` | Works as-is (polling added to component, not route) |
| `src/routes/compete/$slug/scores.tsx` | Works as-is in Capacitor |
| `src/routes/compete/$slug/register.tsx` | Works as-is (Stripe redirect in WebView) |
| `src/utils/auth.ts` | Cookie auth works in WKWebView |
| `src/utils/kv-session.ts` | No changes needed |

---

## Phase Sequence & Dependencies

```
Phase 1: Capacitor Shell (no dependencies)
    │
    ├── Phase 2: Push Notifications (depends on Phase 1 for TestFlight)
    │       │
    │       └── Phase 6: Live Leaderboard (can include push for score updates)
    │
    ├── Phase 3: My Heats (independent of push, depends on Phase 1 for testing)
    │
    ├── Phase 4: Favorites (independent, depends on Phase 1 for testing)
    │
    └── Phase 5: Offline Support (independent, depends on Phase 1 for testing)
            │
            └── Phase 7: App Store Submission (depends on all above)
```

**Phases 3, 4, and 5 can be built in parallel** since they're independent features. Phase 2 is the highest priority after Phase 1 because push notifications are the primary App Store differentiator.

---

## Testing Strategy

### Manual Testing Matrix

| Test | Device | Network | Auth State |
|---|---|---|---|
| Browse competitions | iPhone + iPad | Online | Logged out |
| Competition detail | iPhone + iPad | Online | Logged out |
| Registration flow | iPhone | Online | Logged in |
| Score entry | iPhone | Online | Logged in (volunteer) |
| My Heats | iPhone | Online | Logged in (registered) |
| Favorites | iPhone | Online | Logged out |
| Leaderboard polling | iPhone | Online | Any |
| Offline schedule | iPhone | Airplane mode | Any |
| Push notification | iPhone | Online | Logged in |
| OAuth login | iPhone | Online | Logged out |
| Passkey login | iPhone | Online | Logged out |
| Deep link from push | iPhone | Online | Any |

### Automated Testing

- Existing Vitest tests cover server functions
- Add Vitest tests for new server functions (`my-heats-fns`, `push-notification-fns`)
- Service worker tested via Playwright with offline simulation
- Capacitor plugins tested manually on device (no simulator for push)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| App Store 4.2 rejection | Medium | High | Push notifications + offline + haptics. Include detailed review notes. Have a native tab bar ready as fallback if first submission rejected. |
| Passkeys fail in WKWebView | Medium | Low | Password and Google OAuth still work. Test early in Phase 1. |
| Stripe redirect breaks in WebView | Low | High | Test in Phase 1. `allowNavigation` should handle it. If not, use `@capacitor/browser` for payment as an escape hatch. |
| APNs on Workers (HTTP/2) | Low | Medium | Workers support HTTP/2 fetch. If issues arise, use a third-party push service (OneSignal, Expo Push). |
| Service worker conflicts | Medium | Medium | Scope the SW to `/compete/` path only. Test thoroughly. |
| WiFi blackout during game day | High | Medium | Service worker offline caching. Offline indicator. Score entry requires network (no offline score entry — too risky). |
| Cron timing for heat reminders | Low | Low | 15-minute cron + 10-minute reminder = notifications arrive 10-15 min before heat. Acceptable for v1. Can reduce to 5-min cron later. |

---

## Open Questions

1. **App naming:** "WODsmith Compete" vs "WODsmith Game Day" vs just "WODsmith"?
2. **Default route:** Should the app open to `/compete` (competition browser) or should there be a native landing screen first?
3. **Push notification provider:** Build direct APNs integration on Workers, or use a service like OneSignal/Expo Push for simpler multi-platform support?
4. **Organizer features in the app:** Should the Capacitor app also include organizer routes (`/compete/organizer/*`), or restrict to athlete/spectator/volunteer views?
5. **Version strategy:** When to rebuild and submit a new version vs relying on web-only updates?
