import { describe, expect, it } from "vitest"
import {
  getInvoiceStatus,
  getInvoiceStatusLabel,
  groupByInvoice,
} from "@/utils/invoice-groups"
const statuses = ["COMPLETED", "PENDING", "REFUNDED", "CANCELLED", "FAILED"]
const combinations = statuses.flatMap((a) =>
  statuses.flatMap((b) => statuses.map((c) => [a, b, c])),
)
const purchase = (
  id: string,
  status = "COMPLETED",
  session: string | null = "cs",
  date = "2026-01-01",
) => ({
  id,
  status,
  stripeCheckoutSessionId: session,
  totalCents: 1500,
  createdAt: new Date(date),
  stripePaymentIntentId: "pi_shared",
  platformFeeCents: 100,
  stripeFeeCents: 50,
})
describe("Invoice group policy", () => {
  // @lat: [[billing-group-tests#Billing Group Tests#Status permutations]]
  it.each(combinations)(
    "derives every permutation of %s, %s, %s without precedence",
    (a, b, c) => {
      const expected = a === b && b === c ? a : "MIXED"
      for (const values of [
        [a, b, c],
        [a, c, b],
        [b, a, c],
        [b, c, a],
        [c, a, b],
        [c, b, a],
      ]) {
        const rows = values.map((status, index) =>
          purchase(String(index), status),
        )
        expect(getInvoiceStatus(rows)).toBe(expected)
        expect(groupByInvoice(rows)[0]).toMatchObject({
          status: expected,
          totalCents: 4500,
        })
      }
    },
  )
  // @lat: [[billing-group-tests#Billing Group Tests#Stable grouping and gross amounts]]
  it("keeps checkout boundaries, missing sessions, stable links and original amounts across permutations", () => {
    const rows = [
      purchase("new", "PENDING", "cs_new", "2026-02-01"),
      purchase("b", "REFUNDED"),
      purchase("a"),
      purchase("cs", "FAILED", null),
      purchase("standalone", "CANCELLED", null),
    ]
    const original = structuredClone(rows)
    const groups = groupByInvoice(rows)
    expect(groups.map((group) => group.primary.id)).toEqual([
      "new",
      "a",
      "cs",
      "standalone",
    ])
    expect(groups[1]).toMatchObject({
      id: "checkout:cs",
      totalCents: 3000,
      status: "MIXED",
      statusSummary: "1 Paid · 1 Refunded",
    })
    expect(groups[1].purchases.map((row) => row.id)).toEqual(["a", "b"])
    for (const row of groups.flatMap((group) => group.purchases)) {
      expect(row.stripePaymentIntentId).toBe("pi_shared")
      expect(row.platformFeeCents).toBe(100)
      expect(row.stripeFeeCents).toBe(50)
    }
    expect(groupByInvoice([...rows].reverse())).toEqual(groups)
    expect(
      groupByInvoice([rows[2], rows[4], rows[0], rows[3], rows[1]]),
    ).toEqual(groups)
    expect(rows).toEqual(original)
  })
  it("keeps zero-valued and fully refunded totals as recorded and preserves unknown states", () => {
    expect(
      groupByInvoice([{ ...purchase("free"), totalCents: 0 }])[0].totalCents,
    ).toBe(0)
    expect(groupByInvoice([purchase("refunded", "REFUNDED")])[0]).toMatchObject(
      { status: "REFUNDED", totalCents: 1500 },
    )
    expect(getInvoiceStatusLabel("REFUNDED")).toBe("Refunded")
    expect(getInvoiceStatusLabel("PARTIALLY_REFUNDED")).toBe(
      "Partially refunded",
    )
    expect(getInvoiceStatus([{ status: "REVIEW" }])).toBe("REVIEW")
    expect(
      getInvoiceStatus([{ status: "REVIEW" }, { status: "COMPLETED" }]),
    ).toBe("MIXED")
    expect(getInvoiceStatus([])).toBe("UNKNOWN")
    expect(groupByInvoice([])).toEqual([])
  })
})
