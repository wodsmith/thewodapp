import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  clientSafeImportViolations,
  isForbiddenServerBoundaryImport,
  staticImports,
} from "./boundary-rules.mjs"

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const repositoryRoot = resolve(packageRoot, "../..")
const baselinePath = join(
  packageRoot,
  "guardrails/server-boundary-baseline.json",
)

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

const errors = []
const clientSafeEntries = [
  join(packageRoot, "src/index.ts"),
  join(packageRoot, "src/core/index.ts"),
]

for (const { file, specifier } of clientSafeImportViolations({
  entryFiles: clientSafeEntries,
  sourceRoot: join(packageRoot, "src"),
})) {
  errors.push(
    `client-safe package import ${relative(repositoryRoot, file)} -> ${specifier}`,
  )
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
