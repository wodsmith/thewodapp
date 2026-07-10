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

export const EVIDENCE_KINDS = [
  "browser-screenshot",
  "accessibility-snapshot",
  "dom-snapshot",
  "console-log",
  "network-log",
  "redirect-trace",
]

export const SERVICE_DECISIONS = [
  {
    app: "team-memory",
    source: "apps/team-memory/src/index.ts",
    sourceRouteId: "/health",
    protocol: "http",
    method: "GET",
    urlPattern: "/health",
    marker: "app.get('/health'",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/observations.ts",
    sourceRouteId: "/observations",
    protocol: "http",
    method: "POST",
    urlPattern: "/observations",
    marker: "observationRoutes.post('/'",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/search.ts",
    sourceRouteId: "/search",
    protocol: "http",
    method: "GET",
    urlPattern: "/search",
    marker: "searchRoutes.get(\"/\"",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/context.ts",
    sourceRouteId: "/context",
    protocol: "http",
    method: "GET",
    urlPattern: "/context",
    marker: "contextRoutes.get(\"/\"",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/feedback.ts",
    sourceRouteId: "/feedback",
    protocol: "http",
    method: "POST",
    urlPattern: "/feedback",
    marker: "feedbackRoutes.post('/'",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/sessions.ts",
    sourceRouteId: "/sessions",
    protocol: "http",
    method: "POST",
    urlPattern: "/sessions",
    marker: "sessionRoutes.post('/'",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/export.ts",
    sourceRouteId: "/export",
    protocol: "http",
    method: "GET",
    urlPattern: "/export",
    marker: "exportRoutes.get(\"/\"",
  },
  {
    app: "team-memory",
    source: "apps/team-memory/src/routes/cron.ts",
    sourceRouteId: "*",
    protocol: "cron",
    method: "SCHEDULED",
    urlPattern: "0 6 * * * | 0 7 * * *",
    markers: ["event.cron === '0 6 * * *'", "event.cron === '0 7 * * *'"],
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/health",
    protocol: "http",
    method: "ANY",
    urlPattern: "/health",
    marker: 'path === "/health"',
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/competition/:slug",
    protocol: "http",
    method: "ANY",
    urlPattern: "/competition/:slug",
    marker: "^\\/competition\\/([^/]+)$",
  },
  {
    app: "og-worker",
    source: "apps/og-worker/src/index.ts",
    sourceRouteId: "/*",
    protocol: "http",
    method: "ANY",
    urlPattern: "/*",
    marker: "return generateDefaultOG()",
  },
  {
    app: "posthog-proxy",
    source: "apps/posthog-proxy/src/index.ts",
    sourceRouteId: "/*",
    protocol: "http",
    method: "ANY",
    urlPattern: "/*",
    marker: "async fetch(",
  },
]

export function serviceRouteId(decision) {
  return `service:${decision.app}:${decision.protocol}:${decision.method}:${decision.sourceRouteId}`
}
