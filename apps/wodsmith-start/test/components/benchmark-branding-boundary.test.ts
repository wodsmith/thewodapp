import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const appRoot = process.cwd().endsWith("apps/wodsmith-start")
  ? process.cwd()
  : join(process.cwd(), "apps/wodsmith-start")

const CUSTOMER_FACING_DIRS = [
  join(appRoot, "src/components"),
  join(appRoot, "src/routes/compete"),
]

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return listSourceFiles(path)
    return /\.(ts|tsx)$/.test(entry) ? [path] : []
  })
}

describe("benchmark customer-facing branding boundary", () => {
  it("does not add HillerFit-branded route or component copy", () => {
    const matches = CUSTOMER_FACING_DIRS.flatMap((dir) =>
      listSourceFiles(dir).flatMap((file) => {
        const contents = readFileSync(file, "utf8")
        return /HillerFit/i.test(contents) ? [file] : []
      }),
    )

    expect(matches).toEqual([])
  })
})
