import { readFile, mkdir, writeFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"

// Test-only source images; no model calls, uploads or application mutations.
const app = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = resolve(process.argv[2] ?? "/tmp/workout-import-evaluation")
const fixtures = JSON.parse(await readFile(resolve(app, "test/fixtures/workout-import/evaluation.json"), "utf8"))
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 }, deviceScaleFactor: 1 })
  const manifest = []
  for (const fixture of fixtures) {
    await page.setContent('<style>body{margin:0;background:#fff;color:#171717;font:26px/1.6 Arial,sans-serif}main{padding:48px;white-space:pre-wrap;overflow-wrap:anywhere}h1{font-size:19px;letter-spacing:2px;color:#555}</style><main><h1>WORKOUT PRESCRIPTION</h1><div id="source"></div></main>')
    await page.locator("#source").evaluate((element, text) => { element.textContent = text }, fixture.text)
    const imagePath = resolve(output, `${fixture.id}.png`)
    await page.locator("main").screenshot({ path: imagePath })
    manifest.push({ ...fixture, imagePath })
  }
  await writeFile(resolve(output, "manifest.json"), JSON.stringify(manifest, null, 2))
  console.log(`Rendered ${manifest.length} text/image pairs to ${output}`)
} finally {
  await browser.close()
}
