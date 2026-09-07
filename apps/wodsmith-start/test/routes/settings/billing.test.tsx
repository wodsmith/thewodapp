import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PurchaseWithDetails } from "@/server/commerce/purchases"
const state = vi.hoisted(() => ({ purchases: [] as PurchaseWithDetails[] }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => state,
  }),
  Link: ({
    children,
    params,
  }: React.PropsWithChildren<{ params: { purchaseId: string } }>) => (
    <a href={`/settings/billing/${params.purchaseId}`}>{children}</a>
  ),
}))
vi.mock("@/server-fns/athlete-profile-fns", () => ({
  getAthleteInvoicesDataFn: vi.fn(),
}))
import { Route } from "@/routes/_protected/settings/billing/index"
const Page = Route.options.component as React.ComponentType
const purchase = (id: string, status: string): PurchaseWithDetails => ({
  id,
  status,
  totalCents: 1500,
  platformFeeCents: 100,
  stripeFeeCents: 50,
  organizerNetCents: 1350,
  stripeCheckoutSessionId: "cs_group",
  stripePaymentIntentId: "pi_group",
  completedAt: null,
  createdAt: new Date("2026-01-01"),
  product: {
    id: "product",
    name: "Registration",
    type: "COMPETITION_REGISTRATION",
    priceCents: 1350,
  },
  competition: null,
})
afterEach(cleanup)
describe("Billing grouped status", () => {
  // @lat: [[billing-group-tests#Billing Group Tests#Mixed invoice list]]
  it.each(["PENDING", "FAILED", "REFUNDED", "CANCELLED"])(
    "does not show a paid group hiding a %s item in either order",
    (status) => {
      state.purchases = [purchase("a", "COMPLETED"), purchase("b", status)]
      const { rerender } = render(<Page />)
      expect(screen.getByText("Mixed status")).toBeInTheDocument()
      expect(
        screen.queryByText("Paid", { exact: true }),
      ).not.toBeInTheDocument()
      expect(screen.getByText("$30.00")).toBeInTheDocument()
      const href = screen.getByRole("link").getAttribute("href")
      state.purchases.reverse()
      rerender(<Page />)
      expect(screen.getByRole("link")).toHaveAttribute("href", href)
      expect(screen.getByText("Mixed status")).toBeInTheDocument()
    },
  )
  it("preserves a paid singleton and the empty list", () => {
    state.purchases = [purchase("paid", "COMPLETED")]
    const { rerender } = render(<Page />)
    expect(screen.getByText("Paid")).toBeInTheDocument()
    expect(screen.getByText("$15.00")).toBeInTheDocument()
    state.purchases = []
    rerender(<Page />)
    expect(screen.getByText("No invoices yet")).toBeInTheDocument()
  })
})
