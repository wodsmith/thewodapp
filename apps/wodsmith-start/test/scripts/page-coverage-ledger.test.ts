import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, resolve, win32 } from "node:path"
import { describe, expect, it } from "vitest"
// @ts-expect-error The production generator intentionally remains plain ESM.
import { AXES } from "../../scripts/page-coverage/config.mjs"
// @ts-expect-error The production generator intentionally remains plain ESM.
import * as discovery from "../../scripts/page-coverage/discovery.mjs"
// @ts-expect-error The production generator intentionally remains plain ESM.
import * as rendering from "../../scripts/page-coverage/render.mjs"
// @ts-expect-error The production generator intentionally remains plain ESM.
import * as validation from "../../scripts/page-coverage/validation.mjs"

const {
  canonicalTanstackPath,
  classifyTanstackRoute,
  discoverDocs,
  discoverRepository,
  discoverServices,
  discoverTanstackApp,
  normalizeSourcePath,
  tanstackUrlPattern,
} = discovery
const { renderLedgerJson, renderLedgerMarkdown, summarizeLedger } = rendering
const {
  isRepositoryRelativeRef,
  joinLedger,
  scaffoldPlan,
  validatePlan,
} = validation

const repoRoot = resolve(import.meta.dirname, "../../../..")

async function makeTempRepo() {
  return mkdtemp(resolve(tmpdir(), "page-coverage-"))
}

async function write(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents)
}

function generatedTree(
  routes: Array<{ id: string; name: string; source: string }>,
) {
  const imports = [
    "import { Route as rootRouteImport } from './routes/__root'",
    ...routes.map(
      (route) =>
        `import { Route as ${route.name}Import } from './routes/${route.source}'`,
    ),
  ].join("\n")
  const entries = routes
    .map(
      (route) => `    '${route.id}': {
      id: '${route.id}'
      path: '${route.id}'
      fullPath: '${route.id}'
      preLoaderRoute: typeof ${route.name}Import
      parentRoute: typeof rootRouteImport
    }`,
    )
    .join("\n")
  return `${imports}
declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
${entries}
  }
}
`
}

async function makeTanstackFixture(
  routes: Array<{
    id: string
    name: string
    source: string
    options?: string
    declarationId?: string
  }>,
) {
  const root = await makeTempRepo()
  const appRoot = resolve(root, "apps/example")
  await write(
    resolve(appRoot, "package.json"),
    JSON.stringify({ name: "example" }),
  )
  await write(
    resolve(appRoot, "src/routeTree.gen.ts"),
    generatedTree(routes),
  )
  await write(
    resolve(appRoot, "src/routes/__root.tsx"),
    "export const Route = createRootRoute({ component: Root })\n",
  )
  for (const route of routes) {
    await write(
      resolve(appRoot, `src/routes/${route.source}.tsx`),
      `export const Route = createFileRoute(\n  "${route.declarationId ?? route.id}",\n)({ ${route.options ?? "component: Page"} })\n`,
    )
  }
  return root
}

