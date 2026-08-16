import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { discoverRepository } from "./page-coverage/discovery.mjs"
import { renderLedgerJson, renderLedgerMarkdown } from "./page-coverage/render.mjs"
import { joinLedger, scaffoldPlan, validatePlan } from "./page-coverage/validation.mjs"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDirectory, "../../..")
const planPath = resolve(repoRoot, "docs/ui-library/page-coverage.plan.json")
const jsonPath = resolve(repoRoot, "docs/ui-library/page-coverage-ledger.json")
const markdownPath = resolve(repoRoot, "docs/ui-library/page-coverage-ledger.md")
const check = process.argv.includes("--check")
const scaffold = process.argv.includes("--scaffold")

async function readJson(path, fallback = null) {
  return JSON.parse(await readFile(path, "utf8").catch(() => JSON.stringify(fallback)))
}

const discovered = await discoverRepository(repoRoot)
let plan = await readJson(planPath)

if (scaffold) {
  plan = scaffoldPlan(discovered, plan)
  await mkdir(dirname(planPath), { recursive: true })
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`)
  console.log(`Updated ${relative(repoRoot, planPath)}.`)
}

if (!plan) {
  throw new Error(
    "Page coverage plan is missing. Run `pnpm page-coverage:scaffold` first.",
  )
}

await validatePlan(repoRoot, discovered, plan)
const ledger = joinLedger(discovered, plan)
const json = renderLedgerJson(ledger)
const markdown = renderLedgerMarkdown(ledger)

if (check) {
  const [currentJson, currentMarkdown] = await Promise.all([
    readFile(jsonPath, "utf8").catch(() => ""),
    readFile(markdownPath, "utf8").catch(() => ""),
  ])
  const stale = []
  if (currentJson !== json) stale.push(relative(repoRoot, jsonPath))
  if (currentMarkdown !== markdown) stale.push(relative(repoRoot, markdownPath))
  if (stale.length) {
    throw new Error(
      `Page coverage ledger is stale: ${stale.join(", ")}. Run \`pnpm page-coverage:generate\`.`,
    )
  }
  console.log("Page coverage plan and generated ledgers are valid and current.")
} else {
  await Promise.all([writeFile(jsonPath, json), writeFile(markdownPath, markdown)])
  console.log(
    `Updated ${relative(repoRoot, jsonPath)} and ${relative(repoRoot, markdownPath)} (${ledger.length} records).`,
  )
}
