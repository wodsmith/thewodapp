# Mobile Gameday App: Research Report

> Compiled 2026-03-13 from research beads th-0nc (Capacitor), th-1jn (Tauri 2.0), th-3wt (React Native/Expo), th-yfh (PWA)

## Executive Summary

Four mobile approaches were evaluated for building the wodsmith-compete gameday app: **React Native/Expo**, **Capacitor**, **Tauri 2.0 Mobile**, and **PWA**. The app requires score submission, heat schedules, leaderboards, offline support at venues with poor connectivity, and video capture.

**Recommendation: Capacitor** as the primary approach, with PWA as a complementary layer.

Capacitor offers the highest code reuse from the existing TanStack Start + React 19 codebase, the fastest path to app store distribution, and a mature plugin ecosystem covering all gameday requirements. The existing shadcn/ui + Tailwind components render directly in the WebView with zero rewrite. The app's form-heavy, data-display nature is squarely in Capacitor's performance sweet spot.

React Native/Expo is the strongest choice if native performance or complex animations become requirements, but demands a complete UI rewrite (~40-60% code reuse, all UI from scratch). Tauri 2.0 Mobile is technically capable but too immature for production mobile. PWA provides zero-install access for athletes but iOS limitations (cache eviction, no background sync) make it unreliable as the sole offline solution.

---

## Comparison Matrix

| Factor | Capacitor | React Native / Expo | Tauri 2.0 Mobile | PWA |
|--------|-----------|--------------------|--------------------|-----|
| **Code reuse from TanStack Start** | Very High (~80-90%) | Moderate (~40-60%) | High (~70-80%) | Very High (~90%+) |
| **UI component reuse** | Full (shadcn/ui, Tailwind) | None (full rewrite) | Full (webview) | Full (same app) |
| **Offline capability** | Good (SQLite plugin, IndexedDB) | Excellent (expo-sqlite, Legend State) | Good (SQLite via plugin) | Fragile on iOS (cache eviction) |
| **Native API access** | Mature plugin ecosystem | Extensive (Expo SDK) | Growing, gaps remain | Limited (Web APIs only) |
| **Video capture** | Native camera plugin | expo-camera | Webview + plugins | getUserMedia / file input |
| **Push notifications** | Native plugin | expo-notifications | Plugin available | iOS: Home Screen PWA only |
| **App Store distribution** | Yes (native app) | Yes (EAS Build/Submit) | Yes (Xcode/Android Studio) | Android TWA only; iOS hostile |
| **OTA updates** | Capgo (JS/asset updates) | EAS Update | No standard solution | Instant (SW update) |
| **Build complexity** | Low (npx cap sync) | Medium (EAS Build) | High (Rust + Xcode/AS) | None (same deploy) |
| **Production maturity (mobile)** | Mature | Mature | Early | Mature (web), fragile (iOS offline) |
| **Performance ceiling** | WebView (adequate for forms/lists) | Native (highest) | WebView + Rust backend | WebView (same as web) |
| **Learning curve for team** | Low (web-only skills) | High (React Native specifics) | Moderate (Rust for native) | Low (existing skills) |
| **CI/CD tooling** | Mature (Appflow) | Mature (EAS) | Limited | N/A |
| **Bundle size** | Small (native webview) | Medium | Small (native webview) | N/A (web-served) |
| **Background sync** | Plugin available | expo-background-task (limited) | Unclear | No iOS support |
| **Auth approach needed** | Bearer tokens (cookies broken in WebView) | Bearer tokens (expo-secure-store) | HTTP client (bearer tokens) | Existing cookies work |

---

## Critical Shared Finding: Server Function Incompatibility

All native app approaches share one critical finding: **`createServerFn` does NOT work from mobile apps**. The function posts to `/__server` on the current origin, which doesn't exist in a native app context.

