import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(packageRoot, "../..")
const baselinePath = join(packageRoot, "guardrails/server-boundary-baseline.json")

function fingerprint(violation) {
  return createHash("sha256").update(violation).digest("hex").slice(0, 20)
}

function sourceFiles(root, directory = root) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? sourceFiles(root, path) : [path]
    })
    .filter((path) => [".js", ".jsx", ".ts", ".tsx"].includes(extname(path)))
    .sort()
}

function staticImports(source) {
  const declaration =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g
  return [...source.matchAll(declaration)].map((match) => match[1])
}

function allImports(source) {
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  return [
    ...staticImports(source),
    ...[...source.matchAll(dynamicImport)].map((match) => match[1]),
  ]
}

function isForbiddenCoreImport(specifier) {
  return (
    specifier.startsWith("@/") ||
    specifier.startsWith("apps/") ||
    specifier.includes("/apps/") ||
    specifier.startsWith("@tanstack/") ||
    specifier === "react" ||
    specifier.startsWith("react/") ||
    specifier === "react-dom" ||
    specifier.startsWith("react-dom/") ||
    specifier.startsWith("@cloudflare/") ||
    specifier.startsWith("cloudflare:") ||
    specifier.startsWith("alchemy") ||
    specifier.startsWith("node:") ||
    specifier === "cookie" ||
    specifier.includes("/cookie") ||
    specifier.includes("wodsmith-db") ||
    specifier.includes("drizzle") ||
    specifier.includes("mysql") ||
    specifier.includes("stripe") ||
    specifier === "postmark" ||
    specifier === "resend"
  )
}

function isForbiddenServerBoundaryImport(specifier) {
  return (
    specifier === "cloudflare:workers" ||
    specifier.startsWith("node:") ||
    specifier.includes("@tanstack/react-start/server") ||
    /(^|\/)db(?:\/|$)/.test(specifier) ||
    /(^|\/)server(?:\/|$|\.)/.test(specifier) ||
    specifier.includes("mysql") ||
    specifier.includes("stripe")
  )
}

const errors = []
const clientSafePaths = [
  join(packageRoot, "src/index.ts"),
  join(packageRoot, "src/core"),
  join(packageRoot, "src/identity"),
  join(packageRoot, "src/scores"),
]

for (const candidate of clientSafePaths) {
  let files = []
  try {
    files = extname(candidate) ? [candidate] : sourceFiles(candidate)
  } catch {
    continue
  }

  for (const file of files) {
    for (const specifier of allImports(readFileSync(file, "utf8"))) {
      if (isForbiddenCoreImport(specifier)) {
        errors.push(
          `client-safe package import ${relative(repositoryRoot, file)} -> ${specifier}`,
        )
      }
    }
  }
}

const currentViolations = []
for (const app of ["crew", "wodsmith-start"]) {
  const root = join(repositoryRoot, `apps/${app}/src/server-fns`)
  for (const file of sourceFiles(root)) {
    for (const specifier of staticImports(readFileSync(file, "utf8"))) {
      if (isForbiddenServerBoundaryImport(specifier)) {
        currentViolations.push(
          `${relative(repositoryRoot, file).replaceAll("\\", "/")}|${specifier}`,
        )
      }
    }
  }
}

const baseline = new Set(
  JSON.parse(readFileSync(baselinePath, "utf8")).allowedViolationFingerprints,
)
const currentSet = new Set(currentViolations)
const currentFingerprints = new Set([...currentSet].map(fingerprint))
const newViolations = [...currentSet]
  .filter((violation) => !baseline.has(fingerprint(violation)))
  .sort()

for (const violation of newViolations) {
  errors.push(`new static server-boundary violation ${violation}`)
}

if (errors.length > 0) {
  console.error("Shared application boundary guard failed:\n")
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const removedDebt = [...baseline].filter(
  (allowed) => !currentFingerprints.has(allowed),
).length
console.log(
  `Shared application boundary guard passed (${currentSet.size} known violations, ${removedDebt} removed).`,
)
