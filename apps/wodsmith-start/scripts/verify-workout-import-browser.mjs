import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import mysql from "mysql2/promise"
import { chromium } from "playwright"
import { expect } from "@playwright/test"

// Real app HTTP/socket/save verification with fixture-seeded model proposals.
// This cannot run against an application/production database or remote server.
const baseURL = process.env.WODSMITH_IMPORT_BROWSER_URL ?? "http://localhost:33317"
const url = new URL(baseURL)
assert(["localhost", "127.0.0.1"].includes(url.hostname), "Browser verification requires loopback")
const port = Number(process.env.WODSMITH_IMPORT_BROWSER_MYSQL_PORT ?? 33316)
const db = await mysql.createConnection({ host: "127.0.0.1", port, user: "root", database: "workout_import_browser", timezone: "Z" })
const browser = await chromium.launch()
const output = "/tmp/workout-import-browser-evidence"
await mkdir(output, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.setDefaultTimeout(30_000)
const actor = "e2e_test_user"
const personal = "e2e_personal_team_test"
const gym = "e2e_test_team"
const [originalEntitlements] = await db.execute("SELECT * FROM team_feature_entitlements WHERE team_id IN (?,?) AND feature_id IN (SELECT id FROM features WHERE `key`='ai_workout_import')", [personal, gym])
const [originalTrackingOverrides] = await db.execute("SELECT * FROM team_entitlement_overrides WHERE team_id=? AND type='feature' AND `key`='workout_tracking'", [gym])

async function grant(teamId, enabled) {
  await db.execute("INSERT INTO team_feature_entitlements (id,team_id,feature_id,source,is_active,created_at,updated_at) SELECT ?,?,id,'override',?,UTC_TIMESTAMP(),UTC_TIMESTAMP() FROM features WHERE `key`='ai_workout_import' ON DUPLICATE KEY UPDATE is_active=VALUES(is_active),expires_at=NULL", [`browser_import_${teamId}`, teamId, enabled ? 1 : 0])
  const [rows] = await db.execute("SELECT is_active FROM team_feature_entitlements WHERE team_id=? AND feature_id IN (SELECT id FROM features WHERE `key`='ai_workout_import')", [teamId])
  assert.equal(rows.length, 1, "Seed the AI import feature catalog before browser verification")
  assert.equal(rows[0].is_active, enabled ? 1 : 0)
}

async function request(path, method = "GET", data) {
  return page.request.fetch(`${baseURL}${path}`, { method, headers: { Origin: url.origin }, ...(data ? { data } : {}) })
}

async function seedDraft(destination, name) {
  const response = await request("/api/workout-import/sessions", "POST", { destination })
  assert.equal(response.status(), 201, await response.text())
  const { importId } = await response.json()
  const [rows] = await db.execute("SELECT id FROM movements WHERE name='burpee' LIMIT 1")
  assert(rows.length, "Seed the catalog movements first")
  const workout = { name, description: "3 rounds for time: 10 burpees. Cap 15 minutes. Record one finish time or reps at cap.", scheme: "time-with-cap", scoreType: "min", timeCapSeconds: 900, roundsToScore: 1, repsPerRound: 10, tiebreakScheme: "time", scalingGroupId: null, movementIds: [rows[0].id] }
  const draft = { schemaVersion: 1, importId, revision: 1, requestId: randomUUID(), status: "ready", source: { text: workout.description }, extractedText: workout.description, workout, unresolved: [], warnings: [], changedFields: Object.keys(workout) }
  // Explicit test fixture; production inference normally publishes this row.
  await db.execute("UPDATE workout_import_sessions SET revision=1,proposal=? WHERE id=?", [JSON.stringify(draft), importId])
  const key = `workout-import:${actor}:${destination.kind === "personal" ? "personal" : `track:${destination.trackId}`}`
  await page.evaluate(({ key, importId }) => sessionStorage.setItem(key, importId), { key, importId })
  return { importId, workout }
}

async function reviewAndSave(label) {
  const dialog = page.getByRole("dialog")
  await expect(dialog.getByRole("button", { name: "Apply selected fields", exact: true })).toBeVisible({ timeout: 30_000 })
  await dialog.getByRole("button", { name: "Apply selected fields", exact: true }).click()
  await expect(dialog.getByLabel("Workout Name", { exact: true })).toHaveValue(/Browser import/)
  const sent = page.waitForRequest((request) => request.method() === "POST" && request.url().includes("/_serverFn/") && request.postData()?.includes("idempotencyKey"))
  await dialog.getByRole("button", { name: label, exact: true }).click()
  const request = await sent
  await expect(dialog).not.toBeVisible()
  return request
}

async function receipt(importId) {
  const [receipts] = await db.execute("SELECT * FROM workout_import_receipts WHERE import_id=?", [importId])
  assert.equal(receipts.length, 1)
  const [workouts] = await db.execute("SELECT * FROM workouts WHERE id=?", [receipts[0].workout_id])
  assert.equal(workouts[0].time_cap, 900)
  assert.equal(workouts[0].rounds_to_score, 1)
  assert.equal(workouts[0].reps_per_round, 10)
  assert.equal(workouts[0].tiebreak_scheme, "time")
  const [links] = await db.execute("SELECT * FROM workout_movements WHERE workout_id=?", [receipts[0].workout_id])
  assert.equal(links.length, 1)
  return receipts[0]
}

try {
  await page.goto(`${baseURL}/sign-in`)
  await page.waitForLoadState("networkidle")
  await page.getByLabel("Email", { exact: true }).fill("test@wodsmith.com")
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL((u) => !u.pathname.includes("sign-in"), { timeout: 30_000 })

  await grant(personal, false)
  await grant(gym, true)
  await page.goto(`${baseURL}/workouts/new`)
  await expect(page.getByRole("button", { name: "AI Workout Import access required", exact: true })).toBeDisabled()
  const denied = await request("/api/workout-import/sessions", "POST", { destination: { kind: "personal" } })
  assert.equal(denied.status(), 403, "Another team's grant must not permit personal imports")
  console.log("PASS wrong-team grant: locked UI and direct session denial")

  await grant(personal, true)
  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect(page.getByRole("button", { name: "Create with AI", exact: true })).toBeEnabled()
  const library = await seedDraft({ kind: "personal" }, `Browser import library ${randomUUID().slice(0, 8)}`)
  await page.reload()
  await page.waitForLoadState("networkidle")
  await page.getByRole("button", { name: "Create with AI", exact: true }).click()
  await expect(page.getByRole("button", { name: "Apply selected fields", exact: true })).toBeVisible({ timeout: 30_000 })
  await page.screenshot({ path: `${output}/library-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile document must not overflow horizontally")
  await page.screenshot({ path: `${output}/library-mobile.png`, fullPage: true })
  const librarySave = await reviewAndSave("Create workout")
  await page.waitForURL(/\/workouts\/workout_/, { timeout: 30_000 })
  const saved = await receipt(library.importId)
  assert.equal(saved.team_id, personal)
  console.log("PASS restored server proposal → review → real library save and scoring/movement roundtrip")
  const duplicate = await page.request.fetch(librarySave.url(), { method: "POST", headers: await librarySave.allHeaders(), data: librarySave.postData() })
  assert(duplicate.ok(), await duplicate.text())
  assert((await duplicate.text()).includes(saved.workout_id), "Duplicate save must return the committed workout")
  await receipt(library.importId)
  await grant(personal, false)
  const revokedRetry = await page.request.fetch(librarySave.url(), { method: "POST", headers: await librarySave.allHeaders(), data: librarySave.postData() })
  assert(!revokedRetry.ok() || !(await revokedRetry.text()).includes(saved.workout_id), "Revoked receipt replay must not succeed")
  const revokedSnapshot = await request(`/api/workout-import/sessions/${library.importId}`)
  assert.equal(revokedSnapshot.status(), 403)
  await receipt(library.importId)
  await grant(personal, true)
  console.log("PASS duplicate receipt replay, revoked retry and snapshot denial")

  await page.setViewportSize({ width: 1280, height: 900 })
  await db.execute("INSERT INTO team_entitlement_overrides (id,team_id,type,`key`,value,reason,created_at,updated_at) VALUES (?,?,'feature','workout_tracking','true','Disposable browser fixture',UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE value='true'", ["browser_gym_tracking", gym])
  const [franRows] = await db.execute("SELECT * FROM workouts WHERE id='e2e_workout_fran'")
  const fran = franRows[0]
  const originalItemId = `browser_fran_${randomUUID().slice(0, 8)}`
  const existingItems = [{ id: originalItemId, kind: "library", workoutId: fran.id, workout: { name: fran.name, description: fran.description ?? "", scheme: fran.scheme, scoreType: fran.score_type, timeCap: fran.time_cap, roundsToScore: fran.rounds_to_score, repsPerRound: fran.reps_per_round, tiebreakScheme: fran.tiebreak_scheme, scalingGroupId: fran.scaling_group_id } }]
  await db.execute("INSERT INTO personal_training_sessions (id,user_id,team_id,training_date,revision,items,created_at,updated_at) VALUES (?,?,?,'2026-09-01',1,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE items=VALUES(items),revision=revision+1", [`browser_personal_${randomUUID().slice(0, 8)}`, actor, gym, JSON.stringify(existingItems)])
  const [personalSessions] = await db.execute("SELECT * FROM personal_training_sessions WHERE user_id=? AND team_id=? AND training_date='2026-09-01'", [actor, gym])
  const personalSession = personalSessions[0]
  const logQuery = new URLSearchParams({ workoutId: fran.id, teamId: gym, date: "2026-09-01", personalSessionId: personalSession.id, personalItemId: originalItemId, personalRevision: String(personalSession.revision) })
  await page.goto(`${baseURL}/log/new?${logQuery}`)
  await page.waitForLoadState("networkidle")
  const logging = await seedDraft({ kind: "personal" }, `Browser import logging ${randomUUID().slice(0, 8)}`)
  await page.reload()
  await page.waitForLoadState("networkidle")
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-09-01")
  await page.getByLabel("Notes (optional)", { exact: true }).fill("Preserve this unsaved log note")
  await page.getByRole("button", { name: "Create with AI", exact: true }).click()
  await reviewAndSave("Create and use workout")
  const logged = await receipt(logging.importId)
  await page.waitForURL((u) => u.pathname === "/log/new" && u.searchParams.get("workoutId") === logged.workout_id)
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-09-01")
  await expect(page.getByLabel("Notes (optional)", { exact: true })).toHaveValue("Preserve this unsaved log note")
  const [updatedSessions] = await db.execute("SELECT items FROM personal_training_sessions WHERE id=?", [personalSession.id])
  const updatedItems = typeof updatedSessions[0].items === "string" ? JSON.parse(updatedSessions[0].items) : updatedSessions[0].items
  assert(updatedItems.some((item) => item.id === originalItemId), "Import must retain the existing occurrence")
  assert(updatedItems.some((item) => item.workoutId === logged.workout_id), "Imported workout must be added to the personal session")
  const [results] = await db.execute("SELECT id FROM personal_training_results WHERE personal_session_id=?", [personalSession.id])
  assert.equal(results.length, 0, "Create and use must not submit a result")
  console.log("PASS logging adds/selects saved workout, retains session date/notes and existing items, and creates no result")

  await db.execute("INSERT INTO team_entitlement_overrides (id,team_id,type,`key`,value,reason,created_at,updated_at) VALUES (?,?,'feature','workout_tracking','true','Disposable browser fixture',UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE value='true'", ["browser_gym_tracking", gym])
  const trackId = `browser_track_${randomUUID().slice(0, 8)}`
  await db.execute("INSERT INTO programming_tracks (id,name,type,owner_team_id,is_public,created_at,updated_at) VALUES (?,?,'team_owned',?,0,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [trackId, "Browser import track", gym])
  for (const [index, route] of ["settings/programming", "admin/teams/programming"].entries()) {
    await page.goto(`${baseURL}/${route}/${trackId}`)
    await page.waitForLoadState("networkidle")
    const imported = await seedDraft({ kind: "track", trackId }, `Browser import track ${index} ${randomUUID().slice(0, 8)}`)
    await page.getByRole("button", { name: "Add workout", exact: true }).click()
    await page.getByLabel("Track Order", { exact: true }).fill(String(index + 7))
    await page.getByLabel("Notes (optional)", { exact: true }).fill(`Preserved track notes ${index}`)
    await page.getByRole("button", { name: "Create with AI", exact: true }).click()
    await reviewAndSave("Create and add to track")
    await expect(page.getByRole("dialog")).not.toBeVisible()
    const savedTrack = await receipt(imported.importId)
    const [trackRows] = await db.execute("SELECT * FROM track_workouts WHERE id=?", [savedTrack.track_workout_id])
    assert.equal(trackRows[0].track_id, trackId)
    assert.equal(Number(trackRows[0].track_order), index + 7)
    assert.equal(trackRows[0].notes, `Preserved track notes ${index}`)
    assert.equal(savedTrack.team_id, gym)
    console.log(`PASS ${route}: atomic create/add, owner, order and notes`)
  }
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => undefined)
  console.error("Browser verification failed at", page.url())
  throw error
} finally {
  await browser.close()
  try {
    await db.beginTransaction()
    await db.execute("DELETE FROM team_feature_entitlements WHERE team_id IN (?,?) AND feature_id IN (SELECT id FROM features WHERE `key`='ai_workout_import')", [personal, gym])
    for (const row of originalEntitlements) await db.query("INSERT INTO team_feature_entitlements SET ?", row)
    await db.execute("DELETE FROM team_entitlement_overrides WHERE team_id=? AND type='feature' AND `key`='workout_tracking'", [gym])
    for (const row of originalTrackingOverrides) await db.query("INSERT INTO team_entitlement_overrides SET ?", row)
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  } finally {
    await db.end()
  }
}
