import { DatabaseSync } from "node:sqlite"
import { drizzle } from "drizzle-orm/mysql-proxy"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  session: vi.fn(),
  expire: vi.fn(),
  retrieve: vi.fn(),
}))
vi.mock("@/db", () => ({ getDb: mocks.getDb }))
vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: mocks.session,
  requireVerifiedEmail: mocks.session,
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { expire: mocks.expire, retrieve: mocks.retrieve } },
  }),
}))
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (parse: (data: unknown) => unknown) => ({
      handler:
        (fn: (ctx: { data: unknown }) => unknown) =>
        async (ctx: { data: unknown }) =>
          fn({ data: parse(ctx.data) }),
    }),
    handler: (fn: unknown) => fn,
  }),
  createServerOnlyFn: (fn: unknown) => fn,
}))

import { checkCheckoutCompletionFn } from "@/server-fns/competition-detail-fns"
import { cancelPendingPurchaseFn } from "@/server-fns/registration-fns"

let sqlite: DatabaseSync
beforeEach(() => {
  sqlite = new DatabaseSync(":memory:")
  sqlite.exec(`CREATE TABLE commerce_purchases (id TEXT, userId TEXT, competitionId TEXT, divisionId TEXT, status TEXT, stripeCheckoutSessionId TEXT, updatedAt TEXT, update_counter INTEGER DEFAULT 0, updateCounter INTEGER DEFAULT 0);
    CREATE TABLE competition_registrations (id TEXT, userId TEXT, eventId TEXT, divisionId TEXT, commercePurchaseId TEXT, status TEXT, paymentStatus TEXT);`)
  // Run the production Drizzle predicates over real rows, rather than returning
  // pre-filtered fixtures that cannot detect a missing account/session predicate.
  mocks.getDb.mockReturnValue(
    drizzle(async (sql, params, method) => {
      const stmt = sqlite.prepare(sql)
      stmt.setReturnArrays(true)
      if (method === "execute") {
        stmt.run(...params)
        return { rows: [{ insertId: 0, affectedRows: 1 }] }
      }
      return { rows: stmt.all(...params) }
    }),
  )
  mocks.session.mockResolvedValue({
    userId: "alice",
    user: { id: "alice", email: "alice@example.com" },
  })
  mocks.expire.mockResolvedValue({ status: "expired" })
  mocks.retrieve.mockResolvedValue({ status: "complete" })
})
afterEach(() => sqlite.close())

