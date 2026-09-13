export interface APNsConfig {
  keyId: string
  teamId: string
  privateKey: string
}
export type APNsResult = {
  kind: "sent" | "retry" | "invalid" | "failed"
  reason: string
  invalidAt?: number
}

const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
const jsonPart = (value: unknown) =>
  encode(new TextEncoder().encode(JSON.stringify(value)))

// Reuse provider tokens for up to 50 minutes; Apple rejects excessive token rotation.
let cachedJWT:
  | { config: APNsConfig; issuedAt: number; value: string }
  | undefined

export async function createAPNsJWT(
  config: APNsConfig,
  now = Date.now(),
): Promise<string> {
  if (
    cachedJWT &&
    cachedJWT.config.keyId === config.keyId &&
    cachedJWT.config.teamId === config.teamId &&
    cachedJWT.config.privateKey === config.privateKey &&
    now >= cachedJWT.issuedAt &&
    now - cachedJWT.issuedAt < 50 * 60000
  )
    return cachedJWT.value
  const pem = config.privateKey
    .replace(/\\n/g, "\n")
    .replace(/-----[^-]+-----/g, "")
    .replace(/\s/g, "")
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  )
  const input = `${jsonPart({ alg: "ES256", kid: config.keyId })}.${jsonPart({ iss: config.teamId, iat: Math.floor(now / 1000) })}`
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(input),
  )
  const value = `${input}.${encode(new Uint8Array(signature))}`
  cachedJWT = { config, issuedAt: now, value }
  return value
}

// @lat: [[gameday-push#Delivery semantics]]
export async function sendAPNsAnnouncement(
  input: {
    jwt: string
    token: string
    environment: string
    deliveryId: string
    broadcastId: string
    competitionId: string
    expiresAt: Date
  },
  transport: typeof fetch = fetch,
): Promise<APNsResult> {
  const host =
    input.environment === "sandbox"
      ? "api.sandbox.push.apple.com"
      : "api.push.apple.com"
  const response = await transport(`https://${host}/3/device/${input.token}`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: {
      authorization: `bearer ${input.jwt}`,
      "content-type": "application/json",
      "apns-topic": "com.wodsmith.gameday",
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-id": input.deliveryId,
      "apns-collapse-id": input.broadcastId,
      // Do not store undelivered alerts at Apple after sign-out; our outbox owns retries.
      "apns-expiration": "0",
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: "Competition announcement",
          body: "Open Game Day to read an update from your organizer.",
        },
        sound: "default",
        "thread-id": input.competitionId,
      },
      competitionID: input.competitionId,
      announcementID: input.broadcastId,
    }),
  })
  if (response.ok) return { kind: "sent", reason: "Accepted" }
  const error = (await response.json().catch(() => ({}))) as {
    reason?: string
    timestamp?: number
  }
  const reason = error.reason ?? `HTTP${response.status}`
  if (
    response.status === 410 ||
    ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(
      reason,
    )
  )
    return { kind: "invalid", reason, invalidAt: error.timestamp }
  if (
    response.status === 429 ||
    response.status >= 500 ||
    [
      "ExpiredProviderToken",
      "InvalidProviderToken",
      "MissingProviderToken",
    ].includes(reason)
  )
    return { kind: "retry", reason }
  return { kind: "failed", reason }
}
