import https from "node:https"
import http from "node:http"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { timingSafeEqual } from "node:crypto"

export function sameSecret(a, b) {
  const left = Buffer.from(a ?? "")
  const right = Buffer.from(b ?? "")
  return left.length === right.length && timingSafeEqual(left, right)
}
export function createInspectorProxy(config) {
  const cookie = "wodsmith_local_inspector"
  const authorized = (req) =>
    (req.headers.cookie ?? "").split(";").some((part) => {
      const [name, value] = part.trim().split("=")
      return name === cookie && sameSecret(value, config.accessKey)
    })
  const headers = (req) => ({
    ...req.headers,
    host: new URL(config.inspector).host,
    "x-forwarded-proto": "https",
  })
  const server = https.createServer(
    {
      key: readFileSync(join(config.dir, "key.pem")),
      cert: readFileSync(join(config.dir, "cert.pem")),
    },
    (req, res) => {
      res.setHeader("Cache-Control", "no-store")
      res.setHeader("Referrer-Policy", "no-referrer")
      if (req.method === "GET" && req.url === `/connect/${config.accessKey}`) {
        const query = new URLSearchParams({
          MCP_INSPECTOR_API_TOKEN: config.inspectorToken,
          serverUrl: config.mcp,
          transport: "http",
        })
        res.writeHead(303, {
          "Set-Cookie": `${cookie}=${config.accessKey}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`,
          Location: `/?${query}`,
        })
        res.end()
        return
      }
      if (!authorized(req)) {
        res.writeHead(403)
        res.end("Open the private link printed by pnpm agent:ensure.")
        return
      }
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: config.base + 3,
          path: req.url,
          method: req.method,
          headers: headers(req),
        },
        (reply) => {
          res.writeHead(reply.statusCode, reply.headers)
          reply.pipe(res)
        },
      )
      upstream.on("error", () => {
        if (!res.headersSent) res.writeHead(502)
        res.end("Inspector unavailable")
      })
      req.pipe(upstream)
    },
  )
  server.on("upgrade", (req, socket, head) => {
    if (!authorized(req) || req.headers.origin !== config.inspector) {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n")
      return
    }
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: config.base + 3,
      path: req.url,
      headers: headers(req),
    })
    upstream.on("upgrade", (reply, peer, upstreamHead) => {
      socket.write(
        `HTTP/1.1 ${reply.statusCode} ${reply.statusMessage}\r\n${Object.entries(
          reply.headers,
        )
          .map(([k, v]) => `${k}: ${v}\r\n`)
          .join("")}\r\n`,
      )
      if (head.length) peer.write(head)
      if (upstreamHead.length) socket.write(upstreamHead)
      peer.pipe(socket)
      socket.pipe(peer)
      peer.on("error", () => socket.destroy())
      socket.on("error", () => peer.destroy())
    })
    upstream.on("response", () => socket.destroy())
    upstream.on("error", () => socket.destroy())
    upstream.end()
  })
  return server
}
