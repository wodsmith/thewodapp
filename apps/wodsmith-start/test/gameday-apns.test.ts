import { webcrypto } from "node:crypto"
import { expect, it, vi } from "vitest"
import { createAPNsJWT, sendAPNsAnnouncement } from "@/server/gameday-apns"
const input = { jwt: "jwt", token: "ab".repeat(32), environment: "sandbox", deliveryId: "97c25872-b730-480b-8c50-57a32ec2a9a1", broadcastId: "broadcast", competitionId: "competition", expiresAt: new Date(Date.now() + 86400000) }
// @lat: [[gameday-push#Tests#APNs wire contract]]
it("sends a private-content-free alert with stable collapse and deep-link identifiers", async () => {
  const transport = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
  expect(await sendAPNsAnnouncement(input, transport)).toEqual({ kind: "sent", reason: "Accepted" })
  const [url, options] = transport.mock.calls[0]
  expect(url).toBe(`https://api.sandbox.push.apple.com/3/device/${input.token}`)
  expect(options.headers).toMatchObject({ authorization: "bearer jwt", "apns-push-type": "alert", "apns-priority": "10", "apns-id": input.deliveryId, "apns-collapse-id": "broadcast", "apns-topic": "com.wodsmith.gameday", "apns-expiration": "0" })
  expect(JSON.parse(options.body)).toMatchObject({ competitionID: "competition", announcementID: "broadcast" })
  expect(options.body).not.toContain(input.token)
})
// @lat: [[gameday-push#Tests#Workers redirect handling]]
it("uses Workers-compatible fetch and rejects redirects without following them", async () => {
  const transport = vi.fn(async (_url, options) => {
    if (options?.redirect === "error") throw new TypeError("Invalid redirect value")
    expect(options?.redirect).toBe("manual")
    return new Response(null, { status: 302, headers: { location: "https://example.com" } })
  })
  expect(await sendAPNsAnnouncement(input, transport)).toEqual({ kind: "failed", reason: "HTTP302" })
  expect(transport).toHaveBeenCalledTimes(1)
})
it.each([[410, "Unregistered", "invalid"], [400, "BadDeviceToken", "invalid"], [429, "TooManyRequests", "retry"], [503, "ServiceUnavailable", "retry"], [400, "BadTopic", "failed"]])("classifies APNs %i %s", async (status, reason, kind) => {
  const transport = vi.fn().mockResolvedValue(Response.json({ reason, timestamp: 123 }, { status: Number(status) }))
  expect(await sendAPNsAnnouncement(input, transport)).toMatchObject({ kind, reason })
})
it("signs a verifiable ES256 provider JWT", async () => {
  vi.stubGlobal("crypto", webcrypto)
  const key = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", key.privateKey)
  const jwt = await createAPNsJWT({ keyId: "key", teamId: "team", privateKey: `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----` }, 1800000000000)
  const parts = jwt.split(".")
  expect(JSON.parse(Buffer.from(parts[0], "base64url").toString())).toEqual({ alg: "ES256", kid: "key" })
  expect(JSON.parse(Buffer.from(parts[1], "base64url").toString())).toEqual({ iss: "team", iat: 1800000000 })
  expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key.publicKey, Buffer.from(parts[2], "base64url"), new TextEncoder().encode(parts.slice(0, 2).join(".")))).toBe(true)
})