describe("page coverage discovery", () => {
  // @lat: [[ui-library#UI Library#Page coverage contract#Discovery identity]]
  it("preserves index, pathless, dynamic, and Windows-normalized identity", () => {
    expect(canonicalTanstackPath("/compete/$slug/")).toBe(
      "/compete/$slug/_index",
    )
    expect(tanstackUrlPattern("/compete/$slug/")).toBe("/compete/:slug")
    expect(tanstackUrlPattern("/_protected/settings/")).toBe("/settings")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/_protected",
        options: "{ component: Shell }",
        descendantIds: ["/_protected/settings"],
      }).kind,
    ).toBe("layout")
    expect(normalizeSourcePath("routes\\demo\\start.api-request.tsx")).toBe(
      "routes/demo/start.api-request.tsx",
    )
  })

  // @lat: [[ui-library#UI Library#Page coverage contract#Classification priority]]
  it("applies API, redirect, layout, page-layout, and page priority", () => {
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/mcp",
        options: "{ server: { handlers: {} }, component: Page }",
        descendantIds: [],
      }).kind,
    ).toBe("api")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/legacy",
        options: "{ beforeLoad: () => redirect({ to: '/' }) }",
        descendantIds: [],
      }).kind,
    ).toBe("redirect")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/retired-block",
        options:
          "{ /* } component: RetiredPage { */ beforeLoad: () => redirect({ to: '/' }) }",
        descendantIds: [],
      }).kind,
    ).toBe("redirect")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/retired-regex",
        options:
          "{ loader: () => /component: RetiredPage/.test('component: nope'), beforeLoad: () => redirect({ to: '/' }) }",
        descendantIds: [],
      }).kind,
    ).toBe("redirect")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/retired",
        options:
          "{ // component: RetiredPage\n beforeLoad: () => redirect({ to: '/' }) }",
        descendantIds: [],
      }).kind,
    ).toBe("redirect")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/events/$eventId",
        options: "{ component: Shell }",
        descendantIds: ["/events/$eventId/", "/events/$eventId/heats"],
      }).kind,
    ).toBe("layout")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/events",
        options: "{ component: EventList }",
        descendantIds: ["/events/$eventId"],
      }).kind,
    ).toBe("page-layout")
    expect(
      classifyTanstackRoute({
        sourceRouteId: "/events/new",
        options: "{ component: NewEvent }",
        descendantIds: [],
      }).kind,
    ).toBe("page")
  })

  // @lat: [[ui-library#UI Library#Page coverage contract#Tree and source reconciliation]]
  it("joins generated aliases to multiline source declarations one-to-one", async () => {
    const root = await makeTanstackFixture([
      { id: "/events", name: "Events", source: "events" },
      {
        id: "/events/$eventId/",
        name: "EventIndex",
        source: "events/$eventId/index",
      },
    ])
    const records = await discoverTanstackApp(root, {
      app: "example",
      packagePath: "apps/example",
    })
    expect(records.map((record: { sourceRouteId: string }) => record.sourceRouteId)).toEqual([
      "__root__",
      "/events",
      "/events/$eventId/",
    ])
  })

  it("rejects mismatched, orphaned, colliding, and missing route sources", async () => {
    const mismatch = await makeTanstackFixture([
      {
        id: "/expected",
        declarationId: "/actual",
        name: "Expected",
        source: "expected",
      },
    ])
    await expect(
      discoverTanstackApp(mismatch, {
        app: "example",
        packagePath: "apps/example",
      }),
    ).rejects.toThrow("Source/tree mismatch")

    const orphan = await makeTanstackFixture([])
    await write(
      resolve(orphan, "apps/example/src/routes/orphan.tsx"),
      'export const Route = createFileRoute("/orphan")({ component: Page })',
    )
    await expect(
      discoverTanstackApp(orphan, {
        app: "example",
        packagePath: "apps/example",
      }),
    ).rejects.toThrow("Orphan source route declarations")

    const collision = await makeTanstackFixture([
      { id: "/same", name: "One", source: "one" },
      { id: "/same", name: "Two", source: "two" },
    ])
    await expect(
      discoverTanstackApp(collision, {
        app: "example",
        packagePath: "apps/example",
      }),
    ).rejects.toThrow("Colliding generated route IDs")

    const missing = await makeTanstackFixture([
      { id: "/gone", name: "Gone", source: "gone" },
    ])
    await writeFile(
      resolve(missing, "apps/example/src/routeTree.gen.ts"),
      generatedTree([{ id: "/missing", name: "Missing", source: "missing" }]),
    )
    await expect(
      discoverTanstackApp(missing, {
        app: "example",
        packagePath: "apps/example",
      }),
    ).rejects.toThrow("Generated route source does not exist")
  })

  it("rejects an unregistered TanStack app package", async () => {
    const root = await makeTanstackFixture([])
    await expect(
      discoverRepository(root, {
        tanstackApps: [],
        docsApp: null,
        serviceApps: [],
        serviceDecisions: [],
      }),
    ).rejects.toThrow("App registry mismatch")
  })

  it("requires every app package to be registered exactly once", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/future/package.json"),
      JSON.stringify({ name: "future" }),
    )
    await expect(
      discoverRepository(root, {
        tanstackApps: [],
        docsApp: null,
        serviceApps: [],
        serviceDecisions: [],
      }),
    ).rejects.toThrow("Unregistered packages: apps/future")

    await expect(
      discoverRepository(root, {
        tanstackApps: [{ app: "future", packagePath: "apps/future" }],
        docsApp: {
          app: "future",
          packagePath: "apps/future",
          docsPath: "apps/future/docs",
        },
        serviceApps: [],
        serviceDecisions: [],
      }),
    ).rejects.toThrow("Duplicate app registration")
  })

  // @lat: [[ui-library#UI Library#Page coverage contract#Docs and service decisions]]
  it("discovers docs root slugs, drafts, generated categories, and navigation", async () => {
    const root = await makeTempRepo()
    await write(resolve(root, "docs/intro.md"), "---\nslug: /\n---\n# Intro\n")
    await write(
      resolve(root, "docs/draft.md"),
      "---\ndraft: true\n---\n# Draft\n",
    )
    await write(
      resolve(root, "docs/guides/setup.mdx"),
      '---\nslug: "/setup"\ntags:\n  - setup\nmetadata:\n  audience: organizer\n---\n# Setup\n',
    )
    await write(
      resolve(root, "docs/how-to/_category_.json"),
      JSON.stringify({
        label: "How-to Guides",
        link: { type: "generated-index" },
      }),
    )
    await write(
      resolve(root, "docs/how-to/athletes/_category_.json"),
      JSON.stringify({ label: "For Athletes" }),
    )
    const records = await discoverDocs(root, {
      app: "docs",
      docsPath: "docs",
      routeBasePath: "/guide",
    })
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          routeId: "docusaurus:docs:intro",
          urlPattern: "/guide/",
        }),
        expect.objectContaining({
          routeId: "docusaurus:docs:draft",
          urlPattern: "/guide/draft",
          kind: "draft",
        }),
        expect.objectContaining({
          routeId: "docusaurus:docs:guides/setup",
          urlPattern: "/guide/setup",
          kind: "page",
        }),
        expect.objectContaining({
          routeId: "docusaurus:docs:category/how-to",
          urlPattern: "/guide/category/how-to-guides",
          kind: "page",
        }),
        expect.objectContaining({
          routeId: "docusaurus:docs:category/how-to/athletes",
          urlPattern: null,
          kind: "navigation",
        }),
      ]),
    )
  })

  it("rejects Docusaurus routeBasePath drift", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/docs/package.json"),
      JSON.stringify({ name: "docs" }),
    )
    await write(
      resolve(root, "apps/docs/docusaurus.config.ts"),
      "export default { presets: [['classic', { docs: { routeBasePath: '/actual' } }]] }",
    )
    await write(
      resolve(root, "apps/docs/sidebars.ts"),
      "export default [{ type: 'autogenerated', dirName: '.' }]",
    )
    await write(resolve(root, "apps/docs/docs/intro.md"), "# Intro")
    await expect(
      discoverDocs(root, {
        app: "docs",
        packagePath: "apps/docs",
        docsPath: "apps/docs/docs",
        routeBasePath: "/expected",
      }),
    ).rejects.toThrow("Docusaurus routeBasePath does not match /expected")
  })

  it("keeps Hono, worker wildcard, and cron decisions as full service records", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/team-memory/src/index.ts"),
      "import { handleScheduled } from './routes/cron'; app.get('/health', health); export default { fetch: app.fetch, scheduled: handleScheduled }",
    )
    await write(
      resolve(root, "apps/team-memory/src/routes/cron.ts"),
      "if (event.cron === 'cron-a') runA(); if (event.cron === 'cron-b') runB()",
    )
    await write(
      resolve(root, "apps/og-worker/src/index.ts"),
      "export default { async fetch(request) { return fallback(request) } }",
    )
    const records = await discoverServices(root, [
      {
        app: "team-memory",
        source: "apps/team-memory/src/index.ts",
        sourceRouteId: "/health",
        protocol: "http",
        method: "GET",
        urlPattern: "/health",
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
        app: "team-memory",
        source: "apps/team-memory/src/routes/cron.ts",
        sourceRouteId: "*",
        protocol: "cron",
        method: "SCHEDULED",
        urlPattern: "cron-a | cron-b",
      },
    ])
    expect(records.map((record: { routeId: string }) => record.routeId)).toEqual([
      "service:team-memory:http:GET:/health",
      "service:og-worker:http:ANY:/*",
      "service:team-memory:cron:SCHEDULED:*",
    ])
  })

  it("rejects source-derived service surfaces missing from the registry", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/team-memory/src/index.ts"),
      "const app = new Hono(); app.get('/health', health); app.get('/new', added)",
    )
    await expect(
      discoverServices(root, [
        {
          app: "team-memory",
          source: "apps/team-memory/src/index.ts",
          sourceRouteId: "/health",
          protocol: "http",
          method: "GET",
          urlPattern: "/health",
          marker: "app.get('/health'",
        },
      ]),
    ).rejects.toThrow("Unregistered service surface")

    await write(
      resolve(root, "apps/og-worker/src/index.ts"),
      `export default { async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === "/health") return health()
        if (path === "/new-worker-path") return added()
        return fallback()
      } }`,
    )
    await expect(
      discoverServices(root, [
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
          sourceRouteId: "/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/*",
          marker: "async fetch(",
        },
      ]),
    ).rejects.toThrow("Unregistered service surface")
  })

  it("rejects chained Hono routes missing from the registry", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/team-memory/src/index.ts"),
      "const app = new Hono(); app.get('/health', health).post('/new', added)",
    )
    await expect(
      discoverServices(root, [
        {
          app: "team-memory",
          source: "apps/team-memory/src/index.ts",
          sourceRouteId: "/health",
          protocol: "http",
          method: "GET",
          urlPattern: "/health",
        },
      ]),
    ).rejects.toThrow("Unregistered service surface")
  })

  it("rejects Worker startsWith branches missing from the registry", async () => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/og-worker/src/index.ts"),
      `export default { async fetch(request) {
        const path = new URL(request.url).pathname
        if (path === "/health") return health()
        if (path.startsWith("/assets/")) return asset()
        return fallback()
      } }`,
    )
    await expect(
      discoverServices(root, [
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
          sourceRouteId: "/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/*",
        },
      ]),
    ).rejects.toThrow("Unregistered service surface")

    await write(
      resolve(root, "apps/og-worker/src/index.ts"),
      `export default { async fetch(request) {
        const path = new URL(request.url).pathname
        if (path.includes("/assets/")) return asset()
        return fallback()
      } }`,
    )
    await expect(
      discoverServices(root, [
        {
          app: "og-worker",
          source: "apps/og-worker/src/index.ts",
          sourceRouteId: "/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/*",
        },
      ]),
    ).rejects.toThrow("Unsupported OG Worker path predicate")
  })

  it.each([
    {
      syntax: "indirect",
      source: `export default { async fetch(request) {
        const path = new URL(request.url).pathname
        const isAsset = path.startsWith("/assets/")
        if (isAsset) return asset()
        return fallback()
      } }`,
    },
    {
      syntax: "inline",
      source: `export default { async fetch(request) {
        if (new URL(request.url).pathname === "/health") return health()
        return fallback()
      } }`,
    },
  ])(
    "rejects $syntax Worker pathname predicates missing from the registry",
    async ({ source }) => {
      const root = await makeTempRepo()
      await write(resolve(root, "apps/og-worker/src/index.ts"), source)
      await expect(
        discoverServices(root, [
          {
            app: "og-worker",
            source: "apps/og-worker/src/index.ts",
            sourceRouteId: "/*",
            protocol: "http",
            method: "ANY",
            urlPattern: "/*",
          },
        ]),
      ).rejects.toThrow("Unregistered service surface")
    },
  )

  it("rejects comment-only PostHog delegation", async () => {
    const root = await makeTempRepo()
    for (const ignored of [
      "/* proxyRequest(request) */",
      'const note = "proxyRequest(request)"',
    ]) {
      await write(
        resolve(root, "apps/posthog-proxy/src/index.ts"),
        `export default { async fetch(request) {
          ${ignored}
          return new Response("not proxied")
        } }`,
      )
      await expect(
        discoverServices(root, [
          {
            app: "posthog-proxy",
            source: "apps/posthog-proxy/src/index.ts",
            sourceRouteId: "/*",
            protocol: "http",
            method: "ANY",
            urlPattern: "/*",
          },
        ]),
      ).rejects.toThrow("PostHog proxy wildcard fetch delegation is missing")
    }
  })

  it.each([
    {
      syntax: "shadowed binding",
      body: `let response = new Response("not proxied")
        if (false) { const response = proxyRequest(request) }
        return response`,
    },
    {
      syntax: "partial delegation",
      body: `if (request.method === "GET") return proxyRequest(request)
        return new Response("not proxied")`,
    },
  ])("rejects PostHog $syntax", async ({ body }) => {
    const root = await makeTempRepo()
    await write(
      resolve(root, "apps/posthog-proxy/src/index.ts"),
      `import { proxyRequest } from "./proxy"
       export default { async fetch(request) { ${body} } }`,
    )
    await expect(
      discoverServices(root, [
        {
          app: "posthog-proxy",
          source: "apps/posthog-proxy/src/index.ts",
          sourceRouteId: "/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/*",
        },
      ]),
    ).rejects.toThrow("PostHog proxy wildcard fetch delegation is missing")
  })

  it("supports registered service syntax variants", async () => {
    const honoRoot = await makeTempRepo()
    await write(
      resolve(honoRoot, "apps/team-memory/src/index.ts"),
      "const app = new Hono(); app.get('/health', health).post('/new', added)",
    )
    await expect(
      discoverServices(honoRoot, [
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
          source: "apps/team-memory/src/index.ts",
          sourceRouteId: "/new",
          protocol: "http",
          method: "POST",
          urlPattern: "/new",
        },
      ]),
    ).resolves.toHaveLength(2)

    const workerRoot = await makeTempRepo()
    await write(
      resolve(workerRoot, "apps/og-worker/src/index.ts"),
      `export default { async fetch(request) {
        const path = new URL(request.url).pathname
        if (path.startsWith("/assets/")) return asset()
        return fallback()
      } }`,
    )
    await expect(
      discoverServices(workerRoot, [
        {
          app: "og-worker",
          source: "apps/og-worker/src/index.ts",
          sourceRouteId: "/assets/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/assets/*",
        },
        {
          app: "og-worker",
          source: "apps/og-worker/src/index.ts",
          sourceRouteId: "/*",
          protocol: "http",
          method: "ANY",
          urlPattern: "/*",
        },
      ]),
    ).resolves.toHaveLength(2)

    for (const source of [
      'import { proxyRequest } from "./proxy"; export default { async fetch(request) { return proxyRequest(request) } }',
      'import { proxyRequest } from "./proxy"; export default { async fetch(request) { const response = await proxyRequest(request); return response } }',
    ]) {
      const proxyRoot = await makeTempRepo()
      await write(resolve(proxyRoot, "apps/posthog-proxy/src/index.ts"), source)
      await expect(
        discoverServices(proxyRoot, [
          {
            app: "posthog-proxy",
            source: "apps/posthog-proxy/src/index.ts",
            sourceRouteId: "/*",
            protocol: "http",
            method: "ANY",
            urlPattern: "/*",
          },
        ]),
      ).resolves.toHaveLength(1)
    }
  })
})

