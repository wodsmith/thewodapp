import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  clientSafeImportViolations,
  isForbiddenCoreImport,
  isForbiddenServerBoundaryImport,
} from "./boundary-rules.mjs"

// @lat: [[tests/shared-application-guardrails#Transitive Client Export Traversal]]
test("follows transitive re-exports from client-safe entry points", () => {
  const sourceRoot = mkdtempSync(join(tmpdir(), "wodsmith-boundaries-"))

  try {
    const entry = join(sourceRoot, "index.ts")
    writeFileSync(entry, 'export * from "./feature"\n')
    writeFileSync(join(sourceRoot, "feature.ts"), 'import "node:fs"\n')

    assert.deepEqual(
      clientSafeImportViolations({ entryFiles: [entry], sourceRoot }),
      [{ file: join(sourceRoot, "feature.ts"), specifier: "node:fs" }],
    )
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true })
  }
})

// @lat: [[tests/shared-application-guardrails#Directory Index Traversal]]
test("follows directory index re-exports without reading directories", () => {
  const sourceRoot = mkdtempSync(join(tmpdir(), "wodsmith-boundaries-"))

  try {
    const entry = join(sourceRoot, "index.ts")
    const feature = join(sourceRoot, "feature", "index.ts")
    mkdirSync(join(sourceRoot, "feature"))
    writeFileSync(entry, 'export * from "./feature"\n')
    writeFileSync(feature, 'import "node:fs"\n')

    assert.deepEqual(
      clientSafeImportViolations({ entryFiles: [entry], sourceRoot }),
      [{ file: feature, specifier: "node:fs" }],
    )
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true })
  }
})

// @lat: [[tests/shared-application-guardrails#JavaScript Specifier Source Traversal]]
test("follows JavaScript specifiers to TypeScript sources", () => {
  for (const [specifier, sourceName] of [
    ["./feature.js", "feature.ts"],
    ["./feature.js", "feature.tsx"],
    ["./feature.jsx", "feature.tsx"],
    ["./feature.mjs", "feature.mts"],
  ]) {
    const sourceRoot = mkdtempSync(join(tmpdir(), "wodsmith-boundaries-"))

    try {
      const entry = join(sourceRoot, "index.ts")
      const feature = join(sourceRoot, sourceName)
      writeFileSync(entry, `export * from "${specifier}"\n`)
      writeFileSync(feature, 'import "node:fs"\n')

      assert.deepEqual(
        clientSafeImportViolations({ entryFiles: [entry], sourceRoot }),
        [{ file: feature, specifier: "node:fs" }],
      )

      writeFileSync(join(sourceRoot, specifier), "export {}\n")
      assert.deepEqual(
        clientSafeImportViolations({ entryFiles: [entry], sourceRoot }),
        [{ file: feature, specifier: "node:fs" }],
        "TypeScript source takes precedence over emitted JavaScript",
      )
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true })
    }
  }
})

// @lat: [[tests/shared-application-guardrails#Bare Node Built-In Rejection]]
test("rejects bare Node built-ins from client-safe and server boundaries", () => {
  assert.equal(isForbiddenCoreImport("fs"), true)
  assert.equal(isForbiddenServerBoundaryImport("fs/promises"), true)
  assert.equal(isForbiddenCoreImport("fast-safe-stringify"), false)
})

// @lat: [[tests/shared-application-guardrails#Database Package Boundary Rejection]]
test("rejects the database package root and subpaths", () => {
  for (const specifier of ["@repo/wodsmith-db", "@repo/wodsmith-db/schema"]) {
    assert.equal(isForbiddenCoreImport(specifier), true)
    assert.equal(isForbiddenServerBoundaryImport(specifier), true)
  }

  assert.equal(isForbiddenCoreImport("@repo/not-wodsmith-db-safe"), false)
})

// @lat: [[tests/shared-application-guardrails#Sibling Server Module Rejection]]
test("rejects sibling server modules", () => {
  assert.equal(
    isForbiddenServerBoundaryImport("./crew-staffing-fns.server"),
    true,
  )
  assert.equal(isForbiddenServerBoundaryImport("./scores.server.ts"), true)
  assert.equal(isForbiddenServerBoundaryImport("./server-safe"), false)
})

// @lat: [[tests/shared-application-guardrails#Turbo Boundary Input Coverage]]
test("hashes guard inputs and both externally scanned server trees", () => {
  const turboConfig = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../turbo.json", import.meta.url)),
      "utf8",
    ),
  )
  const requiredInputs = [
    "scripts/**",
    "guardrails/**",
    "$TURBO_ROOT$/apps/crew/src/server-fns/**",
    "$TURBO_ROOT$/apps/wodsmith-start/src/server-fns/**",
  ]

  for (const task of ["test", "test:coverage"]) {
    for (const input of requiredInputs) {
      assert.equal(turboConfig.tasks[task].inputs.includes(input), true)
    }
  }
})
