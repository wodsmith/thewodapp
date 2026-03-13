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

## Sources

- Capacitor Documentation: capacitorjs.com/docs
- Expo Documentation: docs.expo.dev
- Apple SwiftUI: developer.apple.com/xcode/swiftui
- Flutter: flutter.dev
- Workbox: developer.chrome.com/docs/workbox
- TanStack Start SPA Mode: tanstack.com/start/latest/docs/framework/react/guide/spa-mode
