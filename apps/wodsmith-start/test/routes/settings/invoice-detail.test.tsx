import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { InvoiceDetails } from "@/server/commerce/purchases"
const state = vi.hoisted(() => ({ invoice: {} as InvoiceDetails }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData: () => state,
    useSearch: () => ({}),
  }),
  notFound: vi.fn(),
  Link: ({ children, to }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock("@/server-fns/athlete-profile-fns", () => ({
  getInvoiceDetailsFn: vi.fn(),
}))
vi.mock(
  "@/routes/_protected/settings/billing/-components/download-invoice-button",
  () => ({
    DownloadInvoiceButton: () => <button type="button">Download PDF</button>,
  }),
)
vi.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Page: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  View: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  Text: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  StyleSheet: { create: (styles: unknown) => styles },
}))
import { Route } from "@/routes/_protected/settings/billing/$purchaseId"
import { InvoicePDF } from "@/routes/_protected/settings/billing/-components/invoice-pdf"
const Page = Route.options.component as React.ComponentType
const invoice: InvoiceDetails = {
  id: "a",
  status: "MIXED",
  totalCents: 3000,
  stripePaymentIntentId: "pi",
  completedAt: null,
  createdAt: new Date("2026-01-01"),
  product: {
    id: "product",
    name: "Registration",
    type: "COMPETITION_REGISTRATION",
    priceCents: 1350,
  },
  competition: null,
  user: { firstName: "Test", lastName: "Athlete", email: "test@example.com" },
  stripe: null,
  coupon: null,
  lineItems: ["COMPLETED", "PENDING"].map((status, index) => ({
    purchaseId: String(index),
    status,
    divisionLabel: null,
    totalCents: 1500,
    platformFeeCents: 100,
    stripeFeeCents: 50,
    registrationFeeCents: 1350,
  })),
}
afterEach(cleanup)
describe("Invoice status surfaces", () => {
  // @lat: [[billing-group-tests#Billing Group Tests#Detail and PDF status visibility]]
  it("shows aggregate and individual statuses on the detail page and PDF content", () => {
    state.invoice = invoice
    const { unmount } = render(<Page />)
    expect(screen.getByText("Mixed status")).toBeInTheDocument()
    expect(screen.getByText("Paid")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("$30.00")).toBeInTheDocument()
    unmount()
    render(<InvoicePDF invoice={invoice} />)
    expect(screen.getByText("MIXED STATUS")).toBeInTheDocument()
    expect(screen.getByText("Paid")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("$30.00")).toBeInTheDocument()
  })
})
