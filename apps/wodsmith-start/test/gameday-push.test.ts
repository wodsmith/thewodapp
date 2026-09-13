import { webcrypto } from "node:crypto"
import { drizzle } from "drizzle-orm/mysql-proxy"
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ db: vi.fn(), session: vi.fn(), storedSession: vi.fn(), registrations: vi.fn(), send: vi.fn(), jwt: vi.fn(), env: { GAMEDAY_PUSH_ENABLED: "true", APNS_KEY_ID: "key", APNS_TEAM_ID: "team", APNS_PRIVATE_KEY: "private", BROADCAST_EMAIL_QUEUE: { sendBatch: vi.fn() } } }))
vi.mock("cloudflare:workers", () => ({ env: mocks.env }))
vi.mock("@/db", () => ({ getDb: mocks.db }))
vi.mock("@/utils/bearer-auth", () => ({ getSessionFromBearer: mocks.session }))
vi.mock("@/utils/kv-session", () => ({ getKVSession: mocks.storedSession }))
vi.mock("@/server/gameday", () => ({ getGameDayRegistrations: mocks.registrations }))
vi.mock("@/server/gameday-apns", () => ({ createAPNsJWT: mocks.jwt, sendAPNsAnnouncement: mocks.send }))
import { deliverGameDayPush, handleGameDayDeviceRequest, recordGameDayPushDeliveries, dispatchGameDayPush } from "@/server/gameday-push"

const subscriptionId = "5a7d2f9b-0f68-480a-b72a-eaef31fb88be"
const now = new Date()
const future = new Date(Date.now() + 86400000)
const deviceBody = { token: "ab".repeat(32), environment: "sandbox", subscriptionId }
const request = (method = "PUT", body: unknown = deviceBody) => new Request("https://wodsmith.com/api/gameday/v1/devices", { method, body: JSON.stringify(body) })

