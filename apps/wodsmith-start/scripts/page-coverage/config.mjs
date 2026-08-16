export const PAGE_COVERAGE_VERSION = 1

export const TANSTACK_APPS = [
  { app: "wodsmith-start", packagePath: "apps/wodsmith-start" },
  { app: "crew", packagePath: "apps/crew" },
  { app: "crm", packagePath: "apps/crm" },
  { app: "ledger", packagePath: "apps/ledger" },
  { app: "wodsmith-gameday", packagePath: "apps/wodsmith-gameday" },
]

export const DOCS_APP = {
  app: "wodsmith-docs",
  packagePath: "apps/docs",
  docsPath: "apps/docs/docs",
  routeBasePath: "/",
}

export const SERVICE_APPS = [
  { app: "team-memory", packagePath: "apps/team-memory" },
  { app: "og-worker", packagePath: "apps/og-worker" },
  { app: "posthog-proxy", packagePath: "apps/posthog-proxy" },
]

export const AXES = {
  personas: ["unassessed", "public", "authenticated", "organizer", "admin"],
  fixtures: ["unassessed", "demo", "empty", "populated"],
  dataStates: ["unassessed", "default", "empty", "loading", "error"],
  themes: ["light", "dark"],
  viewports: ["desktop", "mobile"],
}

export const KINDS = [
  "page",
  "page-layout",
  "layout",
  "api",
  "redirect",
  "navigation",
  "draft",
  "service",
]

export const DISPOSITIONS = [
  "unassessed",
  "shared-library",
  "library-candidate",
  "route-specific",
  "layout-only",
  "redirect-only",
  "non-visual",
  "draft-only",
  "navigation-only",
]

export const SCENARIO_STATUSES = ["pending", "blocked", "verified"]

export const CAPTURE_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
}

export const EVIDENCE_KINDS = [
  "browser-screenshot",
  "accessibility-snapshot",
  "dom-snapshot",
  "console-log",
  "network-log",
  "redirect-trace",
  "capture-manifest",
]

export const SERVICE_DECISIONS = [
  {
    app: "team-memory",
    source: "apps/team-memory/src/index.ts",
    sourceRouteId: "/health",
    protocol: "http",
    method: "GET",
    urlPattern: "/health",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/observations.ts",
    sourceRouteId: "/observations",
    protocol: "http",
    method: "POST",
    urlPattern: "/observations",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/search.ts",
    sourceRouteId: "/search",
    protocol: "http",
    method: "GET",
    urlPattern: "/search",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/context.ts",
    sourceRouteId: "/context",
    protocol: "http",
    method: "GET",
    urlPattern: "/context",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/feedback.ts",
    sourceRouteId: "/feedback",
    protocol: "http",
    method: "POST",
    urlPattern: "/feedback",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/sessions.ts",
    sourceRouteId: "/sessions",
    protocol: "http",
    method: "POST",
    urlPattern: "/sessions",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/export.ts",
    sourceRouteId: "/export",
    protocol: "http",
    method: "GET",
    urlPattern: "/export",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/cron.ts",
    sourceRouteId: "*",
    protocol: "cron",
    method: "SCHEDULED",
    urlPattern: "0 6 * * * | 0 7 * * *",
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/health",
    protocol: "http",
    method: "ANY",
    urlPattern: "/health",
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/competition/:slug",
    protocol: "http",
    method: "ANY",
    urlPattern: "/competition/:slug",
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/*",
    protocol: "http",
    method: "ANY",
    urlPattern: "/*",
  },
  {
    app: "posthog-proxy",
    source: "apps/posthog-proxy/src/index.ts",
    sourceRouteId: "/*",
    protocol: "http",
    method: "ANY",
    urlPattern: "/*",
  },
]

export function serviceRouteId(decision) {
  return `service:${decision.app}:${decision.protocol}:${decision.method}:${decision.sourceRouteId}`
}
