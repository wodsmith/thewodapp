import { createHash, randomBytes } from "node:crypto"
import { networkInterfaces } from "node:os"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import net from "node:net"

export const secret = () => randomBytes(32).toString("hex")
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex")
export function privateIPv4(host) {
  if (!net.isIPv4(host)) return false
  const [a, b] = host.split(".").map(Number)
  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  )
}
export function lanHost(explicit) {
  const addresses = Object.entries(networkInterfaces()).flatMap(
    ([name, rows]) =>
      rows
        .filter((row) => !row.internal && privateIPv4(row.address))
        .map((row) => ({ name, address: row.address })),
  )
  if (explicit) {
    if (!addresses.some((row) => row.address === explicit))
      throw new Error(
        "--host must be a private IPv4 address assigned to this computer",
      )
    return explicit
  }
  if (process.platform === "darwin") {
    try {
      const iface = /interface: (\S+)/.exec(
        execFileSync("route", ["-n", "get", "default"], { encoding: "utf8" }),
      )?.[1]
      const found = addresses.find((row) => row.name === iface)
      if (found) return found.address
    } catch {
      /* Fall back to the interface inventory. */
    }
  }
  const unique = [...new Set(addresses.map((row) => row.address))]
  if (unique.length !== 1)
    throw new Error(
      `Choose a LAN address with --host <IP>. Available: ${unique.join(", ") || "none"}`,
    )
  return unique[0]
}
export async function portsFree(base, host) {
  const sockets = []
  try {
    for (let offset = 0; offset < 10; offset++) {
      const socket = net.createServer()
      sockets.push(socket)
      await new Promise((resolve, reject) => {
        socket.once("error", reject)
        socket.listen(base + offset, offset < 3 ? host : "127.0.0.1", resolve)
      })
    }
    return true
  } catch {
    return false
  } finally {
    await Promise.all(
      sockets
        .filter((s) => s.listening)
        .map((s) => new Promise((r) => s.close(r))),
    )
  }
}
export function configuration(repo, dir, host, base) {
  const id = digest(dir).slice(0, 10)
  const app = `https://${host}:${base}`
  const mcp = `https://${host}:${base + 1}/mcp`
  const inspector = `https://${host}:${base + 2}`
  // Pinned to the workerd shipped with the gateway's locked Wrangler 4.83.
  const common = {
    compatibility_date: "2026-04-22",
    compatibility_flags: [
      "nodejs_compat",
      "nodejs_compat_populate_process_env",
      "global_fetch_strictly_public",
    ],
  }
  const vars = { AGENT_AUTH_ORIGIN: app, AGENT_RESOURCE: mcp }
  return {
    version: 1,
    repo,
    dir,
    host,
    base,
    app,
    mcp,
    inspector,
    start: {
      ...common,
      name: `agent-local-${id}-start`,
      main: join(repo, "apps/wodsmith-start/src/server.ts"),
      vars: {
        ...vars,
        APP_URL: app,
        SITE_URL: app,
        DATABASE_URL: `mysql://root@127.0.0.1:${base + 5}/wodsmith_agent_local`,
        ENVIRONMENT: "development",
        EMAIL_FROM: "test@wodsmith.local",
      },
      kv_namespaces: ["KV_SESSION", "OAUTH_KV"].map((binding) => ({
        binding,
        id: `local-${binding}`,
      })),
      r2_buckets: [
        { binding: "R2_BUCKET", bucket_name: `agent-local-${id}-uploads` },
      ],
    },
    gateway: {
      ...common,
      name: `agent-local-${id}-gateway`,
      main: join(repo, "apps/wodsmith-agent/src/index.ts"),
      vars,
      services: [
        {
          binding: "TRAINING",
          service: `agent-local-${id}-start`,
          entrypoint: "AgentTrainingService",
        },
      ],
      dev: { ip: host, port: base + 1, local_protocol: "https" },
    },
  }
}
export function nextMonday(today = new Date()) {
  const date = new Date(today)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7))
  return date.toISOString().slice(0, 10)
}