**Required for any native approach:**
1. Expose REST API routes in `src/routes/api/` as a parallel API surface
2. Abstract business logic into `src/server/` callable from both server functions (web) and API routes (mobile)
3. Add bearer token auth support (cookies unreliable in WebViews/native)
4. Configure CORS for native app origins (`capacitor://localhost`, `http://localhost`)

This API layer benefits the web app too (third-party integrations, webhooks) and is needed regardless of which mobile approach is chosen.

---

## Approach Details

### 1. Capacitor (Recommended)

**What:** Wraps the web app in a native WebView shell (WKWebView on iOS, Android WebView). Web assets bundled into native binary. Plugin bridge connects JS to native APIs.

**Key strengths for gameday:**
- Existing React + shadcn/ui + Tailwind renders directly — no UI rewrite
- TanStack Start supports SPA build mode for Capacitor
- Mature plugin ecosystem covers all gameday needs (camera, push, offline storage, barcode)
- Capacitor HTTP plugin bypasses CORS entirely for native builds
- OTA updates via Capgo without app store resubmission
- Capacitor 8.2.0 stable with Swift Package Manager, edge-to-edge Android

**Key risks:**
- `createServerFn` incompatible — API route layer required (Medium-High effort)
- Cookie auth broken in WebView — bearer tokens required
- Android WebView performance worse on low-end devices (app is form-heavy, so acceptable)
- No service workers on iOS WKWebView (not needed — assets bundled locally)

**Offline strategy:**
- App shell always offline (assets in binary)
- Capacitor SQLite plugin or IndexedDB for data cache
- Pre-cache competition data before gameday
- Queue submissions locally, upload on reconnect
- `@capacitor/background-runner` for background sync attempts

**Implementation phases:**
1. Foundation: API routes + bearer token auth + CORS
2. Capacitor shell: SPA build, iOS/Android projects, basic navigation
3. Native features: push notifications, direct video capture, QR check-in
4. Offline support: pre-cache data, queue submissions, background sync

### 2. React Native / Expo

**What:** Native UI framework using React paradigm. Platform-specific components (not WebView). Expo SDK provides managed workflow with cloud builds.

**Key strengths for gameday:**
- Best native performance (no WebView ceiling)
- expo-sqlite + Legend State provides robust offline-first architecture
- EAS Build handles iOS/Android builds without a Mac (30 free builds/month)
- Extensive Expo SDK: camera, push, biometric auth, keep-awake, haptics
- Strong offline sync patterns with WatermelonDB or Legend State

**Key risks:**
- Complete UI rewrite required — shadcn/ui, Tailwind, Radix all DOM-based
- ~40-60% code reuse (schemas, stores, utils share; all UI is new)
- Higher learning curve (React Native specifics, Metro bundler, native debugging)
- Push notifications require dev builds on SDK 53+ (no Expo Go)

**When to choose over Capacitor:**
- Complex animations/gestures needed beyond form entry
- App grows beyond gameday into daily gym tool with rich interactions
- Native performance matters (large scrolling lists with complex layouts)

### 3. Tauri 2.0 Mobile

**What:** Rust backend + native WebView. Same web frontend in the webview, Rust handles native APIs via plugin system.

**Key strengths:**
- Web frontend reuse from existing codebase
- Rust backend for performance-sensitive scoring calculations
- Small bundle size (native webview, no bundled engine)
- SQLite offline via tauri-plugin-sql

**Key risks:**
- Mobile ecosystem maturity behind Capacitor/React Native
- iOS development experience described as painful by community
- No automated CI/CD for mobile builds (tauri-action not yet supported)
- Smaller community, fewer production mobile apps as references
- Requires Rust expertise for native plugin development

**Verdict:** Viable but risky. Functional for motivated teams, not yet battle-tested. Consider only if team wants long-term Rust investment for performance-sensitive features.

### 4. PWA (Progressive Web App)

**What:** Enhanced web app with service worker for offline, manifest for install, Web Push for notifications.

