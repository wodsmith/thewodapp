import { spawn, execFileSync } from "node:child_process"
import {
  readFile,
  writeFile,
  mkdir,
  rm,
  access,
  rename,
} from "node:fs/promises"
import { openSync, closeSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, resolve } from "node:path"
import { createRequire } from "node:module"
import { X509Certificate } from "node:crypto"
import http from "node:http"
import https from "node:https"
import { setTimeout as delay } from "node:timers/promises"
import { configuration, portsFree, lanHost, secret } from "./config.mjs"
import { createInspectorProxy, sameSecret } from "./proxy.mjs"
import { seedFixture } from "./seed.mjs"

const script = fileURLToPath(import.meta.url)
const repo = resolve(dirname(script), "../..")
const args = process.argv.slice(2).filter((arg) => arg !== "--")
const command =
  args.find((arg) => ["ensure", "status", "stop", "_serve"].includes(arg)) ??
  "ensure"
const lan = args.includes("--lan")
const dir = join(repo, ".agent-local", lan ? "lan" : "desktop")
const manifestPath = join(dir, "manifest.json")
const lockPath = join(dir, "running")
const cleanEnv = Object.fromEntries(
  ["PATH", "HOME", "USER", "SHELL", "TMPDIR", "LANG", "LC_ALL"]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
)
Object.assign(cleanEnv, {
  WRANGLER_SEND_METRICS: "false",
  BROWSER: "none",
  NODE_OPTIONS: "--max-old-space-size=8192",
  WODSMITH_AGENT_LOCAL_DIR: dir,
})
process.umask(0o077)

