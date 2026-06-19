import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const watchedApps = ["apps/wodsmith-start", "apps/crew"]
const ownershipPatterns = [
  {
    label: "mysqlTable definition",
    pattern: /\bmysqlTable\b/,
  },
  {
    label: "mysql-core import",
    pattern: /drizzle-orm\/mysql-core/,
  },
]

const problems = []

function collectFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      return collectFiles(path)
    }

    if (!entry.isFile() || !/\.[cm]?[jt]s$/.test(entry.name)) {
      return []
    }

    return [path]
  })
}

for (const app of watchedApps) {
  const drizzleConfig = join(app, "drizzle.config.ts")

  if (existsSync(drizzleConfig)) {
    problems.push(
      `${relative(process.cwd(), drizzleConfig)} must not exist; run Drizzle commands through packages/wodsmith-db.`,
    )
  }

  const dbDir = join(app, "src/db")

  if (!existsSync(dbDir) || !statSync(dbDir).isDirectory()) {
    continue
  }

  for (const file of collectFiles(dbDir)) {
    const text = readFileSync(file, "utf8")

    for (const { label, pattern } of ownershipPatterns) {
      if (pattern.test(text)) {
        problems.push(
          `${relative(process.cwd(), file)} contains ${label}; app DB files should be adapters or @repo/wodsmith-db shims only.`,
        )
      }
    }
  }
}

if (problems.length > 0) {
  console.error("WODsmith schema ownership check failed:")
  for (const problem of problems) {
    console.error(`- ${problem}`)
  }
  process.exit(1)
}

console.log(
  "WODsmith schema ownership check passed: app DB files are adapters/shims only.",
)
