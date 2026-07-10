import { readdir, readFile } from "node:fs/promises"
import { dirname, extname, relative, resolve, sep } from "node:path"
import ts from "typescript"
import { parse as parseYaml } from "yaml"
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

function unwrapExpression(node) {
  let current = node
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression
  }
  return current
}

function parseRouteDefinition(source) {
  const sourceFile = ts.createSourceFile(
    "route.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let definition = null

  function visit(node) {
    if (definition || !ts.isCallExpression(node)) {
      ts.forEachChild(node, visit)
      return
    }
    const expression = unwrapExpression(node.expression)
    if (
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "createFileRoute"
    ) {
      const id = expression.arguments[0]
      const options = node.arguments[0]
      if (ts.isStringLiteralLike(id) && options) {
        definition = { id: id.text, options: options.getText(sourceFile) }
        return
      }
    }
    if (
      ts.isIdentifier(expression) &&
      expression.text === "createRootRoute" &&
      node.arguments[0]
    ) {
      definition = { id: "__root__", options: node.arguments[0].getText(sourceFile) }
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return definition
}

function propertyName(property) {
  const name = property.name
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name))
    ? name.text
    : null
}

function analyzeRouteOptions(options) {
  const sourceFile = ts.createSourceFile(
    "route-options.tsx",
    `const routeOptions = (${options})`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const statement = sourceFile.statements.find(ts.isVariableStatement)
  const declaration = statement?.declarationList.declarations[0]
  const initializer = declaration?.initializer
    ? unwrapExpression(declaration.initializer)
    : null
  if (!initializer || !ts.isObjectLiteralExpression(initializer)) {
    return { hasComponent: false, hasServerHandlers: false, hasRedirect: false }
  }

  const hasComponent = initializer.properties.some(
    (property) => propertyName(property) === "component",
  )
  const serverProperty = initializer.properties.find(
    (property) => propertyName(property) === "server",
  )
  const serverInitializer =
    serverProperty && ts.isPropertyAssignment(serverProperty)
      ? unwrapExpression(serverProperty.initializer)
      : null
  const hasServerHandlers = Boolean(
    serverInitializer &&
      ts.isObjectLiteralExpression(serverInitializer) &&
      serverInitializer.properties.some(
        (property) => propertyName(property) === "handlers",
      ),
  )
  let hasRedirect = false
  function findRedirect(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "redirect"
    ) {
      hasRedirect = true
      return
    }
    ts.forEachChild(node, findRedirect)
  }
  findRedirect(initializer)
  return { hasComponent, hasServerHandlers, hasRedirect }
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
  const { hasComponent, hasServerHandlers, hasRedirect } =
    analyzeRouteOptions(options)
  const urlPattern = tanstackUrlPattern(sourceRouteId)
  const isApi = urlPattern === "/api" || urlPattern.startsWith("/api/")
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
    const definition = parseRouteDefinition(source)
    const declaredId = definition?.id ?? null
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
      options: definition?.options ?? "",
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
    const definition = parseRouteDefinition(source)
    if (definition) declarations.push({ id: definition.id, path })
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
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)
  if (!match) return {}
  try {
    const parsed = parseYaml(match[1])
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
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
    (path) => /\.mdx?$/.test(path) || path.endsWith("_category_.json"),
  )
  const records = []
  for (const path of files) {
    const sourcePath = normalizeSourcePath(relative(repoRoot, path))
    const relativePath = normalizeSourcePath(relative(docsRoot, path))
    if (/\.mdx?$/.test(path)) {
      const frontmatter = parseFrontmatter(await readFile(path, "utf8"))
      const docId = String(frontmatter.id || relativePath.replace(/\.mdx?$/, ""))
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

const HTTP_ROUTE_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "all",
])

function parseTypescript(source, fileName = "source.ts") {
  return ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function staticString(node) {
  const value = node ? unwrapExpression(node) : null
  return value &&
    (ts.isStringLiteralLike(value) || ts.isNoSubstitutionTemplateLiteral(value))
    ? value.text
    : null
}

function callReceiverRoot(node) {
  const value = unwrapExpression(node)
  if (ts.isIdentifier(value)) return value.text
  if (ts.isCallExpression(value)) return callReceiverRoot(value.expression)
  if (ts.isPropertyAccessExpression(value)) {
    return callReceiverRoot(value.expression)
  }
  return null
}

function sourceRoutes(sourceFile, receiver) {
  const routes = []
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text
      if (
        HTTP_ROUTE_METHODS.has(method) &&
        callReceiverRoot(node.expression.expression) === receiver
      ) {
        const path = staticString(node.arguments[0])
        if (path === null) {
          throw new Error(
            `Team Memory ${receiver}.${method} route must use a static path`,
          )
        }
        routes.push({
          method: method === "all" ? "ANY" : method.toUpperCase(),
          path,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return routes
}

function joinServicePath(prefix, child) {
  const joined = `${prefix.replace(/\/$/, "")}/${child.replace(/^\//, "")}`
  return joined.length > 1 ? joined.replace(/\/$/, "") : "/"
}

function sourceImports(sourceFile) {
  const imports = new Map()
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const specifier = staticString(statement.moduleSpecifier)
    if (!specifier || !statement.importClause) continue
    if (statement.importClause.name) {
      imports.set(statement.importClause.name.text, specifier)
    }
    const bindings = statement.importClause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imports.set(element.name.text, specifier)
      }
    }
  }
  return imports
}

async function resolveSourceModule(sourcePath, specifier) {
  const base = resolve(dirname(sourcePath), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`]) {
    try {
      await readFile(candidate)
      return candidate
    } catch {}
  }
  throw new Error(`Service source import does not exist: ${specifier}`)
}

async function discoverTeamMemorySurfaces(repoRoot) {
  const indexPath = resolve(repoRoot, "apps/team-memory/src/index.ts")
  const indexSource = await readFile(indexPath, "utf8")
  const indexFile = parseTypescript(indexSource, indexPath)
  const imports = sourceImports(indexFile)
  const surfaces = sourceRoutes(indexFile, "app").map((route) => ({
    app: "team-memory",
    protocol: "http",
    method: route.method,
    sourceRouteId: route.path,
    urlPattern: route.path,
    source: normalizeSourcePath(relative(repoRoot, indexPath)),
  }))

  const mounts = []
  function visitMounts(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "route" &&
      callReceiverRoot(node.expression.expression) === "app"
    ) {
      const prefix = staticString(node.arguments[0])
      const mounted = node.arguments[1]
        ? unwrapExpression(node.arguments[1])
        : null
      if (prefix === null || !mounted || !ts.isIdentifier(mounted)) {
        throw new Error("Team Memory app.route must use a static path and imported router")
      }
      mounts.push({ prefix, receiver: mounted.text })
    }
    ts.forEachChild(node, visitMounts)
  }
  visitMounts(indexFile)

  for (const { prefix, receiver } of mounts) {
    const specifier = imports.get(receiver)
    if (!specifier) throw new Error(`Missing Team Memory import for ${receiver}`)
    const modulePath = await resolveSourceModule(indexPath, specifier)
    const moduleSource = await readFile(modulePath, "utf8")
    const moduleFile = parseTypescript(moduleSource, modulePath)
    for (const route of sourceRoutes(moduleFile, receiver)) {
      const path = joinServicePath(prefix, route.path)
      surfaces.push({
        app: "team-memory",
        protocol: "http",
        method: route.method,
        sourceRouteId: path,
        urlPattern: path,
        source: normalizeSourcePath(relative(repoRoot, modulePath)),
      })
    }
  }

  let scheduled = null
  function visitScheduled(node) {
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node) === "scheduled" &&
      ts.isIdentifier(unwrapExpression(node.initializer))
    ) {
      scheduled = unwrapExpression(node.initializer).text
      return
    }
    ts.forEachChild(node, visitScheduled)
  }
  visitScheduled(indexFile)
  if (scheduled) {
    const specifier = imports.get(scheduled)
    if (!specifier) throw new Error(`Missing Team Memory import for ${scheduled}`)
    const modulePath = await resolveSourceModule(indexPath, specifier)
    const moduleSource = await readFile(modulePath, "utf8")
    const moduleFile = parseTypescript(moduleSource, modulePath)
    const triggers = []
    function visitCron(node) {
      if (
        ts.isBinaryExpression(node) &&
        [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(
          node.operatorToken.kind,
        )
      ) {
        const leftCron =
          ts.isPropertyAccessExpression(unwrapExpression(node.left)) &&
          unwrapExpression(node.left).name.text === "cron"
        const rightCron =
          ts.isPropertyAccessExpression(unwrapExpression(node.right)) &&
          unwrapExpression(node.right).name.text === "cron"
        const trigger = leftCron
          ? staticString(node.right)
          : rightCron
            ? staticString(node.left)
            : null
        if (trigger !== null) triggers.push(trigger)
      }
      ts.forEachChild(node, visitCron)
    }
    visitCron(moduleFile)
    triggers.sort()
    if (!triggers.length) throw new Error("Team Memory scheduled handler has no cron triggers")
    surfaces.push({
      app: "team-memory",
      protocol: "cron",
      method: "SCHEDULED",
      sourceRouteId: "*",
      urlPattern: triggers.join(" | "),
      source: normalizeSourcePath(relative(repoRoot, modulePath)),
    })
  }
  return surfaces
}

function normalizeWorkerRegex(literal) {
  const body = literal.replace(/^\/\^/, "").replace(/\$\/[a-z]*$/, "")
  return body
    .replaceAll("\\/", "/")
    .replace(/\(\[\^\/?\]\+\)/g, ":param")
    .replace(/\(\.\*\??\)/g, ":param")
}

function findFetchMethod(sourceFile) {
  let fetchMethod = null
  function visit(node) {
    if (
      !fetchMethod &&
      ts.isMethodDeclaration(node) &&
      propertyName(node) === "fetch" &&
      node.body
    ) {
      fetchMethod = node
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return fetchMethod
}

function containsIdentifier(node, names) {
  let found = false
  function visit(current) {
    if (ts.isIdentifier(current) && names.has(current.text)) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

function workerPredicatePatterns(node, pathNames) {
  const expression = unwrapExpression(node)
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    return workerPredicatePatterns(expression.operand, pathNames)
  }
  if (ts.isBinaryExpression(expression)) {
    if (
      [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(
        expression.operatorToken.kind,
      )
    ) {
      return [
        ...workerPredicatePatterns(expression.left, pathNames),
        ...workerPredicatePatterns(expression.right, pathNames),
      ]
    }
    if (
      [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(
        expression.operatorToken.kind,
      )
    ) {
      const left = unwrapExpression(expression.left)
      const right = unwrapExpression(expression.right)
      if (ts.isIdentifier(left) && pathNames.has(left.text)) {
        const path = staticString(right)
        if (path !== null) return [path]
      }
      if (ts.isIdentifier(right) && pathNames.has(right.text)) {
        const path = staticString(left)
        if (path !== null) return [path]
      }
    }
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression)
  ) {
    const receiver = unwrapExpression(expression.expression.expression)
    const method = expression.expression.name.text
    if (ts.isIdentifier(receiver) && pathNames.has(receiver.text)) {
      if (method === "startsWith") {
        const prefix = staticString(expression.arguments[0])
        if (prefix !== null) return [`${prefix}*`]
      }
      if (method === "match") {
        const pattern = expression.arguments[0]
        if (pattern?.kind === ts.SyntaxKind.RegularExpressionLiteral) {
          return [normalizeWorkerRegex(pattern.getText())]
        }
      }
    }
    if (
      method === "test" &&
      expression.expression.expression.kind ===
        ts.SyntaxKind.RegularExpressionLiteral
    ) {
      const argument = expression.arguments[0]
      if (
        argument &&
        ts.isIdentifier(unwrapExpression(argument)) &&
        pathNames.has(unwrapExpression(argument).text)
      ) {
        return [
          normalizeWorkerRegex(expression.expression.expression.getText()),
        ]
      }
    }
  }
  if (containsIdentifier(expression, pathNames)) {
    throw new Error(`Unsupported OG Worker path predicate: ${expression.getText()}`)
  }
  return []
}

function discoverWorkerPatterns(fetchMethod) {
  const pathNames = new Set()
  function findPathNames(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isPropertyAccessExpression(unwrapExpression(node.initializer)) &&
      unwrapExpression(node.initializer).name.text === "pathname"
    ) {
      pathNames.add(node.name.text)
    }
    ts.forEachChild(node, findPathNames)
  }
  findPathNames(fetchMethod.body)

  const patterns = new Set()
  function visit(node) {
    if (ts.isIfStatement(node)) {
      for (const pattern of workerPredicatePatterns(node.expression, pathNames)) {
        patterns.add(pattern)
      }
    } else if (ts.isConditionalExpression(node)) {
      for (const pattern of workerPredicatePatterns(node.condition, pathNames)) {
        patterns.add(pattern)
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "match" &&
      containsIdentifier(node.expression.expression, pathNames)
    ) {
      for (const pattern of workerPredicatePatterns(node, pathNames)) {
        patterns.add(pattern)
      }
    } else if (
      ts.isSwitchStatement(node) &&
      ts.isIdentifier(unwrapExpression(node.expression)) &&
      pathNames.has(unwrapExpression(node.expression).text)
    ) {
      for (const clause of node.caseBlock.clauses) {
        if (ts.isDefaultClause(clause)) continue
        const path = staticString(clause.expression)
        if (path === null) {
          throw new Error("OG Worker path switch cases must use static strings")
        }
        patterns.add(path)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(fetchMethod.body)
  if (ts.isReturnStatement(fetchMethod.body.statements.at(-1))) {
    patterns.add("/*")
  }
  return [...patterns]
}

async function discoverOgWorkerSurfaces(repoRoot) {
  const sourcePath = resolve(repoRoot, "apps/og-worker/src/index.ts")
  const source = await readFile(sourcePath, "utf8")
  const sourceFile = parseTypescript(source, sourcePath)
  const fetchMethod = findFetchMethod(sourceFile)
  if (!fetchMethod) {
    throw new Error("OG Worker has no fetch handler")
  }
  const sourceName = normalizeSourcePath(relative(repoRoot, sourcePath))
  const patterns = discoverWorkerPatterns(fetchMethod)
  return patterns.map((path) => ({
    app: "og-worker",
    protocol: "http",
    method: "ANY",
    sourceRouteId: path,
    urlPattern: path,
    source: sourceName,
  }))
}

function unwrapAwait(node) {
  let value = unwrapExpression(node)
  while (ts.isAwaitExpression(value)) value = unwrapExpression(value.expression)
  return value
}

function isNamedCall(node, name) {
  const value = unwrapAwait(node)
  return (
    ts.isCallExpression(value) &&
    ts.isIdentifier(unwrapExpression(value.expression)) &&
    unwrapExpression(value.expression).text === name
  )
}

function fetchReturnsDelegation(fetchMethod, name) {
  const delegated = new Set()
  let returned = false
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isNamedCall(node.initializer, name)
    ) {
      delegated.add(node.name.text)
    }
    if (ts.isReturnStatement(node) && node.expression) {
      const expression = unwrapAwait(node.expression)
      if (
        isNamedCall(expression, name) ||
        (ts.isIdentifier(expression) && delegated.has(expression.text))
      ) {
        returned = true
      }
    }
    if (
      node !== fetchMethod.body &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node))
    ) {
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(fetchMethod.body)
  return returned
}

async function discoverPosthogProxySurfaces(repoRoot) {
  const sourcePath = resolve(repoRoot, "apps/posthog-proxy/src/index.ts")
  const source = await readFile(sourcePath, "utf8")
  const sourceFile = parseTypescript(source, sourcePath)
  const fetchMethod = findFetchMethod(sourceFile)
  if (!fetchMethod || !fetchReturnsDelegation(fetchMethod, "proxyRequest")) {
    throw new Error("PostHog proxy wildcard fetch delegation is missing")
  }
  return [
    {
      app: "posthog-proxy",
      protocol: "http",
      method: "ANY",
      sourceRouteId: "/*",
      urlPattern: "/*",
      source: normalizeSourcePath(relative(repoRoot, sourcePath)),
    },
  ]
}

function serviceMatchKey(surface) {
  const pattern = surface.sourceRouteId.replace(/(?:\$|:)[A-Za-z0-9_]+/g, ":param")
  return `${surface.app}:${surface.protocol}:${surface.method}:${pattern}`
}

export async function discoverServices(repoRoot, decisions = SERVICE_DECISIONS) {
  const apps = new Set(decisions.map((decision) => decision.app))
  const actual = []
  if (apps.has("team-memory")) actual.push(...(await discoverTeamMemorySurfaces(repoRoot)))
  if (apps.has("og-worker")) actual.push(...(await discoverOgWorkerSurfaces(repoRoot)))
  if (apps.has("posthog-proxy")) {
    actual.push(...(await discoverPosthogProxySurfaces(repoRoot)))
  }
  const unsupported = [...apps].filter(
    (app) => !["team-memory", "og-worker", "posthog-proxy"].includes(app),
  )
  if (unsupported.length) {
    throw new Error(`Unsupported service discovery app: ${unsupported.join(", ")}`)
  }

  const configuredByKey = new Map(
    decisions.map((decision) => [serviceMatchKey(decision), decision]),
  )
  const actualByKey = new Map(actual.map((surface) => [serviceMatchKey(surface), surface]))
  const unregistered = actual.filter(
    (surface) => !configuredByKey.has(serviceMatchKey(surface)),
  )
  const missing = decisions.filter(
    (decision) => !actualByKey.has(serviceMatchKey(decision)),
  )
  if (unregistered.length || missing.length) {
    throw new Error(
      `Service surface mismatch. Unregistered service surface: ${unregistered.map(serviceMatchKey).join(", ") || "none"}. Missing source surface: ${missing.map(serviceMatchKey).join(", ") || "none"}.`,
    )
  }

  return decisions.map((decision) => {
    const surface = actualByKey.get(serviceMatchKey(decision))
    if (decision.protocol === "cron" && surface.urlPattern !== decision.urlPattern) {
      throw new Error(
        `Service cron trigger mismatch for ${serviceRouteId(decision)}: ${surface.urlPattern}`,
      )
    }
    return {
      routeId: serviceRouteId(decision),
      app: decision.app,
      source: surface.source,
      sourceRouteId: decision.sourceRouteId,
      urlPattern: decision.urlPattern,
      kind: "service",
      defaultDisposition: "non-visual",
      descendantRouteIds: [],
    }
  })
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
