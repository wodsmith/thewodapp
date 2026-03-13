# Capacitor/Ionic Research for Gameday App

> Research date: 2026-03-12
> Bead: th-0nc

## Executive Summary

Capacitor is a viable path for wrapping wodsmith-compete as a native mobile app. The app's form-heavy, data-display nature fits Capacitor's sweet spot. The biggest challenge is **not Capacitor itself** but **restructuring the client/server boundary**: the current TanStack Start app uses `createServerFn` extensively with Cloudflare Workers bindings, which won't work inside a Capacitor WebView. An API route layer and token-based auth would be required.

---

## What is Capacitor?

Capacitor (by the Ionic team, currently v8.2.0) is an open-source cross-platform native runtime. It wraps web apps inside native WebView containers (WKWebView on iOS, Android WebView) and packages them as real native apps.

**Core architecture:**
- Web assets bundled into native app binary
- Native "bridge" connects JS to platform APIs (Swift/Kotlin)
- Plugin system: each native capability is a separate npm package
- The app is a genuine native app — goes through Xcode/Android Studio, signed, ships to stores

### Capacitor vs Ionic Framework

| | Capacitor | Ionic Framework |
|---|---|---|
| What it is | Native runtime/bridge | UI component library |
| Required? | Yes (for native wrapping) | No |
| Works with | Any web framework | Angular, React, Vue |

**Capacitor works without Ionic.** Our existing Tailwind + shadcn/ui stack works fine. Ionic Framework is just optional mobile-optimized UI components.

---

## Wrapping Existing Web App vs Building New

### Option A: Wrap Existing TanStack Start App

**Not straightforward.** `createServerFn` relies on an internal `/__server` RPC endpoint co-located with the app. In a Capacitor build (`capacitor://localhost`), there is no co-located server, so server function calls fail.

**Required changes:**
1. Create explicit API routes (`src/routes/api/`) as a parallel API surface
2. Build a SPA-mode client bundle for Capacitor (TanStack Start supports SPA mode)
3. Mobile app calls deployed API endpoints at full URLs (e.g., `https://wodsmith.com/api/...`)
4. Extract shared business logic to `src/server/` callable from both server functions and API routes

**Effort:** Medium-high. Need to duplicate/refactor every server function into an API route.

### Option B: Build Separate Mobile App

Build a standalone React SPA that uses the same API routes. Could share components but would be a separate build target.

**Effort:** High. More flexibility but more code to maintain.

### Recommendation

**Option A (wrap with API layer)** — less code duplication, shared component library, single codebase to maintain. The API routes benefit the web app too (third-party integrations, webhooks, etc.).

---

## Compatibility with Cloudflare Workers + D1

### API Communication
- Capacitor apps make standard HTTPS requests to your Workers
- **Capacitor HTTP plugin** routes requests through native networking, bypassing CORS entirely for native builds
- For web/dev builds, add CORS headers for `capacitor://localhost` (iOS) and `http://localhost` (Android)
- Workers' edge deployment is a benefit — low latency globally

### Authentication: Cookies vs Tokens

**Tokens required for mobile.** Cookie-based auth has serious issues in Capacitor:
- iOS WKWebView uses isolated cookie storage (not shared with Safari)
- `capacitor://` scheme causes WebKit to refuse sending cookies
- Third-party cookies blocked on iOS 14+
- Behavior inconsistent across Android versions

**Token-based approach:**
- Store access tokens in memory, refresh tokens in `capacitor-secure-storage-plugin` (AES-256, backed by iOS Keychain / Android Keystore)
- Send via `Authorization: Bearer` header
- Workers validate against KV the same way — just read from `Authorization` header instead of/in addition to `Cookie` header
- Small change to `getSessionFromCookie()` to also check for bearer token

### TanStack Start Server Functions

**`createServerFn` does NOT work inside Capacitor.** This is the critical finding.

The mobile app needs explicit API routes. Both web and mobile can share the underlying business logic in `src/server/`.

---

## Offline Support

### What Works
- **App shell is always offline** — all web assets bundled in the binary, no network needed to load UI
- **Local data storage options:**
  - `@capacitor/preferences` — key-value storage
  - IndexedDB — larger structured data (works in both iOS/Android WebViews)
  - `@capacitor/filesystem` — file storage
  - Capacitor SQLite plugin — full SQLite database locally

### What Doesn't Work
- **Service Workers on iOS: DO NOT WORK.** WKWebView hard limitation, no fix from Apple
- **Service Workers on Android:** Partial, unreliable in WebView
- Not needed anyway — assets already bundled locally

### Offline Strategy for Gameday

Athletes need offline access to:
- Competition details (name, dates, timezone, type, status)
- Events/workouts (description, scheme, movements, time cap, scaling)
- Division info and athlete registration
- Schedule/heat assignments
- Submission window times
- Previous submission history

**Implementation approach:**
1. Pre-cache competition data before gameday (sync when online)
2. Store in IndexedDB or Capacitor SQLite
3. Queue score/video submissions locally
4. Upload when connectivity returns
5. Background sync with `@capacitor/background-runner`

**Effort:** Non-trivial. Requires building a local-first data layer with sync logic. No existing offline patterns in the codebase.

---

## Native Device Features

### Camera (for Video Submissions)

Current flow: athletes upload to YouTube and paste URL. With Capacitor:

| Plugin | Capability |
|---|---|
| `@capacitor/camera` | Take photos, pick from gallery, video capture |
| `@capacitor/filesystem` | Store captured media locally |

**Potential improvement:** Direct video capture → upload to R2/S3 → submit. Eliminates the YouTube dependency. Would need a video upload endpoint on Workers + R2 storage.

### Other Relevant Plugins

