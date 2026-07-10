import { readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(scriptDirectory, "..")
const sourceRoot = resolve(appRoot, "src")
const uiRoot = resolve(sourceRoot, "components/ui")
const crewUiRoot = resolve(appRoot, "../crew/src/components/ui")
const packageUiRoot = resolve(appRoot, "../../packages/ui/src/components")
const outputPath = resolve(appRoot, "docs/ui-library-inventory.md")

const foundationModules = new Set([
  "alert",
  "avatar",
  "badge",
  "button",
  "card",
  "checkbox",
  "input",
  "label",
  "progress",
  "separator",
  "skeleton",
  "spinner",
  "table",
  "textarea",
])

const appAdapterModules = new Set([
  "file-upload",
  "image-upload",
  "list-item",
  "searchable-select",
  "video-url-input",
])

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name)
      if (entry.isDirectory()) return listSourceFiles(path)
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
    }),
  )
  return files.flat()
}

async function listPrimitiveModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(".tsx") &&
        !entry.name.endsWith(".stories.tsx"),
    )
    .map((entry) => entry.name.replace(/\.tsx$/, ""))
    .sort()
}

function classifyModule(moduleName) {
  if (foundationModules.has(moduleName)) return "foundation"
  if (appAdapterModules.has(moduleName)) return "app adapter"
  return "composition"
}

function consumerArea(path) {
  const sourcePath = relative(sourceRoot, path).replaceAll("\\", "/")
  if (sourcePath.startsWith("routes/")) return "route"
  if (sourcePath.startsWith("components/ui/")) return "ui"
  return "component"
}

async function collectConsumers(modules) {
  const sourceFiles = await listSourceFiles(sourceRoot)
  const consumers = new Map(
    modules.map((moduleName) => [
      moduleName,
      { route: new Set(), component: new Set(), ui: new Set() },
    ]),
  )
  const barrelConsumers = { route: new Set(), component: new Set(), ui: new Set() }

  for (const path of sourceFiles) {
    if (path.endsWith(".stories.tsx")) continue
    const source = await readFile(path, "utf8")
    const area = consumerArea(path)
    const importPattern = /from\s+["']@\/components\/ui(?:\/([^"']+))?["']/g

    for (const match of source.matchAll(importPattern)) {
      const moduleName = match[1]
      if (!moduleName) {
        barrelConsumers[area].add(path)
        continue
      }
      consumers.get(moduleName)?.[area].add(path)
    }
  }

  return { consumers, barrelConsumers }
}

async function compareCrewCopies(modules) {
  const crewModules = await listPrimitiveModules(crewUiRoot)
  const crewModuleSet = new Set(crewModules)
  const sharedModules = modules.filter((moduleName) => crewModuleSet.has(moduleName))
  const divergentModules = []

  for (const moduleName of sharedModules) {
    const [startSource, crewSource] = await Promise.all([
      readFile(resolve(uiRoot, `${moduleName}.tsx`), "utf8"),
      readFile(resolve(crewUiRoot, `${moduleName}.tsx`), "utf8"),
    ])
    if (startSource !== crewSource) divergentModules.push(moduleName)
  }

  return {
    crewModuleCount: crewModules.length,
    sharedModuleCount: sharedModules.length,
    identicalModuleCount: sharedModules.length - divergentModules.length,
    divergentModules,
  }
}

async function renderInventory() {
  const modules = await listPrimitiveModules(uiRoot)
  const packageModules = new Set(await listPrimitiveModules(packageUiRoot))
  const stories = new Set(
    (await readdir(uiRoot))
      .filter((name) => name.endsWith(".stories.tsx"))
      .map((name) => name.replace(/\.stories\.tsx$/, "")),
  )
  const { consumers, barrelConsumers } = await collectConsumers(modules)
  const crewComparison = await compareCrewCopies(modules)
  const routeConsumerFiles = new Set()
  const componentConsumerFiles = new Set()

  for (const moduleConsumers of consumers.values()) {
    for (const path of moduleConsumers.route) routeConsumerFiles.add(path)
    for (const path of moduleConsumers.component) componentConsumerFiles.add(path)
  }

  const rows = modules.map((moduleName) => {
    const moduleConsumers = consumers.get(moduleName)
    return `| \`${moduleName}\` | ${classifyModule(moduleName)} | ${packageModules.has(moduleName) ? "yes" : "—"} | ${moduleConsumers.route.size} | ${moduleConsumers.component.size} | ${moduleConsumers.ui.size} | ${stories.has(moduleName) ? "yes" : "—"} |`
  })

  const divergentSummary = crewComparison.divergentModules.length
    ? crewComparison.divergentModules.map((name) => `\`${name}\``).join(", ")
    : "none"

  return `# WODsmith UI Library Inventory

This generated inventory measures the shared package, compatibility adapters, and their consumers so later migration PRs can stay narrow and observable.

Regenerate with \`pnpm --filter wodsmith-start ui:inventory\` and verify it with \`pnpm --filter wodsmith-start check:ui-inventory\`.

## Scope summary

The Start app exposes ${modules.length} primitive import paths in \`src/components/ui\`. They are consumed directly by ${routeConsumerFiles.size} route-owned files and ${componentConsumerFiles.size} shared component files.

- \`@repo/ui\` owns ${packageModules.size} extracted primitive implementations under \`packages/ui/src/components\`.
- ${stories.size} primitive modules have representative Storybook stories.
- Direct barrel consumers: ${barrelConsumers.route.size + barrelConsumers.component.size + barrelConsumers.ui.size}.
- Crew exposes ${crewComparison.crewModuleCount} primitive import paths; ${crewComparison.sharedModuleCount} filenames overlap with Start and ${crewComparison.identicalModuleCount} of those adapters or app-local implementations are byte-identical.
- Divergent Start/Crew paths: ${divergentSummary}.

## Boundary classification

The classification is migration guidance, not a claim that every candidate is ready to extract unchanged.

- **foundation** — low-level visual or form primitives that are first candidates for a shared package.
- **composition** — reusable Radix/shadcn compositions that may need provider, portal, or browser-behavior review.
- **app adapter** — components with WODsmith-specific behavior or data contracts that remain app-owned unless their API is generalized deliberately.

## Primitive consumers

Counts are unique importing files. Route-owned components under \`src/routes\` count as routes; reusable components outside \`components/ui\` count as components.

| Primitive module | Classification | Shared package | Route files | Component files | UI dependencies | Story |
| --- | --- | --- | ---: | ---: | ---: | --- |
${rows.join("\n")}

## PR-2 migration constraint

This package-foundation PR keeps Start and Crew runtime imports stable through thin app-local re-exports. Storybook imports \`@repo/ui\` directly; stateful, overlay, form, and domain components stay app-owned for later reviewed slices.
`
}

const generated = await renderInventory()

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8").catch(() => "")
  if (current !== generated) {
    console.error(
      "UI library inventory is stale. Run `pnpm --filter wodsmith-start ui:inventory`.",
    )
    process.exitCode = 1
  } else {
    console.log("UI library inventory is up to date.")
  }
} else {
  await writeFile(outputPath, generated)
  console.log(`Updated ${relative(appRoot, outputPath)}.`)
}