async function json(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (error.code === "ENOENT") return undefined
    throw error
  }
}
async function save(path, value) {
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 })
  await rename(temp, path)
}
async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
function request(url, options = {}) {
  return new Promise((resolveRequest, reject) => {
    const req = (url.startsWith("https:") ? https : http).request(
      url,
      { timeout: 5000, ...options },
      (res) => {
        let body = ""
        res.on("data", (chunk) => {
          body += chunk
        })
        res.on("end", () => resolveRequest({ status: res.statusCode, body }))
      },
    )
    req.on("timeout", () => req.destroy(new Error("Request timed out")))
    req.on("error", reject)
    req.end()
  })
}
async function control(config, action = "status") {
  if (!config) return undefined
  try {
    const res = await request(`http://127.0.0.1:${config.base + 9}/${action}`, {
      method: action === "stop" ? "POST" : "GET",
      headers: { Authorization: `Bearer ${config.controlKey}` },
    })
    if (res.status !== 200) return undefined
    const result = JSON.parse(res.body)
    return result.identity === config.controlKey ? result : undefined
  } catch {
    return undefined
  }
}
function printReady(config, state) {
  console.log(
    `\nWodSmith agent environment: ${state.phase}\nApp: ${config.app}\nMCP: ${config.mcp}\nInspector: ${config.inspector}/connect/${config.accessKey}\n`,
  )
  if (state.fixture)
    console.log(
      `Sign in: ${state.fixture.email} / ${state.fixture.password}\nTraining week: ${state.fixture.week}\nget_training_week: ${JSON.stringify({ teamId: "team_agent_provider", trackId: "track_agent_local", startDate: state.fixture.week })}\n`,
    )
  console.log(
    `Logs and persistent data: ${dir}\nStop: pnpm agent:stop${lan ? " --lan" : ""}`,
  )
}
async function waitReady(config) {
  for (let attempt = 0; attempt < 240; attempt++) {
    const state = await control(config)
    if (state?.phase === "ready") {
      printReady(config, state)
      return
    }
    const failure = await json(join(dir, "failure.json"))
    if (failure) throw new Error(`${failure.message}\nSee logs in ${dir}`)
    await delay(1000)
  }
  throw new Error(
    `Startup is still pending. Check pnpm agent:status${lan ? " --lan" : ""} and ${dir}/supervisor.log`,
  )
}
async function ensure() {
  if (Number(process.versions.node.split(".")[0]) < 24)
    throw new Error("Node 24 or newer is required")
  if (process.platform === "win32")
    throw new Error("Use macOS, Linux, or WSL for the local MySQL supervisor")
  const hostIndex = args.indexOf("--host")
  if (hostIndex !== -1 && (!lan || !args[hostIndex + 1]))
    throw new Error("--host <private-IP> requires --lan")
  const host = lan
    ? lanHost(hostIndex === -1 ? undefined : args[hostIndex + 1])
    : "127.0.0.1"
  await mkdir(dir, { recursive: true, mode: 0o700 })
  let config = await json(manifestPath)
  if (config && (config.repo !== repo || config.version !== 1))
    throw new Error(
      "Local state belongs to a different checkout or launcher version; move .agent-local aside first",
    )
  const active = await control(config)
  if (active) {
    if (config.host !== host)
      throw new Error(
        "LAN address changed. Run pnpm agent:stop --lan, then pnpm agent:ensure --lan",
      )
    await waitReady(config)
    return
  }
  try {
    await mkdir(lockPath)
  } catch (error) {
    if (error.code !== "EEXIST") throw error
    const owner = await json(join(lockPath, "owner.json"))
    if (!owner) throw new Error("Another start is initializing; retry shortly")
    let alive = true
    try {
      process.kill(owner.pid, 0)
    } catch (error) {
      if (error.code === "ESRCH") alive = false
      else throw error
    }
    if (alive) {
      if (!config)
        throw new Error("Another start is initializing; retry shortly")
      await waitReady(config)
      return
    }
    if (config && !(await portsFree(config.base, config.host)))
      throw new Error(
        "A previous supervisor exited but its ports are occupied. Inspect the logs/processes before restarting; no processes were killed",
      )
    await rm(lockPath, { recursive: true })
    await mkdir(lockPath)
  }
  await save(join(lockPath, "owner.json"), { pid: process.pid })
  try {
    for (const binary of ["pnpm", "npx", "mysqld", "openssl"]) {
      try {
        execFileSync(binary, ["--version"], { env: cleanEnv, stdio: "ignore" })
      } catch {
        // OpenSSL uses `version`, unlike the other tools.
        if (binary === "openssl") {
          execFileSync(binary, ["version"], { env: cleanEnv, stdio: "ignore" })
          continue
        }
        throw new Error(
          `Missing ${binary}. Install prerequisites described in docs/guides/agent-local-development.md`,
        )
      }
    }
    if (
      !(await exists(
        join(repo, "apps/wodsmith-agent/node_modules/.bin/wrangler"),
      ))
    )
      throw new Error(
        "Run pnpm install first (the integrated agent branch is required)",
      )
    let base = config?.base
    if (base && !(await portsFree(base, host))) base = undefined
    if (!base)
      for (let candidate = 3400; candidate < 3600; candidate += 10) {
        if (await portsFree(candidate, host)) {
          base = candidate
          break
        }
      }
    if (!base) throw new Error("No free local port block in 3400–3599")
    config = {
      ...configuration(repo, dir, host, base),
      accessKey: config?.accessKey ?? secret(),
      inspectorToken: config?.inspectorToken ?? secret(),
      controlKey: secret(),
    }
    await save(manifestPath, config)
    await save(join(dir, "start.json"), config.start)
    await save(join(dir, "gateway.json"), config.gateway)
    await mkdir(join(dir, "empty"), { recursive: true })
    await writeFile(join(dir, ".dev.vars"), "")
    await writeFile(join(dir, "empty.env"), "")
    await rm(join(dir, "failure.json"), { force: true })
    const log = openSync(join(dir, "supervisor.log"), "a", 0o600)
    const child = spawn(
      process.execPath,
      [script, "_serve", ...(lan ? ["--lan"] : [])],
      { env: cleanEnv, cwd: repo, detached: true, stdio: ["ignore", log, log] },
    )
    await new Promise((resolveSpawn, reject) => {
      child.once("spawn", resolveSpawn)
      child.once("error", reject)
    })
    await save(join(lockPath, "owner.json"), { pid: child.pid })
    closeSync(log)
    child.unref()
  } catch (error) {
    await rm(lockPath, { recursive: true, force: true })
    throw error
  }
  console.log(
    "Starting local MySQL, app, MCP, and Inspector. First startup may take a few minutes…",
  )
  await waitReady(config)
}
async function serve(config) {
  const children = new Set()
  let stopping = false
  let phase = "starting"
  let fixture
  let proxy
  const controller = http.createServer(async (req, res) => {
    if (
      req.headers.origin ||
      !sameSecret(req.headers.authorization, `Bearer ${config.controlKey}`)
    ) {
      res.writeHead(403)
      res.end()
      return
    }
    if (req.url === "/status" && req.method === "GET") {
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ identity: config.controlKey, phase, fixture }))
    } else if (req.url === "/stop" && req.method === "POST") {
      res.end(
        JSON.stringify({ identity: config.controlKey, phase: "stopping" }),
      )
      void stop()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  async function stop(error) {
    if (stopping) return
    stopping = true
    phase = "stopping"
    if (error) {
      console.error(error)
      await save(join(dir, "failure.json"), { message: error.message })
    }
    // Only groups spawned and retained by this supervisor are signalled.
    const running = [...children]
    for (const child of running) {
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {}
    }
    for (let attempt = 0; attempt < 100 && children.size; attempt++)
      await delay(100)
    for (const child of children) {
      try {
        process.kill(-child.pid, "SIGKILL")
      } catch {}
    }
    proxy?.closeAllConnections()
    proxy?.close()
    controller.closeAllConnections()
    controller.close()
    await rm(lockPath, { recursive: true, force: true })
    process.exit(error ? 1 : 0)
  }
  process.on("SIGTERM", () => void stop())
  process.on("SIGINT", () => void stop())
  process.on("uncaughtException", (error) => void stop(error))
  process.on(
    "unhandledRejection",
    (error) =>
      void stop(error instanceof Error ? error : new Error(String(error))),
  )
  function launch(name, binary, arguments_, options = {}, service = true) {
    const fd = openSync(join(dir, `${name}.log`), "a", 0o600)
    const child = spawn(binary, arguments_, {
      cwd: dir,
      env: cleanEnv,
      ...options,
      detached: true,
      stdio: ["ignore", fd, fd],
    })
    closeSync(fd)
    children.add(child)
    child.once("error", (error) => {
      children.delete(child)
      void stop(error)
    })
    child.once("exit", (code, signal) => {
      children.delete(child)
      if (service && !stopping)
        void stop(
          new Error(`${name} exited (${code ?? signal}). See ${name}.log`),
        )
    })
    return child
  }
  async function run(name, binary, arguments_, options) {
    const child = launch(name, binary, arguments_, options, false)
    await new Promise((resolveRun, reject) => {
      child.once("error", reject)
      child.once("exit", (code) =>
        code === 0
          ? resolveRun()
          : reject(new Error(`${name} failed (${code}). See ${name}.log`)),
      )
    })
    if (stopping) throw new Error("Startup cancelled")
  }
  try {
    await new Promise((r, reject) => {
      controller.once("error", reject)
      controller.listen(config.base + 9, "127.0.0.1", r)
    })
    let certificateValid = false
    try {
      const certificate = new X509Certificate(
        await readFile(join(dir, "cert.pem")),
      )
      certificateValid =
        certificate.checkIP(config.host) === config.host &&
        Date.parse(certificate.validTo) > Date.now() + 86400000 &&
        (await exists(join(dir, "key.pem")))
    } catch {
      /* The first start or a changed LAN address needs a certificate. */
    }
    if (!certificateValid)
      await run("certificate", "openssl", [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "30",
        "-subj",
        "/CN=WodSmith local development",
        "-addext",
        `subjectAltName=IP:${config.host},DNS:localhost`,
        "-keyout",
        join(dir, "key.pem"),
        "-out",
        join(dir, "cert.pem"),
      ])
    const data = join(dir, "mysql")
    if (!(await exists(data))) {
      await mkdir(data)
      await run("mysql-init", "mysqld", [
        "--no-defaults",
        "--initialize-insecure",
        `--datadir=${data}`,
      ])
    }
    launch("mysql", "mysqld", [
      "--no-defaults",
      `--datadir=${data}`,
      `--socket=${join(dir, "mysql.sock")}`,
      `--port=${config.base + 5}`,
      "--bind-address=127.0.0.1",
      "--mysqlx=OFF",
      `--pid-file=${join(dir, "mysql.pid")}`,
      `--log-error=${join(dir, "mysql-error.log")}`,
    ])
    const mysql = createRequire(join(repo, "apps/wodsmith-start/package.json"))(
      "mysql2/promise",
    )
    let connected = false
    for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
      try {
        const db = await mysql.createConnection({
          host: "127.0.0.1",
          port: config.base + 5,
          user: "root",
          connectTimeout: 1000,
        })
        await db.end()
        connected = true
        break
      } catch {
        await delay(500)
      }
    }
    if (!connected) throw new Error("Local MySQL did not become ready")
    await run(
      "schema",
      "pnpm",
      [
        "exec",
        "tsx",
        "../../packages/wodsmith-db/scripts/export-test-schema.ts",
        join(dir, "schema.json"),
      ],
      { cwd: join(repo, "apps/wodsmith-start") },
    )
    fixture = await seedFixture(config)
    launch(
      "app",
      "pnpm",
      ["exec", "vite", "--config", "vite.agent-local.config.ts"],
      { cwd: join(repo, "apps/wodsmith-start") },
    )
    launch(
      "gateway",
      join(repo, "apps/wodsmith-agent/node_modules/.bin/wrangler"),
      [
        "dev",
        "--config",
        join(dir, "gateway.json"),
        "--env-file",
        join(dir, "empty.env"),
        "--local",
        "--persist-to",
        join(dir, "state/gateway"),
        "--https-key-path",
        join(dir, "key.pem"),
        "--https-cert-path",
        join(dir, "cert.pem"),
        "--inspector-port",
        String(config.base + 7),
      ],
    )
    launch(
      "inspector",
      "npx",
      [
        "--yes",
        "@modelcontextprotocol/inspector@2.6.0",
        "--web",
        "--transport",
        "http",
        "--server-url",
        config.mcp,
      ],
      {
        env: {
          ...cleanEnv,
          HOST: "127.0.0.1",
          PORT: String(config.base + 3),
          CLIENT_PORT: String(config.base + 3),
          MCP_SANDBOX_PORT: String(config.base + 4),
          MCP_STORAGE_DIR: join(dir, "inspector-storage"),
          MCP_INSPECTOR_SECRET_STORE: "file",
          MCP_INSPECTOR_SECRET_FILE: join(dir, "inspector-storage/secrets.json"),
          MCP_APP_ORIGIN_PORT: String(config.base + 8),
          ALLOWED_ORIGINS: `${config.inspector},http://127.0.0.1:${config.base + 3}`,
          MCP_INSPECTOR_API_TOKEN: config.inspectorToken,
          NODE_EXTRA_CA_CERTS: join(dir, "cert.pem"),
        },
      },
    )
    proxy = createInspectorProxy(config)
    await new Promise((r, reject) => {
      proxy.once("error", reject)
      proxy.listen(config.base + 2, config.host, r)
    })
    const ca = readFileSync(join(dir, "cert.pem"))
    for (let attempt = 0; attempt < 180 && !stopping; attempt++) {
      try {
        const checks = await Promise.all([
          request(`${config.app}/.well-known/oauth-authorization-server`, {
            ca,
          }),
          request(config.mcp, { ca }),
          request(`http://127.0.0.1:${config.base + 3}/`),
        ])
        if (
          checks[0].status === 200 &&
          JSON.parse(checks[0].body).issuer === config.app &&
          checks[1].status === 401 &&
          checks[2].status === 200
        ) {
          phase = "ready"
          console.log("All local services ready")
          return
        }
      } catch {
        /* Startup can temporarily refuse connections. */
      }
      await delay(1000)
    }
    throw new Error(
      "Services did not become healthy. Check app.log, gateway.log, and inspector.log",
    )
  } catch (error) {
    await stop(error)
  }
}
try {
  if (command === "_serve") await serve(await json(manifestPath))
  else if (command === "ensure") await ensure()
  else {
    const config = await json(manifestPath)
    const state = await control(config, command)
    if (!state) console.log(`Environment is stopped. Logs and data: ${dir}`)
    else if (command === "status") printReady(config, state)
    else {
      for (let attempt = 0; attempt < 150 && (await control(config)); attempt++)
        await delay(100)
      if (await control(config))
        throw new Error("Shutdown still pending; check supervisor.log")
      console.log("Stopped. Local database and Worker state are preserved.")
    }
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