describe("Game Day announcement delivery", () => {
  let statements: { sql: string; params: unknown[] }[]
  let rows: unknown[][][]
  beforeEach(() => {
    vi.stubGlobal("crypto", webcrypto)
    statements = []; rows = []
    mocks.env.GAMEDAY_PUSH_ENABLED = "true"
    mocks.session.mockResolvedValue({ id: "session", userId: "athlete", expiresAt: future.getTime() })
    mocks.storedSession.mockResolvedValue({ expiresAt: future.getTime() })
    mocks.registrations.mockResolvedValue([{ competitionId: "competition" }])
    mocks.jwt.mockResolvedValue("signed")
    mocks.send.mockResolvedValue({ kind: "sent", reason: "Accepted" })
    mocks.db.mockReturnValue(drizzle(async (sql, params) => {
      statements.push({ sql, params })
      // mysql-proxy expects positional rows. Only SELECT consumes fixture responses.
      return { rows: sql.startsWith("select") ? rows.shift() ?? [] : [{ insertId: 0, affectedRows: 1 }] }
    }))
  })
  // @lat: [[gameday-push#Tests#Device API boundary]]
  it("rejects anonymous requests and body-supplied ownership, derives the binding from the bearer session", async () => {
    mocks.session.mockResolvedValueOnce(null)
    expect((await handleGameDayDeviceRequest(request())).status).toBe(401)
    expect((await handleGameDayDeviceRequest(request("PUT", { ...deviceBody, userId: "victim" }))).status).toBe(400)
    expect(statements).toHaveLength(0)
    const result = await handleGameDayDeviceRequest(request())
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ registered: true })
    expect(statements[0].params).toEqual(expect.arrayContaining(["athlete", "session", subscriptionId]))
    expect(result.headers.get("Cache-Control")).toBe("private, no-store")
  })
  it("scopes delayed deregistration to its original session and subscription", async () => {
    await handleGameDayDeviceRequest(request("DELETE"))
    expect(statements[0].sql).toMatch(/delete from.*sessionId.*subscriptionId/)
    expect(statements[0].params).toEqual(expect.arrayContaining(["athlete", "session", subscriptionId]))
  })
  it("fails visibly when rollout is disabled but allows subscription cleanup", async () => {
    mocks.env.GAMEDAY_PUSH_ENABLED = "false"
    expect((await handleGameDayDeviceRequest(request())).status).toBe(503)
    expect(statements).toHaveLength(0)
    expect((await handleGameDayDeviceRequest(request("DELETE"))).status).toBe(200)
  })
  // @lat: [[gameday-push#Tests#Recorded audience outbox]]
  it("snapshots only recorded recipients with unexpired device bindings inside the supplied transaction", async () => {
    rows.push([["device", "athlete", subscriptionId]])
    await recordGameDayPushDeliveries(mocks.db(), "broadcast")
    expect(statements[0].sql).toMatch(/inner join.*competition_broadcast_recipients/)
    expect(statements[0].params).toContain("broadcast")
    expect(statements[0].sql).toContain("expiresAt")
    expect(statements[1].sql).toContain("insert into `gameday_push_deliveries`")
    expect(statements[1].params).toEqual(expect.arrayContaining(["athlete", subscriptionId, "broadcast"]))
  })
  function deliveryRows(options: { registered?: boolean; device?: boolean } = {}) {
    // id, broadcast, device, user, subscription, status, attempts, available, expiry, lease, reason
    rows.push([["delivery", "broadcast", "device", "athlete", subscriptionId, "pending", 1, now.toISOString(), future.toISOString(), "lease", null]])
    rows.push(options.device === false ? [] : [["device", deviceBody.token, "sandbox", "athlete", "session", subscriptionId, now.toISOString(), future.toISOString()]])
    if (options.device !== false) rows.push([["broadcast", "competition"]], [["device"]])
    if (options.registered === false) mocks.registrations.mockResolvedValue([])
  }
  // @lat: [[gameday-push#Tests#Delivery authorization and duplicates]]
  it("claims pending work atomically and revalidates subscription, session, audience and active registration", async () => {
    deliveryRows()
    await deliverGameDayPush("delivery")
    expect(statements[0].sql).toMatch(/update.*attempts.*where.*status.*availableAt/)
    expect(statements[1].sql).toContain("leaseId")
    expect(mocks.storedSession).toHaveBeenCalledWith("session", "athlete")
    expect(mocks.registrations).toHaveBeenCalledWith("athlete")
    expect(mocks.send).toHaveBeenCalledOnce()
    expect(statements.at(-1)?.params).toContain("sent")
    expect(statements.some((s) => s.sql.includes("inner join `competition_broadcast_recipients`"))).toBe(true)
    mocks.send.mockClear()
    await deliverGameDayPush("delivery") // no acquired lease (duplicate/previously sent)
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it.each(["subscription", "registration", "session"])("does not send after %s access ends", async (boundary) => {
    deliveryRows({ device: boundary !== "subscription", registered: boundary !== "registration" })
    if (boundary === "session") mocks.storedSession.mockResolvedValue(null)
    await deliverGameDayPush("delivery")
    expect(mocks.send).not.toHaveBeenCalled()
    expect(statements.at(-1)?.params).toContain("skipped")
  })
  // @lat: [[gameday-push#Tests#Provider recovery]]
  it("retries transient provider failures and removes invalid tokens without deleting a newer registration", async () => {
    deliveryRows()
    mocks.send.mockResolvedValueOnce({ kind: "retry", reason: "ServiceUnavailable" })
    await deliverGameDayPush("delivery")
    expect(statements.at(-1)?.params).toEqual(expect.arrayContaining(["pending", "ServiceUnavailable"]))
    deliveryRows()
    mocks.send.mockResolvedValueOnce({ kind: "invalid", reason: "Unregistered", invalidAt: now.getTime() })
    await deliverGameDayPush("delivery")
    expect(statements.at(-2)?.sql).toMatch(/delete from.*subscriptionId.*registeredAt/)
    expect(statements.at(-1)?.params).toContain("skipped")
  })
  it("recovers due jobs through bounded queue batches", async () => {
    rows.push([["job1"], ["job2"]])
    await dispatchGameDayPush()
    expect(mocks.env.BROADCAST_EMAIL_QUEUE.sendBatch).toHaveBeenCalledWith([
      { body: { kind: "gameday-push", deliveryId: "job1" } }, { body: { kind: "gameday-push", deliveryId: "job2" } },
    ])
  })
})