function purchase(
  id: string,
  status = "PENDING",
  session = "cs_a",
  user = "alice",
  competition = "comp_a",
  division: string | null = "rx",
) {
  sqlite
    .prepare(
      "INSERT INTO commerce_purchases (id, userId, competitionId, divisionId, status, stripeCheckoutSessionId) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, user, competition, division, status, session)
}
function registration(purchaseId: string, status = "active", user = "alice") {
  sqlite
    .prepare(
      "INSERT INTO competition_registrations VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(`reg_${purchaseId}`, user, "comp_a", "rx", purchaseId, status, "PAID")
}
const cancel = (purchaseId = "a") =>
  cancelPendingPurchaseFn({
    data: { userId: "alice", competitionId: "comp_a", purchaseId },
  })
const check = () =>
  checkCheckoutCompletionFn({
    data: { sessionId: "cs_a", competitionId: "comp_a" },
  })
function status(id: string) {
  return sqlite
    .prepare("SELECT status FROM commerce_purchases WHERE id = ?")
    .get(id)?.status
}

describe("checkout cancellation scope", () => {
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Cancel only the owned checkout]]
  it("cancels all lines in exactly one owned session, preserving other sessions, users, competitions and completed lines", async () => {
    purchase("a")
    purchase("addon", "PENDING", "cs_a", "alice", "comp_a", null)
    purchase("other_tab", "PENDING", "cs_b")
    purchase("bob", "PENDING", "cs_a", "bob")
    purchase("other_comp", "PENDING", "cs_a", "alice", "comp_b")
    purchase("paid", "COMPLETED")
    await cancel()
    expect(mocks.expire).toHaveBeenCalledWith("cs_a")
    expect(status("a")).toBe("CANCELLED")
    expect(status("addon")).toBe("CANCELLED")
    for (const id of ["other_tab", "bob", "other_comp"])
      expect(status(id)).toBe("PENDING")
    expect(status("paid")).toBe("COMPLETED")
  })
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Cancellation retry after expiry]]
  it("releases an already expired order and treats repeated cancellation as a no-op", async () => {
    purchase("a")
    mocks.expire.mockRejectedValueOnce(new Error("Already expired"))
    mocks.retrieve.mockResolvedValueOnce({ status: "expired" })
    await cancel()
    await cancel()
    expect(status("a")).toBe("CANCELLED")
    expect(mocks.expire).toHaveBeenCalledTimes(1)
  })
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Reject foreign cancellation anchors]]
  it.each(["foreign", "wrong_comp", "missing"])(
    "does not cancel using a %s purchase anchor",
    async (id) => {
      purchase("a")
      purchase("foreign", "PENDING", "cs_b", "bob")
      purchase("wrong_comp", "PENDING", "cs_c", "alice", "comp_b")
      await cancel(id)
      expect(status("a")).toBe("PENDING")
      expect(status("foreign")).toBe("PENDING")
      expect(status("wrong_comp")).toBe("PENDING")
      expect(mocks.expire).not.toHaveBeenCalled()
    },
  )
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Cancellation validation and payment race]]
  it("rejects missing scope, anonymous callers, and a session that cannot be expired without mutating purchases", async () => {
    purchase("a")
    await expect(cancel("")).rejects.toThrow()
    mocks.session.mockResolvedValueOnce(null)
    await expect(cancel()).rejects.toThrow("Unauthorized")
    mocks.expire.mockRejectedValueOnce(new Error("Session already complete"))
    await expect(cancel()).rejects.toThrow("Session already complete")
    expect(status("a")).toBe("PENDING")
  })
})

describe("checkout completion evidence", () => {
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Reject absent and unsuccessful purchases]]
  it.each(["missing", "FAILED", "CANCELLED", "PENDING", "COMPLETED"])(
    "does not confirm %s purchases without participation",
    async (state) => {
      if (state !== "missing") purchase("a", state)
      expect((await check()).ready).toBe(false)
    },
  )
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Require the entire order]]
  it.each(["FAILED", "CANCELLED", "PENDING"])(
    "does not confirm a mixed completed and %s order",
    async (state) => {
      purchase("a", "COMPLETED")
      registration("a")
      purchase("b", state)
      expect((await check()).ready).toBe(false)
    },
  )
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Confirm fulfilled registration orders]]
  it("confirms a completed registration and addon and returns only its registration id", async () => {
    purchase("a", "COMPLETED")
    registration("a")
    purchase("merch", "COMPLETED", "cs_a", "alice", "comp_a", null)
    const result = await check()
    expect(result.ready).toBe(true)
    expect(result.registrationIds).toEqual(["reg_a"])
  })
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Do not substitute unrelated participation]]
  it.each(["removed", "foreign", "other_session", "other_comp", "addon_only"])(
    "does not use %s evidence to confirm this checkout",
    async (kind) => {
      purchase(
        "a",
        "COMPLETED",
        kind === "other_session" ? "cs_b" : "cs_a",
        kind === "foreign" ? "bob" : "alice",
        kind === "other_comp" ? "comp_b" : "comp_a",
        kind === "addon_only" ? null : "rx",
      )
      registration(
        "a",
        kind === "removed" ? "removed" : "active",
        kind === "foreign" ? "bob" : "alice",
      )
      expect((await check()).ready).toBe(false)
    },
  )
  // @lat: [[checkout-safety-tests#Checkout Safety Tests#Completion authentication and validation]]
  it("requires authenticated and nonempty competition and session scope", async () => {
    mocks.session.mockResolvedValueOnce(null)
    await expect(check()).rejects.toThrow("Unauthorized")
    await expect(
      checkCheckoutCompletionFn({
        data: { sessionId: "", competitionId: "comp_a" },
      }),
    ).rejects.toThrow()
  })
})
