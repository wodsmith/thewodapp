import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { and, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/mysql2"
import { createPool } from "mysql2/promise"
import type Stripe from "stripe"
import * as schema from "@/db/schema"
import { competitionsTable } from "@/db/schemas/competitions"
import { crewEventSettingsTable } from "@/db/schemas/crew-event-settings"
import { crewBillingEventsTable } from "@/db/schemas/crew-billing-events"
import { planTable } from "@/db/schemas/entitlements"
import { parseCrewCheckoutSessionWebhook } from "@/lib/crew/checkout-webhooks"
import { readCrewCheckoutAttempt } from "@/lib/crew/checkout-attempt"

const { stripeCreate, stripeRetrieve, sessionCookie, managerAccess } = vi.hoisted(() => ({
  stripeCreate: vi.fn(), stripeRetrieve: vi.fn(), sessionCookie: vi.fn(), managerAccess: vi.fn(),
}))
const databaseUrl = process.env.CREW_TEST_DATABASE_URL
if (databaseUrl && !/_(test|e2e)$/.test(new URL(databaseUrl).pathname)) {
  throw new Error("Crew integration tests require a dedicated _test or _e2e database")
}
const pool = databaseUrl ? createPool(databaseUrl) : null
const db = pool ? drizzle(pool, { schema, mode: "default", casing: "snake_case" }) : null
vi.mock("@/db", () => ({ getDb: () => db }))
vi.mock("cloudflare:workers", () => ({ env: {
  CREW_STRIPE_CHECKOUT_ENABLED: "true", STRIPE_SECRET_KEY: "test-only", STRIPE_WEBHOOK_SECRET: "test-only",
} }))
vi.mock("@/lib/env", () => ({ getAppUrl: () => "https://crew.example.com" }))
vi.mock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: {
  create: stripeCreate, retrieve: stripeRetrieve,
} } }) }))
vi.mock("@/utils/auth", () => ({ getSessionFromCookie: sessionCookie, requireAdmin: vi.fn() }))
vi.mock("@/server/crew-auth.server", () => ({ requireCrewEventManagerAccess: managerAccess }))

import {
  createCrewCheckoutSession, completeCrewCheckoutSessionFromWebhook,
  expireCrewCheckoutSessionFromWebhook, requireCrewSchedulePurchase,
} from "@/server/crew-billing.server"

const sessions = new Map<string, Stripe.Checkout.Session>()
let eventId: string
let settingsId: string
const eventIds: string[] = []

function fakeCreate(params: Stripe.Checkout.SessionCreateParams, options: { idempotencyKey: string }) {
  const existing = sessions.get(options.idempotencyKey)
  if (existing) return existing
  const session = {
    id: `cs_${sessions.size + 1}`, url: `https://checkout.stripe.com/test_${sessions.size + 1}`,
    status: "open", payment_status: "unpaid", metadata: params.metadata,
    amount_total: params.line_items?.[0].price_data?.unit_amount,
    currency: "usd", payment_intent: `pi_${sessions.size + 1}`,
  } as Stripe.Checkout.Session
  sessions.set(options.idempotencyKey, session)
  return session
}

async function settings() {
  const [row] = await db!.select().from(crewEventSettingsTable).where(eq(crewEventSettingsTable.id, settingsId))
  return row
}

function completion(session: Stripe.Checkout.Session) {
  return parseCrewCheckoutSessionWebhook({
    stripeEventId: `evt_${session.id}`, sessionId: session.id, metadata: session.metadata,
    amountTotal: session.amount_total, currency: session.currency,
    paymentIntentId: session.payment_intent as string,
  })
}

