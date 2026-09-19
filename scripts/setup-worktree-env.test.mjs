import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { parseEnv } from "node:util"

const root = fileURLToPath(new URL("../", import.meta.url))
const databaseUrl =
  "mysql://user:password@dev.example.test/database?ssl=%7B%22rejectUnauthorized%22%3Atrue%7D"

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "worktree-env-test-"))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const script = join(directory, "scripts/setup-worktree-env.mjs")
  await mkdir(dirname(script), { recursive: true })
  await copyFile(join(root, "scripts/setup-worktree-env.mjs"), script)
  const databaseConfig = join(directory, "database.env")
  const typesafeConfig = join(directory, "typesafe.env")
  await writeFile(databaseConfig, `DATABASE_URL='${databaseUrl}'\n`)
  await writeFile(typesafeConfig, "TYPESAFE_API_KEY=test-key\n")
  const env = {
    ...process.env,
    WODSMITH_DATABASE_ENV_FILE: databaseConfig,
    WODSMITH_TYPESAFE_ENV_FILE: typesafeConfig,
  }
  const envPath = (app) => join(directory, "apps", app, ".dev.vars")
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: directory,
      env,
      encoding: "utf8",
    })
  return { directory, databaseConfig, typesafeConfig, env, envPath, run }
}

// @lat: [[worktree-environment-tests#Worktree environment tests#Literal secrets and existing settings]]
test("setup preserves literal secrets, normalizes duplicates, and retains unrelated settings", async (t) => {
  const f = await fixture(t)
  const specialUrl = databaseUrl.replace("password", () => `${randomUUID()}$$&`)
  const specialKey = "test$&key#with space"
  await writeFile(
    f.databaseConfig,
    ` export DATABASE_URL = '${specialUrl}' # dev\n`,
  )
  await writeFile(f.typesafeConfig, `TYPESAFE_API_KEY='${specialKey}'\n`)
  const unrelated =
    '# Keep this comment\r\nOTHER="line one\nDATABASE_URL=inside-another-value\nline three"\r\nSTRIPE_KEY=keep-me\r\n'
  for (const app of ["crew", "wodsmith-start"]) {
    await mkdir(dirname(f.envPath(app)), { recursive: true })
    await writeFile(
      f.envPath(app),
      unrelated +
        "DATABASE_URL=old\r\n export DATABASE_URL = stale # duplicate\r\nTYPESAFE_API_KEY=old-key\r\n",
      { mode: 0o644 },
    )
  }
  assert.equal(f.run().status, 0)
  for (const app of ["crew", "wodsmith-start"]) {
    const result = await readFile(f.envPath(app), "utf8")
    assert.ok(result.startsWith(unrelated))
    assert.equal(parseEnv(result).DATABASE_URL, specialUrl)
    assert.equal(
      parseEnv(result).TYPESAFE_API_KEY,
      app === "crew" ? "old-key" : specialKey,
    )
    assert.equal((await stat(f.envPath(app))).mode & 0o777, 0o600)
    assert.equal(f.run().status, 0)
    assert.equal(await readFile(f.envPath(app), "utf8"), result)
  }
  assert.equal(f.run("--check").status, 0)
})

// @lat: [[worktree-environment-tests#Worktree environment tests#Missing and rotated credentials]]
test("checks fail on missing or rotated credentials without writing files", async (t) => {
  const f = await fixture(t)
  assert.match(f.run("--check").stderr, /is missing.*setup:worktree/)
  assert.equal(f.run().status, 0)
  const before = await readFile(f.envPath("wodsmith-start"), "utf8")
  await writeFile(f.typesafeConfig, "TYPESAFE_API_KEY=rotated-key\n")
  const staleKey = f.run("--check")
  assert.equal(staleKey.status, 1)
  assert.match(staleKey.stderr, /stale TYPESAFE_API_KEY/)
  assert.ok(!staleKey.stderr.includes("rotated-key"))
  assert.equal(await readFile(f.envPath("wodsmith-start"), "utf8"), before)
  assert.equal(f.run().status, 0)
  await writeFile(
    f.databaseConfig,
    `DATABASE_URL=${databaseUrl.replace("password", "rotated-password")}\n`,
  )
  assert.match(f.run("--check").stderr, /stale DATABASE_URL/)
  assert.equal(f.run().status, 0)
  assert.equal(f.run("--check").status, 0)
  await writeFile(f.envPath("crew"), "OTHER=preserved\n")
  assert.match(
    f.run("--check", "--app", "crew").stderr,
    /must contain DATABASE_URL.*setup:worktree/,
  )
})

// @lat: [[worktree-environment-tests#Worktree environment tests#App selection]]
test("Crew setup does not require TypeSafe and unknown app names fail cleanly", async (t) => {
  const f = await fixture(t)
  await rm(f.typesafeConfig)
  assert.equal(f.run("--app", "crew").status, 0)
  assert.equal(f.run("--check", "--app", "crew").status, 0)
  assert.equal(f.run("--app", "wodsmith-start").status, 1)
  for (const app of ["unknown", "constructor", "__proto__"]) {
    assert.match(f.run("--app", app).stderr, /Unknown app/)
  }
  assert.match(f.run("--app").stderr, /Unknown app/)
})

// @lat: [[worktree-environment-tests#Worktree environment tests#Startup enforcement]]
test("pnpm dev commands check credentials before starting Vite or portless", async (t) => {
  const f = await fixture(t)
  await rm(f.databaseConfig)
  const bin = join(f.directory, "node_modules/.bin")
  await mkdir(bin, { recursive: true })
  for (const command of ["vite", "portless"]) {
    await writeFile(join(bin, command), "#!/bin/sh\necho SERVER_STARTED\n", {
      mode: 0o755,
    })
  }
  for (const app of ["crew", "wodsmith-start"]) {
    const directory = join(f.directory, "apps", app)
    await mkdir(directory, { recursive: true })
    const { scripts } = JSON.parse(
      await readFile(join(root, "apps", app, "package.json"), "utf8"),
    )
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({ name: app, scripts }),
    )
    for (const command of [
      "dev",
      ...(app === "wodsmith-start" ? ["dev:multi"] : []),
    ]) {
      const result = spawnSync("pnpm", ["--dir", directory, "run", command], {
        cwd: f.directory,
        env: { ...f.env, npm_config_enable_pre_post_scripts: "false" },
        encoding: "utf8",
      })
      assert.equal(result.status, 1, result.stdout + result.stderr)
      assert.match(
        result.stdout + result.stderr,
        /Shared database config not found/,
      )
      assert.ok(!result.stdout.includes("SERVER_STARTED"))
    }
  }
})
