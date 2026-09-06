import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdir } from "node:fs/promises"
import mysql from "mysql2/promise"
import { chromium } from "playwright"
import { expect } from "@playwright/test"

// Review regressions use only the existing disposable integration fixtures.
const baseURL = "http://localhost:33317"
const actor = "e2e_test_user"
const personal = "e2e_personal_team_test"
const db = await mysql.createConnection({ host: "127.0.0.1", port: 33316, user: "root", database: "workout_import_browser", timezone: "Z" })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.setDefaultTimeout(30_000)
const output = "/tmp/workout-import-review-evidence"
await mkdir(output, { recursive: true })
const storageKey = `workout-import:${actor}:personal`
const [originalEntitlements] = await db.execute("SELECT * FROM team_feature_entitlements WHERE team_id=? AND feature_id='feat_ai_workout_import'", [personal])
try {
  await db.execute("UPDATE team_feature_entitlements SET is_active=1,expires_at=NULL WHERE team_id=? AND feature_id='feat_ai_workout_import'", [personal])
  await page.goto(`${baseURL}/sign-in`)
  await page.waitForLoadState("networkidle")
  await page.getByLabel("Email", { exact: true }).fill("test@wodsmith.com")
  await page.getByLabel("Password", { exact: true }).fill("TestPassword123!")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL((url) => !url.pathname.includes("sign-in"))

  const [sessions] = await db.execute("SELECT id FROM workout_import_sessions WHERE user_id=? AND team_id=? LIMIT 1", [actor, personal])
  assert(sessions.length, "Run the integration browser fixtures first")
  const expiredId = sessions[0].id
  await db.execute("UPDATE workout_import_sessions SET expires_at='1970-01-01 00:00:00' WHERE id=?", [expiredId])
  const expired = await page.request.get(`${baseURL}/api/workout-import/sessions/${expiredId}`)
  assert.equal(expired.status(), 410)
  assert.deepEqual(await expired.json(), { error: { code: "source_expired" } })
  await page.goto(`${baseURL}/workouts/new`)
  await page.waitForLoadState("networkidle")
  await page.evaluate(({ storageKey, expiredId }) => sessionStorage.setItem(storageKey, expiredId), { storageKey, expiredId })
  await page.getByRole("button", { name: "Create with AI", exact: true }).click()
  await expect(page.getByText("This import source has expired or is unavailable. Upload the image again or paste the source text.", { exact: true })).toBeVisible()
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), storageKey), null)
  await page.getByRole("dialog").getByLabel("Workout text or image instructions").fill("100 burpees for time, cap 15 minutes")
  const created = page.waitForResponse((response) => response.url().endsWith("/api/workout-import/sessions") && response.request().method() === "POST")
  await page.getByRole("button", { name: "Read workout", exact: true }).click()
  const response = await created
  assert.equal(response.status(), 201, await response.text())
  const fresh = await response.json()
  assert.notEqual(fresh.importId, expiredId)
  await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBe(fresh.importId)
  await page.screenshot({ path: `${output}/expiry-recovery.png`, fullPage: true })
  await page.request.post(`${baseURL}/api/workout-import/sessions/${fresh.importId}/cancel`, { headers: { Origin: baseURL } })
  console.log("PASS expired owned session returns 410, clears stored provenance, and starts a fresh real Agent session")

  await db.execute("UPDATE team_feature_entitlements SET is_active=0 WHERE team_id=? AND feature_id='feat_ai_workout_import'", [personal])
  const denied = await page.request.get(`${baseURL}/api/workout-import/sessions/${expiredId}`)
  assert.equal(denied.status(), 403)
  assert.deepEqual(await denied.json(), { error: { code: "access_required" } })
  console.log("PASS revoked expired session remains an access denial")

  const [workouts] = await db.execute("SELECT id FROM workouts WHERE team_id=? AND name LIKE 'Browser import library%' ORDER BY created_at DESC LIMIT 1", [personal])
  assert(workouts.length, "Run the library import browser fixture first")
  const workoutId = workouts[0].id
  const suffix = randomUUID().slice(0, 8)
  const teamGroup = `review_team_${suffix}`
  const systemGroup = `review_system_${suffix}`
  const foreignGroup = `review_foreign_${suffix}`
  for (const [id, teamId, title, isSystem] of [
    [teamGroup, personal, `Review team ${suffix}`, 0],
    [systemGroup, null, `Review system ${suffix}`, 1],
    [foreignGroup, "e2e_test_team", `Review foreign ${suffix}`, 0],
  ]) {
    await db.execute("INSERT INTO scaling_groups (id,team_id,title,is_system,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [id, teamId, title, isSystem])
  }
  for (const [id, title] of [[teamGroup, `Review team ${suffix}`], [systemGroup, `Review system ${suffix}`]]) {
    await page.goto(`${baseURL}/workouts/${workoutId}/edit`)
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Scaling group (optional)", { exact: true }).click()
    await expect(page.getByRole("option", { name: `Review foreign ${suffix}`, exact: true })).toHaveCount(0)
    await page.getByRole("option", { name: title, exact: true }).click()
    await page.getByRole("button", { name: "Save changes", exact: true }).click()
    await page.waitForURL((url) => url.pathname === `/workouts/${workoutId}`)
    const [rows] = await db.execute("SELECT scaling_group_id FROM workouts WHERE id=?", [workoutId])
    assert.equal(rows[0].scaling_group_id, id)
  }
  console.log("PASS ordinary editor offers and persists team/system scaling choices after AI revocation, excluding foreign groups")
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => undefined)
  throw error
} finally {
  await browser.close()
  try {
    await db.beginTransaction()
    await db.execute("DELETE FROM team_feature_entitlements WHERE team_id=? AND feature_id='feat_ai_workout_import'", [personal])
    for (const row of originalEntitlements) await db.query("INSERT INTO team_feature_entitlements SET ?", row)
    await db.commit()
  } catch (error) {
    await db.rollback()
    throw error
  } finally {
    await db.end()
  }
}
