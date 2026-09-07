import { and, eq } from "drizzle-orm"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { commercePurchaseTable } from "@/db/schema"
const state = vi.hoisted(() => ({
  findPurchase: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  stripeRetrieve: vi.fn(),
  coupon: vi.fn(),
}))
vi.mock("@/db", () => ({
  getDb: () => ({
    query: {
      commercePurchaseTable: { findFirst: state.findPurchase },
      productCouponRedemptionsTable: { findFirst: state.coupon },
    },
    select: state.select,
  }),
}))
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ paymentIntents: { retrieve: state.stripeRetrieve } }),
}))
import { getInvoiceDetails } from "@/server/commerce/purchases"
const target = {
  id: "a",
  userId: "owner",
  status: "COMPLETED",
  totalCents: 1500,
  platformFeeCents: 100,
  stripeFeeCents: 50,
  stripeCheckoutSessionId: "cs_group",
  stripePaymentIntentId: "pi_group",
  divisionId: null,
  competitionId: null,
  completedAt: new Date("2026-01-01"),
  createdAt: new Date("2026-01-01"),
  product: {
    id: "p",
    name: "Registration",
    type: "COMPETITION_REGISTRATION",
    priceCents: 1350,
  },
  user: { firstName: "Test", lastName: "Athlete", email: "test@example.com" },
  couponRedemption: { coupon: { code: "SAVE" }, amountOffCents: 500 },
}
beforeEach(() => {
  state.findPurchase.mockResolvedValue(target)
  state.select.mockReturnValue({ from: () => ({ where: state.where }) })
  state.where.mockResolvedValue([
    target,
    { ...target, id: "b", status: "PENDING" },
  ])
  state.stripeRetrieve.mockResolvedValue({
    latest_charge: {
      payment_method_details: {
        type: "card",
        card: { brand: "visa", last4: "4242" },
      },
      receipt_url: "https://receipt.example/test",
    },
  })
})
describe("Invoice data grouping", () => {
  // @lat: [[billing-group-tests#Billing Group Tests#Invoice detail group agreement]]
  it("returns mixed status and per-item states while preserving totals, coupon and provider data", async () => {
    const invoice = await getInvoiceDetails("a", "owner")
    expect(invoice).toMatchObject({
      status: "MIXED",
      totalCents: 3000,
      stripePaymentIntentId: "pi_group",
      coupon: { code: "SAVE", amountOffCents: 500 },
      stripe: {
        brand: "visa",
        last4: "4242",
        receiptUrl: "https://receipt.example/test",
      },
    })
    expect(invoice?.lineItems.map((item) => item.status)).toEqual([
      "COMPLETED",
      "PENDING",
    ])
    expect(invoice?.lineItems.map((item) => item.registrationFeeCents)).toEqual(
      [1350, 1350],
    )
    expect(state.stripeRetrieve).toHaveBeenCalledWith("pi_group", {
      expand: ["latest_charge"],
    })
  })
  // @lat: [[billing-group-tests#Billing Group Tests#Invoice ownership boundary]]
  it("keeps both target and sibling queries scoped to the authenticated owner", async () => {
    await getInvoiceDetails("a", "owner")
    const dialect = new MySqlDialect()
    const targetWhere = state.findPurchase.mock.calls[0][0].where(
      commercePurchaseTable,
      { and, eq },
    )
    expect(dialect.sqlToQuery(targetWhere).params).toEqual(["a", "owner"])
    expect(dialect.sqlToQuery(state.where.mock.calls[0][0]).params).toEqual([
      "cs_group",
      "owner",
    ])
    state.findPurchase.mockResolvedValue(null)
    state.select.mockClear()
    state.stripeRetrieve.mockClear()
    expect(await getInvoiceDetails("a", "outsider")).toBeNull()
    expect(state.select).not.toHaveBeenCalled()
    expect(state.stripeRetrieve).not.toHaveBeenCalled()
  })
  it("preserves paid standalone behavior and gracefully handles unavailable provider details", async () => {
    state.findPurchase.mockResolvedValue({
      ...target,
      stripeCheckoutSessionId: null,
    })
    state.stripeRetrieve.mockRejectedValue(new Error("Provider unavailable"))
    const invoice = await getInvoiceDetails("a", "owner")
    expect(invoice).toMatchObject({
      status: "COMPLETED",
      totalCents: 1500,
      stripe: null,
    })
    expect(state.select).not.toHaveBeenCalled()
  })
})
