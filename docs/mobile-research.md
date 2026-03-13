# Mobile Research: wodsmith-compete Gameday App

## Tauri 2.0 Mobile

### Overview

Tauri 2.0 (stable since late 2024) extends its Rust + webview architecture to iOS and Android. Mobile apps use the OS native webview (WKWebView on iOS, Android System WebView on Android) with a Rust backend, keeping bundle sizes small and performance high compared to Electron-style approaches.

### Architecture: Rust + Webview

- **Frontend**: Any web framework (React, Vue, Svelte) runs in the native webview
- **Backend**: Rust process handles native APIs, file system, networking, and business logic
- **Plugin system**: Native code via JNI (Android) and FFI (iOS) for deeper platform integration
- **Hot Module Replacement**: Works on mobile devices and emulators during development

This maps well to wodsmith's existing TanStack Start + React stack. The web frontend could be shared or adapted from the existing codebase, with Rust handling native capabilities.

### Compatibility with Existing Web Stack

**Good fit:**
- Tauri is framework-agnostic: React/TanStack Router frontend would work in the webview
- Tailwind CSS, Shadcn UI, Radix primitives all render in the webview
- TypeScript/Zod validation schemas are reusable
- Vite-powered build system aligns with current tooling

**Challenges:**
- TanStack Start server functions (`createServerFn`) are server-side — mobile app would need a different data layer (REST API calls to the existing Workers backend instead of server functions)
- `cloudflare:workers` env access is server-only — mobile client would communicate via HTTP
- Would need a separate mobile entry point; can't just wrap the SSR app

### Offline Capabilities

**Local storage options:**
- **tauri-plugin-sql**: Official plugin supporting SQLite, MySQL, PostgreSQL via sqlx
- **SQLite**: File-based, works fully offline on both iOS and Android
- **Turso embedded replicas**: Local SQLite with cloud sync (Turso's offline writes in beta as of late 2024)
- **Custom Rust storage**: Full control via Rust backend for local data persistence

**For gameday use case:**
- Heat schedules, athlete rosters, and workout details can be cached locally
- Score entry could work offline and sync when connectivity returns
- SQLite on-device is reliable for this — no server dependency for reads

**Sync pattern:**
The recommended approach is local-first with background sync to the wodsmith API (Cloudflare Workers). The Tauri HTTP client plugin provides a fetch-like API for REST calls.

### Native APIs Available

Tauri 2.0 ships with plugins for:
- **Notifications** — push/local notifications for heat alerts
- **Dialogs** — native confirmation/alert dialogs
- **NFC** — potential for athlete check-in
- **Barcode reading** — QR code scanning for registration
- **Biometric authentication** — fingerprint/face unlock
- **Clipboard** — copy/paste support
- **Deep links** — app links for sharing heats/results

**Missing:**
- No widget support (iOS/Android home screen widgets)
- Not all desktop plugins are ported to mobile yet
- Background processing capabilities unclear

### Maturity for Production Mobile Apps

**Positive signals:**
- Stable 2.0 release (not alpha/beta)
- Active development with regular releases
- CLI tooling for iOS (`tauri ios dev/build`) and Android (`tauri android dev/build`)
- Code signing support for both platforms
- App Store and Google Play deployment documented
- APK and AAB build output supported

**Concerns:**
- Community feedback describes iOS development as painful ("worst developer experience in years" — largely due to Xcode/Apple ecosystem, not Tauri itself)
- Tauri team acknowledges mobile was "overpromised" and needs community iteration
- Automated CI/CD for mobile builds (tauri-action) not yet supported
- Smaller ecosystem than React Native or Capacitor for mobile-specific plugins
- Fewer production mobile apps as references compared to alternatives

**Verdict:** Early-production quality. Functional for motivated teams willing to work through rough edges, but not yet battle-tested at scale.

### Cloudflare/D1 Connectivity

D1 is not directly accessible from client apps — it requires a Cloudflare Worker proxy. The existing wodsmith Workers backend already provides this:

**Recommended pattern:**
1. Tauri mobile app uses HTTP client plugin (fetch-like API)
2. Calls existing wodsmith Cloudflare Workers endpoints
3. Workers access D1/KV as they do today
4. Authentication via existing session/token system

**No architectural change needed on the backend** — the mobile app would be another API client alongside the web app. Server functions would need REST API equivalents exposed as Worker routes.

### Comparison with Alternatives

| Factor | Tauri 2 Mobile | Capacitor | React Native |
|--------|---------------|-----------|--------------|
| Web stack reuse | High (webview) | High (webview) | Low (native UI) |
| Bundle size | Small (native webview) | Small (native webview) | Medium |
| Native API access | Growing plugin ecosystem | Mature plugin ecosystem | Extensive |
| Offline/SQLite | Yes (via plugin) | Yes (via plugin) | Yes (via libraries) |
| Production maturity (mobile) | Early | Mature | Mature |
| Community/ecosystem | Small but growing | Large (Ionic backing) | Very large |
| Rust backend | Yes (unique advantage) | No | No |
| CI/CD tooling | Limited | Mature (Appflow) | Mature (EAS) |
| Learning curve for team | Moderate (Rust needed for native) | Low (web-only) | High (React Native specifics) |

### Recommendation for wodsmith-compete Gameday App

**Tauri 2 mobile is a viable but risky choice for a gameday app.**

**Strengths for this use case:**
- Offline-first with SQLite aligns perfectly with competition venues (poor connectivity)
- Rust backend provides performance for real-time score processing
- Web frontend reuse from existing codebase reduces development effort
- Small bundle size is good for app distribution at events

**Risks:**
- Mobile ecosystem maturity is behind Capacitor/React Native
- iOS development experience is rough — more debugging time expected
- Limited CI/CD automation increases release overhead
- Smaller community means fewer answers when stuck

**If timeline is aggressive:** Consider Capacitor instead — it offers the same webview approach with a more mature mobile ecosystem and would allow even more code reuse from the existing TanStack Start frontend.

**If team wants to invest in Tauri long-term:** The Rust backend is a genuine differentiator for performance-sensitive features (real-time leaderboards, complex scoring calculations). The platform will mature, and early investment builds expertise.
