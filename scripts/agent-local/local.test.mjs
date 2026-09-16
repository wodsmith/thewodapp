import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import http from "node:http"
import https from "node:https"
import net from "node:net"
import { configuration, privateIPv4, nextMonday, portsFree } from "./config.mjs"
import { createInspectorProxy, sameSecret } from "./proxy.mjs"

// @lat: [[agent-local-development#Local configuration isolation]]
test("generated Workers only use owned local bindings and matching OAuth origins", () => {
  const one = configuration(
    "/checkout",
    "/checkout/.agent-local/lan",
    "192.168.1.2",
    3400,
  )
  const two = configuration(
    "/other",
    "/other/.agent-local/lan",
    "192.168.1.2",
    3410,
  )
  assert.notEqual(one.start.name, two.start.name)
  assert.equal(one.gateway.services[0].service, one.start.name)
  assert.equal(one.start.vars.AGENT_AUTH_ORIGIN, one.app)
  assert.equal(one.start.vars.AGENT_RESOURCE, one.mcp)
  assert.equal(one.gateway.vars.AGENT_RESOURCE, one.mcp)
  assert.equal(
    one.start.vars.DATABASE_URL,
    "mysql://root@127.0.0.1:3405/wodsmith_agent_local",
  )
  assert.equal(JSON.stringify(one).includes('"remote":true'), false)
  for (const host of [
    "0.0.0.0",
    "8.8.8.8",
    "172.32.0.1",
    "192.168.1.999",
    "localhost",
  ])
    assert.equal(privateIPv4(host), false)
  for (const host of [
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.1.2",
  ])
    assert.equal(privateIPv4(host), true)
  assert.equal(nextMonday(new Date("2026-09-13T22:00:00Z")), "2026-09-14")
  assert.equal(nextMonday(new Date("2026-09-14T22:00:00Z")), "2026-09-14")
})

// @lat: [[agent-local-development#Occupied port protection]]
test("port selection leaves existing listeners alive", async () => {
  const existing = net.createServer((socket) => socket.end("owned elsewhere"))
  await new Promise((resolve) => existing.listen(0, "127.0.0.1", resolve))
  try {
    assert.equal(await portsFree(existing.address().port, "127.0.0.1"), false)
    assert.equal(existing.listening, true)
  } finally {
    await new Promise((resolve) => existing.close(resolve))
  }
})

// @lat: [[agent-local-development#Private Inspector entry]]
test("Inspector requires the private link, protects cookies, and rejects malformed credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agent-proxy-test-"))
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-keyout",
      join(dir, "key.pem"),
      "-out",
      join(dir, "cert.pem"),
    ],
    { stdio: "ignore" },
  )
  const upstream = http.createServer((req, res) => res.end("inspector-backend"))
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve))
  const config = {
    dir,
    accessKey: "a".repeat(64),
    inspectorToken: "t".repeat(64),
    base: upstream.address().port - 3,
    inspector: "https://127.0.0.1:9999",
    mcp: "https://127.0.0.1:9998/mcp",
  }
  const proxy = createInspectorProxy(config)
  await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve))
  const get = (path, headers = {}) =>
    new Promise((resolve, reject) => {
      https
        .get(
          `https://127.0.0.1:${proxy.address().port}${path}`,
          { rejectUnauthorized: false, headers },
          (res) => {
            let body = ""
            res.on("data", (chunk) => {
              body += chunk
            })
            res.on("end", () =>
              resolve({ status: res.statusCode, headers: res.headers, body }),
            )
          },
        )
        .on("error", reject)
    })
  try {
    assert.equal((await get("/")).status, 403)
    assert.equal(
      (
        await get("/api/tools", {
          cookie: `wodsmith_local_inspector=${"é".repeat(64)}`,
        })
      ).status,
      403,
    )
    assert.equal(sameSecret("é", "a"), false)
    const entry = await get(`/connect/${config.accessKey}`)
    assert.equal(entry.status, 303)
    assert.match(
      entry.headers["set-cookie"][0],
      /HttpOnly; Secure; SameSite=Lax/,
    )
    assert.equal(entry.headers["referrer-policy"], "no-referrer")
    assert.equal(entry.headers["cache-control"], "no-store")
    assert.equal(
      new URL(entry.headers.location, config.inspector).searchParams.get(
        "MCP_INSPECTOR_API_TOKEN",
      ),
      config.inspectorToken,
    )
    const authenticated = await get("/", {
      cookie: `wodsmith_local_inspector=${config.accessKey}`,
    })
    assert.equal(authenticated.status, 200)
    assert.equal(authenticated.body, "inspector-backend")
  } finally {
    proxy.closeAllConnections()
    upstream.closeAllConnections()
    await Promise.all([
      new Promise((r) => proxy.close(r)),
      new Promise((r) => upstream.close(r)),
    ])
    await rm(dir, { recursive: true, force: true })
  }
})