**Key strengths:**
- Zero install — athletes access via URL, add to home screen
- Same codebase, same deploy, no app store process
- manifest.json already exists in the codebase with proper icons
- Camera/MediaRecorder fully supported on all modern browsers
- Android: native install prompt, reliable offline, Play Store via TWA
- iOS 26 improves installed PWA experience

**Key risks:**
- iOS cache eviction after ~7 days of inactivity (unreliable offline for infrequent users)
- No Background Sync API on iOS
- TanStack Start + vite-plugin-pwa broken in production (post-build workaround needed)
- iOS push only works for Home Screen-installed PWAs
- App Store distribution not viable (Apple hostile to PWA wrappers)
- Video upload at venues needs resumable upload (tus protocol)

**Best use:** Complementary to a native app. Athletes who don't want to download an app can use the PWA for basic viewing. Not reliable enough as the sole offline solution for gameday.

---

## Recommendation: Capacitor + PWA Complement

### Primary: Capacitor

Capacitor is the right choice for wodsmith-compete because:

1. **Highest code reuse** — existing React + shadcn/ui + Tailwind renders in WebView unchanged
2. **Fastest path to market** — no UI rewrite, just add API layer and native shell
3. **Adequate performance** — the app is forms, lists, and data display (Capacitor's sweet spot)
4. **Mature ecosystem** — battle-tested plugins for every gameday requirement
5. **Fits the stack** — stays in the web paradigm the team knows (TanStack Start, React 19)
6. **OTA updates** — push bug fixes during competition season without app store review

### Complementary: PWA

Add PWA support as a lightweight complement:
- Athletes who refuse to install an app get basic access via browser
- Post-build service worker with Workbox for offline caching
- Install onboarding for Home Screen PWA on iOS
- TWA packaging for Google Play Store (additional distribution channel)

### When to Reconsider

Upgrade to React Native/Expo if:
- WebView performance becomes a bottleneck (unlikely for form-heavy app)
- App scope expands to require complex native interactions
- Team has bandwidth for full UI rewrite

### Required Infrastructure (Any Approach)

Regardless of mobile approach, these changes are needed:

1. **API routes** in `src/routes/api/` — REST endpoints mirroring key server functions
2. **Bearer token auth** — extend session validation to accept `Authorization` header
3. **CORS configuration** — allow Capacitor origins on Workers
4. **Business logic extraction** — move logic from server functions to `src/server/` shared layer

Key API routes needed:

| Endpoint | Server Function Equivalent |
|----------|---------------------------|
| `GET /api/competitions/:slug/workouts` | `getPublishedCompetitionWorkoutsWithDetailsFn` |
| `GET /api/competitions/:slug/events/:eventId` | `getPublicEventDetailsFn` |
| `GET /api/submissions/:eventId` | `getVideoSubmissionFn` |
| `POST /api/submissions/:eventId` | `submitVideoFn` |
| `GET /api/submissions/status?events=...` | `getBatchSubmissionStatusFn` |
| `GET /api/athlete/profile` | `getAthleteProfileDataFn` |

---

## Sources

- Capacitor Documentation: capacitorjs.com/docs
- TanStack Start + Capacitor: dev.to/aaronksaunders/tanstack-start-to-mobile-building-robust-apps-with-capacitor-24ae
- Expo Documentation: docs.expo.dev
- Tauri 2.0 Mobile: v2.tauri.app/start/prerequisites
- Workbox Caching Strategies: developer.chrome.com/docs/workbox/caching-strategies-overview
- Capacitor 8 Release: ionic.io/blog/announcing-capacitor-8
- TanStack Start SPA Mode: tanstack.com/start/latest/docs/framework/react/guide/spa-mode
- @pushforge/builder (PWA push on Workers): github.com/nicejob/pushforge
- Bubblewrap (TWA): github.com/GoogleChromeLabs/bubblewrap