// @lat: [[crew#Crew Purchase Integration Tests]]
describe.skipIf(!databaseUrl)("Crew purchase persistence", () => {
  beforeAll(async () => {
    await db!.insert(planTable).values({ id: "crew_basic", name: "Crew Basic", price: 20000 })
      .onDuplicateKeyUpdate({ set: { price: 20000, isActive: 1, isPublic: 1, interval: null } })
  })
  beforeEach(async () => {
    sessions.clear()
    eventId = `comp_purchase_${crypto.randomUUID()}`
    settingsId = `crewset_${crypto.randomUUID()}`
    eventIds.push(eventId)
    await db!.insert(competitionsTable).values({
      id: eventId, name: "Purchase test", slug: eventId, organizingTeamId: "team_purchase_owner",
      competitionTeamId: "team_purchase_event", startDate: "2026-09-10", endDate: "2026-09-10",
    })
    await db!.insert(crewEventSettingsTable).values({
      id: settingsId, competitionId: eventId, settings: JSON.stringify({ setup: { note: "preserve" } }),
    })
    await db!.update(planTable).set({ price: 20000 }).where(eq(planTable.id, "crew_basic"))
    sessionCookie.mockResolvedValue({ user: { id: "user_owner", email: "owner@example.com", role: "admin" }, teams: [] })
    managerAccess.mockImplementation(() => sessionCookie())
    stripeCreate.mockImplementation(fakeCreate)
    stripeRetrieve.mockImplementation((id: string) => [...sessions.values()].find(s => s.id === id))
  })
  afterAll(async () => {
    for (const id of eventIds) {
      await db!.delete(crewBillingEventsTable).where(eq(crewBillingEventsTable.competitionId, id))
      await db!.delete(crewEventSettingsTable).where(eq(crewEventSettingsTable.competitionId, id))
      await db!.delete(competitionsTable).where(eq(competitionsTable.id, id))
    }
    await pool?.end()
  })

  it("requires settlement before exports and records duplicate payment only once", async () => {
    await expect(requireCrewSchedulePurchase({ eventId })).rejects.toThrow(/Purchase/)
    await createCrewCheckoutSession({ eventId })
    await expect(requireCrewSchedulePurchase({ eventId })).rejects.toThrow(/Purchase/)
    const session = [...sessions.values()][0]
    await completeCrewCheckoutSessionFromWebhook(completion(session))
    expect(await completeCrewCheckoutSessionFromWebhook(completion(session))).toEqual({ status: "duplicate" })
    await expect(requireCrewSchedulePurchase({ eventId })).resolves.toBeUndefined()
    expect((await settings()).crewBillingState).toBe("paid")
    const events = await db!.select().from(crewBillingEventsTable).where(and(
      eq(crewBillingEventsTable.competitionId, eventId), eq(crewBillingEventsTable.eventType, "checkout_completed"),
    ))
    expect(events).toHaveLength(1)
  })

  it("serializes simultaneous purchases into one session and one creation audit", async () => {
    const results = await Promise.all([createCrewCheckoutSession({ eventId }), createCrewCheckoutSession({ eventId })])
    expect(results[0]).toEqual(results[1])
    expect(sessions.size).toBe(1)
    const events = await db!.select().from(crewBillingEventsTable).where(eq(crewBillingEventsTable.competitionId, eventId))
    expect(events).toHaveLength(1)
  })

  it("resumes canceled checkout without creating a second session", async () => {
    const first = await createCrewCheckoutSession({ eventId })
    expect(await createCrewCheckoutSession({ eventId })).toEqual(first)
    expect(stripeCreate).toHaveBeenCalledTimes(1)
  })

  it("retries an uncertain response with the original key and frozen price/name", async () => {
    stripeCreate.mockImplementationOnce((params, options) => {
      fakeCreate(params, options)
      throw new Error("Network timeout after Stripe created session")
    })
    await expect(createCrewCheckoutSession({ eventId })).rejects.toThrow(/Network timeout/)
    await db!.update(competitionsTable).set({ name: "Renamed event" }).where(eq(competitionsTable.id, eventId))
    await db!.update(planTable).set({ price: 25000 }).where(eq(planTable.id, "crew_basic"))
    await createCrewCheckoutSession({ eventId })
    expect(stripeCreate.mock.calls[0]).toEqual(stripeCreate.mock.calls[1])
    expect(sessions.size).toBe(1)
    expect(JSON.parse((await settings()).settings!).setup.note).toBe("preserve")
  })

  it("replaces expired checkout and ignores stale expiration and settlement", async () => {
    await createCrewCheckoutSession({ eventId })
    const old = [...sessions.values()][0]
    old.status = "expired"
    await expireCrewCheckoutSessionFromWebhook(old)
    expect((await settings()).crewBillingState).toBe("unpaid")
    await createCrewCheckoutSession({ eventId })
    expect(sessions.size).toBe(2)
    await expireCrewCheckoutSessionFromWebhook(old)
    expect((await settings()).crewBillingState).toBe("pending")
    await expect(completeCrewCheckoutSessionFromWebhook(completion(old))).rejects.toThrow(/session|attempt/)
    const current = [...sessions.values()][1]
    await completeCrewCheckoutSessionFromWebhook(completion(current))
    await expireCrewCheckoutSessionFromWebhook(old)
    expect((await settings()).crewBillingState).toBe("paid")
  })

  it("does not overwrite paid state when the webhook arrives before session persistence", async () => {
    stripeCreate.mockImplementationOnce(async (params, options) => {
      const session = fakeCreate(params, options)
      await completeCrewCheckoutSessionFromWebhook(completion(session))
      return session
    })
    await createCrewCheckoutSession({ eventId })
    expect((await settings()).crewBillingState).toBe("paid")
    const events = await db!.select().from(crewBillingEventsTable).where(
      eq(crewBillingEventsTable.competitionId, eventId),
    )
    expect(events.map((event) => event.eventType)).toEqual(["checkout_completed"])
  })

  it("lets schedule managers view access without granting purchase permission", async () => {
    sessionCookie.mockResolvedValue({ user: { id: "manager", role: "user" }, teams: [] })
    const { getCrewBillingOrganizerPage } = await import("@/server/crew-billing.server")
    const page = await getCrewBillingOrganizerPage({ eventId })
    expect(page.canPurchase).toBe(false)
    expect(page.viewModel).not.toHaveProperty("billing")
    expect(page.viewModel.plan.hasCrewEventAccess).toBe(false)
    expect(page.viewModel.checkout.status).not.toBe("available")
    await expect(createCrewCheckoutSession({ eventId })).rejects.toThrow(/FORBIDDEN/)
    expect(stripeCreate).not.toHaveBeenCalled()
  })

  it("blocks unauthorized buyers before Stripe and rejects unrelated event settlement", async () => {
    sessionCookie.mockResolvedValueOnce({ user: { id: "intruder", role: "user" }, teams: [] })
    await expect(createCrewCheckoutSession({ eventId })).rejects.toThrow(/FORBIDDEN/)
    expect(stripeCreate).not.toHaveBeenCalled()
    await createCrewCheckoutSession({ eventId })
    await expect(completeCrewCheckoutSessionFromWebhook({
      ...completion([...sessions.values()][0]), teamId: "team_intruder",
    })).rejects.toThrow(/scope/)
    expect((await settings()).crewBillingState).toBe("pending")
  })

  it("stops uncertain old attempts before idempotency expiry instead of charging again", async () => {
    stripeCreate.mockRejectedValueOnce(new Error("timeout"))
    await expect(createCrewCheckoutSession({ eventId })).rejects.toThrow("timeout")
    const row = await settings()
    const attempt = readCrewCheckoutAttempt(row.settings)!
    attempt.createdAt -= 24 * 3600_000
    await db!.update(crewEventSettingsTable).set({ settings: JSON.stringify({ checkoutAttempt: attempt }) })
      .where(eq(crewEventSettingsTable.id, settingsId))
    await expect(createCrewCheckoutSession({ eventId })).rejects.toThrow(/payment check/)
    expect(stripeCreate).toHaveBeenCalledTimes(1)
  })
})
