import { readdir, readFile } from "node:fs/promises"
import { dirname, extname, relative, resolve, sep } from "node:path"
import {
  DOCS_APP,
  SERVICE_DECISIONS,
  SERVICE_APPS,
  TANSTACK_APPS,
  serviceRouteId,
} from "./config.mjs"

export function normalizeSourcePath(path) {
  return path.split(sep).join("/").replaceAll("\\", "/")
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? walk(path) : [path]
    }),
  )
  return nested.flat()
}

function extractLiteralCall(source, name) {
  const match = new RegExp(
    `${name}\\s*\\(\\s*[\"']([^\"']+)[\"']\\s*,?\\s*\\)`,
    "s",
  ).exec(source)
  return match?.[1] ?? null
}

function extractRouteOptions(source) {
  const call =
    /createFileRoute\s*\(\s*["'][^"']+["']\s*,?\s*\)\s*\(\s*\{/.exec(
      source,
    ) ?? /createRootRoute\s*\(\s*\{/.exec(source)
  if (!call) return ""
  const open = source.indexOf("{", call.index + call[0].lastIndexOf("{"))
  if (open === -1) return ""

  let depth = 0
  let quote = null
  let escaped = false
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (escaped) escaped = false
      else if (character === "\\") escaped = true
      else if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === "{") depth += 1
    if (character === "}") {
      depth -= 1
      if (depth === 0) return source.slice(open, index + 1)
    }
  }
  return source.slice(open)
}

export function canonicalTanstackPath(sourceRouteId) {
  if (sourceRouteId === "__root__") return "__root__"
  if (sourceRouteId === "/") return "/_index"
  return sourceRouteId.endsWith("/")
    ? `${sourceRouteId.slice(0, -1)}/_index`
    : sourceRouteId
}

export function tanstackUrlPattern(sourceRouteId) {
  if (sourceRouteId === "__root__") return "/"
  const segments = canonicalTanstackPath(sourceRouteId)
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "_index" && !segment.startsWith("_"))
    .map((segment) => {
      if (segment === "$") return "*"
      return segment.startsWith("$") ? `:${segment.slice(1)}` : segment
    })
  return segments.length ? `/${segments.join("/")}` : "/"
}

function isPathlessRoute(sourceRouteId) {
  if (sourceRouteId === "__root__" || sourceRouteId.endsWith("/")) return false
  return sourceRouteId.split("/").filter(Boolean).at(-1)?.startsWith("_") ?? false
}

export function classifyTanstackRoute({
  sourceRouteId,
  options,
  descendantIds,
}) {
  const hasComponent = /\bcomponent\s*:/.test(options)
  const hasServerHandlers = /\bserver\s*:\s*\{[\s\S]*?\bhandlers\s*:/.test(options)
  const urlPattern = tanstackUrlPattern(sourceRouteId)
  const isApi = urlPattern === "/api" || urlPattern.startsWith("/api/")
  const hasRedirect = /\bredirect\s*\(/.test(options)
  const hasDescendants = descendantIds.length > 0
  const indexId = sourceRouteId === "__root__" ? "/" : `${sourceRouteId}/`
  const hasIndex = descendantIds.includes(indexId)

  if (sourceRouteId === "__root__" || isPathlessRoute(sourceRouteId)) {
    return { kind: "layout", defaultDisposition: "layout-only" }
  }
  if (hasServerHandlers || isApi) {
    return { kind: "api", defaultDisposition: "non-visual" }
  }
  if (!hasComponent && hasRedirect) {
    return { kind: "redirect", defaultDisposition: "redirect-only" }
  }
  if (hasComponent && hasDescendants && hasIndex) {
    return { kind: "layout", defaultDisposition: "layout-only" }
  }
  if (hasComponent && hasDescendants) {
    return { kind: "page-layout", defaultDisposition: "unassessed" }
  }
  if (hasComponent) {
    return { kind: "page", defaultDisposition: "unassessed" }
  }
  return { kind: "unknown", defaultDisposition: null }
}

function parseGeneratedTree(source) {
  const imports = new Map()
  for (const match of source.matchAll(
    /import \{ Route as (\w+) \} from ['\"](.+?\/routes\/.+?)['\"]/g,
  )) {
    imports.set(match[1], match[2])
  }

  const routes = [{ sourceRouteId: "__root__", importName: "rootRouteImport" }]
  const moduleBlock = /declare module ['\"]@tanstack\/react-router['\"] \{([\s\S]*?)\n\}/.exec(
    source,
  )?.[1]
  if (!moduleBlock) throw new Error("Generated route tree has no FileRoutesByPath module")

  for (const match of moduleBlock.matchAll(
    /^\s*['\"]([^'\"]+)['\"]: \{[\s\S]*?^\s*id: ['\"]([^'\"]+)['\"][\s\S]*?^\s*preLoaderRoute: typeof (\w+)[\s\S]*?^\s*\}/gm,
  )) {
    if (match[1] !== match[2]) {
      throw new Error(`Generated route key/id mismatch: ${match[1]} != ${match[2]}`)
    }
    routes.push({ sourceRouteId: match[2], importName: match[3] })
  }
  return { imports, routes }
}

async function resolveRouteSource(treeDirectory, importPath) {
  const base = resolve(treeDirectory, importPath)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
    try {
      await readFile(candidate)
      return candidate
    } catch {}
  }
  throw new Error(`Generated route source does not exist: ${importPath}`)
}

export async function discoverTanstackApp(repoRoot, appConfig) {
  const packageRoot = resolve(repoRoot, appConfig.packagePath)
  const treePath = resolve(packageRoot, "src/routeTree.gen.ts")
  const treeSource = await readFile(treePath, "utf8")
  const { imports, routes } = parseGeneratedTree(treeSource)
  const treeIds = routes.map((route) => route.sourceRouteId)
  const duplicateTreeIds = treeIds.filter((id, index) => treeIds.indexOf(id) !== index)
  if (duplicateTreeIds.length) {
    throw new Error(
      `Colliding generated route IDs in ${appConfig.app}: ${duplicateTreeIds.join(", ")}`,
    )
  }
  const discovered = []

  for (const treeRoute of routes) {
    const importPath = imports.get(treeRoute.importName)
    if (!importPath) {
      throw new Error(`Missing generated import for ${appConfig.app}:${treeRoute.sourceRouteId}`)
    }
    const sourcePath = await resolveRouteSource(dirname(treePath), importPath)
    const source = await readFile(sourcePath, "utf8")
    const declaredId =
      treeRoute.sourceRouteId === "__root__"
        ? /createRootRoute\s*\(/.test(source)
          ? "__root__"
          : null
        : extractLiteralCall(source, "createFileRoute")
    if (declaredId !== treeRoute.sourceRouteId) {
      throw new Error(
        `Source/tree mismatch for ${normalizeSourcePath(relative(repoRoot, sourcePath))}: expected ${treeRoute.sourceRouteId}, found ${declaredId ?? "none"}`,
      )
    }
    const descendantIds = routes
      .map((route) => route.sourceRouteId)
      .filter((id) => {
        if (treeRoute.sourceRouteId === "__root__") return id !== "__root__"
        if (treeRoute.sourceRouteId.endsWith("/")) return false
        return id.startsWith(`${treeRoute.sourceRouteId}/`)
      })
    const classification = classifyTanstackRoute({
      sourceRouteId: treeRoute.sourceRouteId,
      options: extractRouteOptions(source),
      descendantIds,
    })
    discovered.push({
      routeId: `tanstack:${appConfig.app}:${canonicalTanstackPath(treeRoute.sourceRouteId)}`,
      app: appConfig.app,
      source: normalizeSourcePath(relative(repoRoot, sourcePath)),
      sourceRouteId: treeRoute.sourceRouteId,
      urlPattern: tanstackUrlPattern(treeRoute.sourceRouteId),
      kind: classification.kind,
      defaultDisposition: classification.defaultDisposition,
      descendantRouteIds: descendantIds.map(
        (id) => `tanstack:${appConfig.app}:${canonicalTanstackPath(id)}`,
      ),
    })
  }

  const routeFiles = (await walk(resolve(packageRoot, "src/routes"))).filter((path) =>
    [".ts", ".tsx"].includes(extname(path)),
  )
  const declarations = []
  for (const path of routeFiles) {
    const source = await readFile(path, "utf8")
    const fileId = extractLiteralCall(source, "createFileRoute")
    const rootId = /createRootRoute\s*\(/.test(source) ? "__root__" : null
    if (fileId || rootId) declarations.push({ id: fileId ?? rootId, path })
  }

  const treeSources = new Set(discovered.map((route) => resolve(repoRoot, route.source)))
  const orphan = declarations.filter((declaration) => !treeSources.has(declaration.path))
  if (orphan.length) {
    throw new Error(
      `Orphan source route declarations in ${appConfig.app}: ${orphan.map((item) => normalizeSourcePath(relative(repoRoot, item.path))).join(", ")}`,
    )
  }
  const duplicateIds = declarations
    .map((item) => item.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index)
  if (duplicateIds.length) {
    throw new Error(`Colliding source route IDs in ${appConfig.app}: ${duplicateIds.join(", ")}`)
  }

  return discovered
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return {}
  const end = source.indexOf("\n---", 4)
  if (end === -1) return {}
  return Object.fromEntries(
    source
      .slice(4, end)
      .split("\n")
      .map((line) => /^([\w-]+):\s*(.*?)\s*$/.exec(line))
      .filter(Boolean)
      .map((match) => {
        const value = match[2]
        return [match[1], value === "true" ? true : value === "false" ? false : value]
      }),
  )
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function normalizeRouteBasePath(value = "/") {
  const trimmed = String(value).trim().replace(/^\/+|\/+$/g, "")
  return trimmed ? `/${trimmed}` : "/"
}

function applyRouteBasePath(routeBasePath, urlPath) {
  const base = normalizeRouteBasePath(routeBasePath)
  if (base === "/") return urlPath
  return urlPath === "/" ? `${base}/` : `${base}${urlPath}`
}

export async function discoverDocs(repoRoot, docsConfig = DOCS_APP) {
  const routeBasePath = normalizeRouteBasePath(docsConfig.routeBasePath)
  if (docsConfig.packagePath) {
    const [docusaurusConfig, sidebars] = await Promise.all([
      readFile(resolve(repoRoot, docsConfig.packagePath, "docusaurus.config.ts"), "utf8"),
      readFile(resolve(repoRoot, docsConfig.packagePath, "sidebars.ts"), "utf8"),
    ])
    const configuredRouteBasePath = /routeBasePath:\s*['\"]([^'\"]+)['\"]/.exec(
      docusaurusConfig,
    )?.[1]
    if (
      !configuredRouteBasePath ||
      normalizeRouteBasePath(configuredRouteBasePath) !== routeBasePath
    ) {
      throw new Error(
        `${docsConfig.app} Docusaurus routeBasePath does not match ${routeBasePath}`,
      )
    }
    if (!/type:\s*['\"]autogenerated['\"]/.test(sidebars)) {
      throw new Error(`${docsConfig.app} must use an autogenerated docs sidebar`)
    }
  }
  const docsRoot = resolve(repoRoot, docsConfig.docsPath)
  const files = (await walk(docsRoot)).filter(
    (path) => path.endsWith(".md") || path.endsWith("_category_.json"),
  )
  const records = []
  for (const path of files) {
    const sourcePath = normalizeSourcePath(relative(repoRoot, path))
    const relativePath = normalizeSourcePath(relative(docsRoot, path))
    if (path.endsWith(".md")) {
      const frontmatter = parseFrontmatter(await readFile(path, "utf8"))
      const docId = String(frontmatter.id || relativePath.replace(/\.md$/, ""))
      const slug = String(frontmatter.slug || `/${docId}`)
      const draft = frontmatter.draft === true
      records.push({
        routeId: `docusaurus:${docsConfig.app}:${docId}`,
        app: docsConfig.app,
        source: sourcePath,
        sourceRouteId: docId,
        urlPattern: applyRouteBasePath(
          routeBasePath,
          slug.startsWith("/") ? slug : `/${slug}`,
        ),
        kind: draft ? "draft" : "page",
        defaultDisposition: draft ? "draft-only" : "unassessed",
        descendantRouteIds: [],
      })
      continue
    }

    const category = JSON.parse(await readFile(path, "utf8"))
    const categoryPath = relativePath.replace(/\/?_category_\.json$/, "")
    const generated = category.link?.type === "generated-index"
    const docId = `category/${categoryPath}`
    records.push({
      routeId: `docusaurus:${docsConfig.app}:${docId}`,
      app: docsConfig.app,
      source: sourcePath,
      sourceRouteId: docId,
      urlPattern: generated
        ? applyRouteBasePath(
            routeBasePath,
            `/category/${slugify(category.label)}`,
          )
        : null,
      kind: generated ? "page" : "navigation",
      defaultDisposition: generated ? "unassessed" : "navigation-only",
      descendantRouteIds: [],
    })
  }
  return records
}

export async function discoverServices(repoRoot, decisions = SERVICE_DECISIONS) {
  const records = []
  for (const decision of decisions) {
    const source = await readFile(resolve(repoRoot, decision.source), "utf8")
    const markers = decision.markers ?? [decision.marker]
    for (const marker of markers) {
      if (!source.includes(marker)) {
        throw new Error(`Service decision marker missing in ${decision.source}: ${marker}`)
      }
    }
    records.push({
      routeId: serviceRouteId(decision),
      app: decision.app,
      source: decision.source,
      sourceRouteId: decision.sourceRouteId,
      urlPattern: decision.urlPattern,
      kind: "service",
      defaultDisposition: "non-visual",
      descendantRouteIds: [],
    })
  }
  return records
}

export async function discoverRepository(repoRoot, options = {}) {
  const tanstackApps = options.tanstackApps ?? TANSTACK_APPS
  const docsApp = options.docsApp === undefined ? DOCS_APP : options.docsApp
  const serviceApps = options.serviceApps ?? SERVICE_APPS
  const serviceDecisions = options.serviceDecisions ?? SERVICE_DECISIONS
  const registrations = [
    ...tanstackApps.map((app) => ({ ...app, type: "tanstack" })),
    ...(docsApp?.packagePath ? [{ ...docsApp, type: "docusaurus" }] : []),
    ...serviceApps.map((app) => ({ ...app, type: "service" })),
  ]
  const duplicateRegistrations = registrations.filter(
    (registration, index) =>
      registrations.findIndex(
        (candidate) => candidate.packagePath === registration.packagePath,
      ) !== index,
  )
  if (duplicateRegistrations.length) {
    throw new Error(
      `Duplicate app registration: ${duplicateRegistrations.map((item) => item.packagePath).join(", ")}`,
    )
  }

  const appsRoot = resolve(repoRoot, "apps")
  const appPackages = (
    await Promise.all(
      (await readdir(appsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const packagePath = `apps/${entry.name}`
          try {
            const packageJson = JSON.parse(
              await readFile(resolve(repoRoot, packagePath, "package.json"), "utf8"),
            )
            return { packagePath, name: packageJson.name }
          } catch {
            return null
          }
        }),
    )
  ).filter(Boolean)
  const registrationByPath = new Map(
    registrations.map((registration) => [registration.packagePath, registration]),
  )
  const unregisteredPackages = appPackages.filter(
    (appPackage) => !registrationByPath.has(appPackage.packagePath),
  )
  const missingPackages = registrations.filter(
    (registration) =>
      !appPackages.some((appPackage) => appPackage.packagePath === registration.packagePath),
  )
  if (unregisteredPackages.length || missingPackages.length) {
    throw new Error(
      `App registry mismatch. Unregistered packages: ${unregisteredPackages.map((item) => item.packagePath).join(", ") || "none"}. Missing packages: ${missingPackages.map((item) => item.packagePath).join(", ") || "none"}.`,
    )
  }
  for (const appPackage of appPackages) {
    const registration = registrationByPath.get(appPackage.packagePath)
    if (registration.app !== appPackage.name) {
      throw new Error(
        `App registry name mismatch for ${appPackage.packagePath}: ${registration.app} != ${appPackage.name}`,
      )
    }
  }
  const registeredServiceNames = new Set(serviceApps.map((app) => app.app))
  const decisionServiceNames = new Set(serviceDecisions.map((decision) => decision.app))
  const unknownServiceDecisions = [...decisionServiceNames].filter(
    (app) => !registeredServiceNames.has(app),
  )
  const emptyServiceApps = [...registeredServiceNames].filter(
    (app) => !decisionServiceNames.has(app),
  )
  if (unknownServiceDecisions.length || emptyServiceApps.length) {
    throw new Error(
      `Service registry mismatch. Unknown decisions: ${unknownServiceDecisions.join(", ") || "none"}. Apps without decisions: ${emptyServiceApps.join(", ") || "none"}.`,
    )
  }

  const configuredPaths = new Set(tanstackApps.map((app) => app.packagePath))
  const routeTrees = (await walk(appsRoot)).filter((path) =>
    path.endsWith("/src/routeTree.gen.ts"),
  )
  const unregistered = routeTrees
    .map((path) => normalizeSourcePath(relative(repoRoot, dirname(dirname(path)))))
    .filter((packagePath) => !configuredPaths.has(packagePath))
  if (unregistered.length) {
    throw new Error(`Unregistered TanStack app package: ${unregistered.join(", ")}`)
  }

  const tanstack = (
    await Promise.all(tanstackApps.map((app) => discoverTanstackApp(repoRoot, app)))
  ).flat()
  const docs = docsApp ? await discoverDocs(repoRoot, docsApp) : []
  const services = await discoverServices(repoRoot, serviceDecisions)
  return [...tanstack, ...docs, ...services].sort((left, right) =>
    left.routeId.localeCompare(right.routeId),
  )
}
