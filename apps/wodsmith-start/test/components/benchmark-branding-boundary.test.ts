import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const appRoot = process.cwd().endsWith("apps/wodsmith-start")
  ? process.cwd()
  : join(process.cwd(), "apps/wodsmith-start")

const CUSTOMER_FACING_PATHS = [
  join(appRoot, "src/components"),
  join(appRoot, "src/routes/compete"),
  join(appRoot, "src/routes/_auth"),
  join(appRoot, "src/routes/_auth.tsx"),
  join(appRoot, "src/routes/index.tsx"),
  join(appRoot, "src/routes/privacy.tsx"),
  join(appRoot, "src/routes/terms.tsx"),
  join(appRoot, "src/routes/maintenance.tsx"),
]

function listSourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) {
    return /\.(ts|tsx)$/.test(path) ? [path] : []
  }
  return readdirSync(path).flatMap((entry) =>
    listSourceFiles(join(path, entry)),
  )
}

describe("benchmark customer-facing branding boundary", () => {
  it("does not add HillerFit-branded route or component copy", () => {
    const matches = CUSTOMER_FACING_PATHS.flatMap((path) =>
      listSourceFiles(path).flatMap((file) => {
        const contents = readFileSync(file, "utf8")
        return /HillerFit/i.test(contents) ? [file] : []
      }),
    )

    expect(matches).toEqual([])
  })
})