| Plugin | Use Case |
|---|---|
| `@capacitor/push-notifications` | Notify athletes when submission windows open/close, results posted |
| `@capacitor/network` | Detect online/offline for sync |
| `@capacitor/geolocation` | Navigate to competition venues |
| `@capacitor/share` | Share results via native share sheet |
| `@capacitor/haptics` | Tactile feedback on score submission |
| `@capacitor/barcode-scanner` | QR code check-in at events |
| `@capacitor/local-notifications` | Heat time reminders |
| `@capacitor/app` | Deep linking to specific competitions |

---

## Build & Deploy to App Store / Play Store

### iOS (App Store)
- **Requirements:** Apple Developer Program ($99/year), Mac with Xcode 26+, iOS Distribution certificate
- **Process:** `npx cap sync ios` → Xcode → Archive → Upload to App Store Connect → Submit for review
- **Deployment target:** iOS 15.0+
- **Review time:** Typically 24-48 hours

### Android (Google Play)
- **Requirements:** Google Play Developer account ($25 one-time), Android Studio 2025.2.1+, Keystore
- **Process:** `npx cap sync android` → Android Studio → Build signed AAB → Upload to Google Play Console
- **Target SDK:** 36

### Over-the-Air Updates
- Capacitor supports OTA JS/asset updates via services like Capgo
- Apple allows this as long as native code/core functionality doesn't change
- Can push bug fixes and UI updates without app store resubmission
- Useful for rapid iteration during competition season

### Capacitor 8 Requirements
- Node.js 22+
- Swift Package Manager (replaces CocoaPods for new projects)
- Built-in edge-to-edge support on Android

---

## Gameday App Feature Mapping

### Current Compete Features (from codebase analysis)

| Feature | Mobile Priority | Offline Needed? |
|---|---|---|
| Competition overview (`/compete/$slug`) | High | Yes — cache on registration |
| Event/workout details with scoring | High | Yes — critical during gameday |
| Video submission form | High | Queue offline, upload when online |
| Schedule/heats view | High | Yes — athletes need this at venue |
| Registration confirmation | Medium | Cache after registration |
| Athlete profile & history | Medium | Cache benchmarks/PRs |
| Team/group info | Medium | Cache team roster |
| Invoices | Low | No |

### Key Server Functions to Expose as API Routes

| Server Function | API Route |
|---|---|
| `getPublishedCompetitionWorkoutsWithDetailsFn` | `GET /api/competitions/:slug/workouts` |
| `getPublicEventDetailsFn` | `GET /api/competitions/:slug/events/:eventId` |
| `getVideoSubmissionFn` | `GET /api/submissions/:eventId` |
| `submitVideoFn` | `POST /api/submissions/:eventId` |
| `getBatchSubmissionStatusFn` | `GET /api/submissions/status?events=...` |
| `getAthleteProfileDataFn` | `GET /api/athlete/profile` |

---

## Performance Assessment

**Capacitor performs well for:**
- Form-heavy / CRUD apps (wodsmith's core use case)
- Content display, lists, data entry
- Standard UI interactions and navigation

**Capacitor struggles with:**
- Complex animations and gesture-heavy interfaces
- Real-time graphics, games, heavy canvas
- Large scrolling lists with complex layouts

**Verdict:** wodsmith-compete is squarely in Capacitor's comfort zone. Forms, lists, schedules, data display — no performance concerns.

**Note:** Android WebView performs noticeably worse than iOS WKWebView on lower-end devices. Test on mid-range Android devices early.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| `createServerFn` incompatibility | High | Build API route layer (required work) |
| Cookie auth doesn't work in WebView | High | Add token-based auth path |
| No service workers on iOS | Medium | Use native storage plugins instead |
| Offline sync complexity | Medium | Start with read-only cache, add write queue later |
| Android WebView performance | Low | App is form-heavy, not animation-heavy |
| App Store review rejection | Low | Capacitor apps are standard native apps |
| Maintaining two build targets | Medium | Share components and business logic |

---

## Recommended Implementation Approach

### Phase 1: Foundation (API Layer + Auth)
1. Create API routes in `src/routes/api/` mirroring key server functions
2. Add bearer token auth support to session validation
3. Configure CORS for Capacitor origins

### Phase 2: Capacitor Shell
1. Add Capacitor to the monorepo (`apps/wodsmith-mobile/` or alongside `wodsmith-start/`)
2. Configure SPA build mode for TanStack Start
3. Set up iOS and Android projects
4. Basic navigation and competition browsing

### Phase 3: Native Features
1. Push notifications for submission windows and results
2. Direct video capture and upload (replacing YouTube URL flow)
3. QR code check-in at events

### Phase 4: Offline Support
1. Pre-cache competition data on registration
2. Offline workout/schedule viewing
3. Queue submissions for upload when online
4. Background sync

---

## Sources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [TanStack Start + Capacitor (Aaron K Saunders)](https://dev.to/aaronksaunders/tanstack-start-to-mobile-building-robust-apps-with-capacitor-24ae)
- [TanStack Start + Capacitor Template](https://github.com/aaronksaunders/tanstack-capacitor-mobile-1)
- [Capacitor Official Plugins](https://github.com/ionic-team/capacitor-plugins)
- [Capacitor HTTP Plugin](https://capacitorjs.com/docs/apis/http) — CORS bypass for native
- [Capacitor Security Guide](https://capacitorjs.com/docs/guides/security)
- [iOS Service Workers WKWebView Limitation](https://github.com/ionic-team/capacitor/issues/7069)
- [Capacitor 8 Release](https://ionic.io/blog/announcing-capacitor-8)
- [TanStack Start SPA Mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode)
- [Cloudflare Workers + TanStack Start](https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/)
