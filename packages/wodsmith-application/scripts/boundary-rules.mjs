import { readFileSync, statSync } from "node:fs"
import { builtinModules } from "node:module"
import { dirname, extname, resolve, sep } from "node:path"

const sourceExtensions = [".js", ".jsx", ".ts", ".tsx", ".mjs", ".mts"]
const nodeBuiltinRoots = new Set(
  builtinModules.map(
    (specifier) => specifier.replace(/^node:/, "").split("/")[0],
  ),
)

function isNodeBuiltin(specifier) {
  return nodeBuiltinRoots.has(specifier.replace(/^node:/, "").split("/")[0])
}

function isDatabasePackage(specifier) {
  return (
    specifier === "@repo/wodsmith-db" ||
    specifier.startsWith("@repo/wodsmith-db/")
  )
}

export function staticImports(source) {
  const declaration =
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g
  return [...source.matchAll(declaration)].map((match) => match[1])
}

export function allImports(source) {
  const dynamicImport = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  return [
    ...staticImports(source),
    ...[...source.matchAll(dynamicImport)].map((match) => match[1]),
  ]
}

export function isForbiddenCoreImport(specifier) {
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
    isNodeBuiltin(specifier) ||
    specifier === "cookie" ||
    specifier.includes("/cookie") ||
    isDatabasePackage(specifier) ||
    specifier.includes("drizzle") ||
    specifier.includes("mysql") ||
    specifier.includes("stripe") ||
    specifier === "postmark" ||
    specifier === "resend"
  )
}

export function isForbiddenServerBoundaryImport(specifier) {
  return (
    specifier === "cloudflare:workers" ||
    isNodeBuiltin(specifier) ||
    specifier.includes("@tanstack/react-start/server") ||
    isDatabasePackage(specifier) ||
    /(^|\/)db(?:\/|$)/.test(specifier) ||
    /(^|\/)server(?:\/|$|\.)/.test(specifier) ||
    /(^|\/)[^/]+\.server(?:\.[^/]*)?$/.test(specifier) ||
    specifier.includes("mysql") ||
    specifier.includes("stripe")
  )
}

function resolveLocalImport(importer, specifier) {
  if (!specifier.startsWith(".")) return null

  const target = resolve(dirname(importer), specifier)
  const extension = extname(target)
  const sourceSubstitutions = {
    ".js": [".ts", ".tsx", ".js", ".jsx"],
    ".jsx": [".tsx", ".jsx"],
    ".mjs": [".mts", ".mjs"],
  }[extension]
  const candidates = sourceSubstitutions
    ? sourceSubstitutions.map(
        (sourceExtension) =>
          `${target.slice(0, -extension.length)}${sourceExtension}`,
      )
    : sourceExtensions.includes(extension)
      ? [target]
      : [
          target,
          ...sourceExtensions.map((extension) => `${target}${extension}`),
          ...sourceExtensions.map((extension) =>
            resolve(target, `index${extension}`),
          ),
        ]

  return (
    candidates.find((candidate) =>
      statSync(candidate, { throwIfNoEntry: false })?.isFile(),
    ) ?? null
  )
}

export function clientSafeImportViolations({ entryFiles, sourceRoot }) {
  const normalizedSourceRoot = resolve(sourceRoot)
  const visited = new Set()
  const violations = []

  function visit(file) {
    const normalizedFile = resolve(file)
    if (visited.has(normalizedFile)) return
    visited.add(normalizedFile)

    for (const specifier of allImports(readFileSync(normalizedFile, "utf8"))) {
      if (isForbiddenCoreImport(specifier)) {
        violations.push({ file: normalizedFile, specifier })
      }

      const importedFile = resolveLocalImport(normalizedFile, specifier)
      if (
        importedFile &&
        (importedFile === normalizedSourceRoot ||
          importedFile.startsWith(`${normalizedSourceRoot}${sep}`))
      ) {
        visit(importedFile)
      }
    }
  }

  for (const entryFile of entryFiles) visit(entryFile)
  return violations
}