describe("page coverage validation and rendering", () => {
  const page = {
    routeId: "tanstack:app:/items/$itemId",
    app: "app",
    source: "routes/items.tsx",
    sourceRouteId: "/items/$itemId",
    urlPattern: "/items/:itemId",
    kind: "page",
    defaultDisposition: "unassessed",
    descendantRouteIds: [],
  }

  it("enforces dynamic fixtures and required axis coverage without a cartesian product", async () => {
    const root = await makeTempRepo()
    const plan = scaffoldPlan([page])
    plan.entries[0].scenarios[0].params = {}
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "requires dynamic param itemId",
    )
    plan.entries[0].scenarios[0].params = { itemId: "fixture-item" }
    plan.entries[0].requirements.themes = ["light", "dark"]
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "missing required themes coverage: dark",
    )
  })

  it("rejects unknown axes, invalid blocked states, and verified evidence invariants", async () => {
    const root = await makeTempRepo()
    const plan = scaffoldPlan([page])
    const scenario = plan.entries[0].scenarios[0]
    scenario.persona = "ghost"
    await expect(validatePlan(root, [page], plan)).rejects.toThrow("unknown persona")
    scenario.persona = "unassessed"
    scenario.blockers = [{ code: "NOT_BLOCKED", detail: "pending must be clear" }]
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "pending scenario cannot have blockers",
    )
    scenario.blockers = []
    scenario.status = "blocked"
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "blocked scenario requires code/detail",
    )
    scenario.status = "verified"
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "verified scenario requires evidence",
    )

    await write(resolve(root, "evidence/page.png"), "evidence")
    scenario.evidence = [
      {
        kind: "unknown-kind",
        ref: "evidence/page.png",
        sha256: createHash("sha256").update("wrong").digest("hex"),
      },
    ]
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "evidence requires a known kind",
    )
    scenario.evidence[0].kind = "browser-screenshot"
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "evidence hash mismatch",
    )
  })

  it("rejects blank scenario IDs before duplicate validation", async () => {
    const root = await makeTempRepo()
    const plan = scaffoldPlan([page])
    plan.entries[0].scenarios[0].id = "   "
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "scenario IDs must be non-empty strings",
    )
    plan.entries[0].scenarios[0].id = 42
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "scenario IDs must be non-empty strings",
    )
  })

  it("requires portable repository-relative evidence refs", async () => {
    const root = await makeTempRepo()
    const plan = scaffoldPlan([page])
    const scenario = plan.entries[0].scenarios[0]
    await write(resolve(root, "evidence/page.png"), "evidence")
    scenario.status = "verified"
    scenario.evidence = [
      {
        kind: "browser-screenshot",
        ref: resolve(root, "evidence/page.png"),
        sha256: createHash("sha256").update("evidence").digest("hex"),
      },
    ]
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "evidence escapes the repository",
    )
    scenario.evidence[0].ref = "../outside.png"
    await expect(validatePlan(root, [page], plan)).rejects.toThrow(
      "evidence escapes the repository",
    )

    expect(
      isRepositoryRelativeRef(
        "C:\\repo",
        "evidence\\page.png",
        win32,
      ),
    ).toBe(true)
    expect(
      isRepositoryRelativeRef(
        "C:\\repo",
        "C:\\repo\\evidence\\page.png",
        win32,
      ),
    ).toBe(false)
    expect(
      isRepositoryRelativeRef("C:\\repo", "..\\outside.png", win32),
    ).toBe(false)
  })

  it("rejects dispositions that are incompatible with discovered kinds", async () => {
    const root = await makeTempRepo()
    const pagePlan = scaffoldPlan([page])
    pagePlan.entries[0].disposition = "non-visual"
    await expect(validatePlan(root, [page], pagePlan)).rejects.toThrow(
      "disposition non-visual is incompatible with page",
    )

    const api = {
      ...page,
      routeId: "tanstack:app:/api/items",
      sourceRouteId: "/api/items",
      urlPattern: "/api/items",
      kind: "api",
      defaultDisposition: "non-visual",
    }
    const apiPlan = scaffoldPlan([api])
    apiPlan.entries[0].disposition = "unassessed"
    await expect(validatePlan(root, [api], apiPlan)).rejects.toThrow(
      "disposition unassessed is incompatible with api",
    )
  })

  it("requires layout-only records to name a valid visual descendant", async () => {
    const root = await makeTempRepo()
    const layout = {
      ...page,
      routeId: "tanstack:app:/items",
      sourceRouteId: "/items",
      urlPattern: "/items",
      kind: "layout",
      defaultDisposition: "layout-only",
      descendantRouteIds: [page.routeId],
    }
    const plan = scaffoldPlan([layout, page])
    plan.entries.find((entry: { routeId: string }) => entry.routeId === layout.routeId)!.coveredBy = [
      "tanstack:app:/not-a-child",
    ]
    await expect(validatePlan(root, [layout, page], plan)).rejects.toThrow(
      "invalid coveredBy descendant",
    )
  })

  it("renders deterministically from sorted joined records", async () => {
    const root = await makeTempRepo()
    const other = { ...page, routeId: "tanstack:app:/alpha", sourceRouteId: "/alpha" }
    const discovered = [other, page].sort((left, right) =>
      left.routeId.localeCompare(right.routeId),
    )
    const plan = scaffoldPlan(discovered)
    await validatePlan(root, discovered, plan)
    const ledger = joinLedger(discovered, plan)
    expect(renderLedgerJson(ledger)).toBe(renderLedgerJson(ledger))
    expect(renderLedgerMarkdown(ledger)).toBe(renderLedgerMarkdown(ledger))
    expect(summarizeLedger(ledger)).toMatchObject({ total: 2, browser: 2 })
    expect(JSON.parse(renderLedgerJson(ledger)).records.map((record: { routeId: string }) => record.routeId)).toEqual([
      "tanstack:app:/alpha",
      "tanstack:app:/items/$itemId",
    ])
  })

  // @lat: [[ui-library#UI Library#Page coverage contract#Checked-in ledger gate]]
  it("matches the real checked-in plan and generated ledgers without hard-coded counts", async () => {
    const discovered = await discoverRepository(repoRoot)
    const plan = JSON.parse(
      await readFile(resolve(repoRoot, "docs/ui-library/page-coverage.plan.json"), "utf8"),
    )
    await validatePlan(repoRoot, discovered, plan)
    const ledger = joinLedger(discovered, plan)
    expect(await readFile(resolve(repoRoot, "docs/ui-library/page-coverage-ledger.json"), "utf8")).toBe(
      renderLedgerJson(ledger),
    )
    expect(await readFile(resolve(repoRoot, "docs/ui-library/page-coverage-ledger.md"), "utf8")).toBe(
      renderLedgerMarkdown(ledger),
    )
    expect(plan.axes).toEqual(AXES)
  })
})
