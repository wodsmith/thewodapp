import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

// Drizzle uses journal timestamps to decide which migrations have already run.
const directory = new URL("../mysql-migrations/", import.meta.url)
const journal = JSON.parse(await readFile(new URL("meta/_journal.json", directory), "utf8"))
let previousWhen = -1
let previousId = "00000000-0000-0000-0000-000000000000"
const snapshotIds = new Set()
for (const [index, entry] of journal.entries.entries()) {
  assert.equal(entry.idx, index, "Migration indices must be consecutive")
  assert.ok(Number.isSafeInteger(entry.when) && entry.when > previousWhen, `${entry.tag}: timestamp must increase to avoid a skipped migration`)
  const prefix = String(index).padStart(4, "0")
  assert.ok(entry.tag.startsWith(`${prefix}_`), `${entry.tag}: filename must match journal index`)
  await readFile(new URL(`${entry.tag}.sql`, directory), "utf8")
  const snapshot = JSON.parse(await readFile(new URL(`meta/${prefix}_snapshot.json`, directory), "utf8"))
  assert.equal(snapshot.prevId, previousId, `${entry.tag}: broken snapshot predecessor`)
  assert.ok(typeof snapshot.id === "string" && !snapshotIds.has(snapshot.id), `${entry.tag}: snapshot IDs must be unique`)
  snapshotIds.add(snapshot.id)
  previousId = snapshot.id
  previousWhen = entry.when
}
console.log(`Validated ${journal.entries.length} ordered migrations and their SQL/snapshot chain`)
