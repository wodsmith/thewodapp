import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentType, ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  check: vi.fn(),
  invalidate: vi.fn(),
  competition: {
    id: "comp_a",
    slug: "test",
    name: "Test Competition",
    competitionType: "in-person",
  },
}))
const router = { invalidate: mocks.invalidate }
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useLoaderData: () => mocks.data,
    useParams: () => ({ slug: "test" }),
  }),
  getRouteApi: () => ({
    useLoaderData: () => ({ competition: mocks.competition }),
  }),
  useRouter: () => router,
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/compete/test">{children}</a>
  ),
  redirect: (value: unknown) => value,
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }))
vi.mock("@/server-fns/competition-detail-fns", () => ({
  checkCheckoutCompletionFn: mocks.check,
  getUserCompetitionRegistrationsFn: vi.fn(),
  getUserCompetitionRegistrationFn: vi.fn(),
}))
vi.mock("@/server-fns/registration-fns", () => ({
  getUserAffiliateNameFn: vi.fn(),
}))
vi.mock("@/server-fns/registration-fulfillment-fns", () => ({
  getMyCompetitionFulfillmentFn: vi.fn(),
}))
vi.mock("@/server-fns/athlete-profile-fns", () => ({
  getRegistrationSuccessDataFn: vi.fn(),
  updateAthleteBasicProfileFn: vi.fn(),
}))
vi.mock("@/lib/env", () => ({ getAppUrlFn: vi.fn() }))
vi.mock("@/components/competition-registered-banner", () => ({
  CompetitionRegisteredBanner: () => <div>Registration confirmed banner</div>,
}))
vi.mock("@/components/competition-share-card", () => ({
  CompetitionShareCard: () => <div>Registration confirmed card</div>,
}))
vi.mock("@/components/competition-tabs", () => ({
  CompetitionTabs: () => null,
}))
vi.mock("@/components/registration/registration-fulfillment-card", () => ({
  RegistrationFulfillmentCard: () => null,
}))
vi.mock("@/components/registration/profile-completion-form", () => ({
  ProfileCompletionForm: () => null,
}))
vi.mock("@/components/registration/copy-invite-link", () => ({
  CopyInviteLink: () => null,
}))

import { Route as successRoute } from "@/routes/compete/$slug/register/success"
import { Route as registeredRoute } from "@/routes/compete/$slug/registered"

const Registered = (registeredRoute as unknown as { component: ComponentType })
  .component
const Success = (successRoute as unknown as { component: ComponentType })
  .component
beforeEach(() => {
  mocks.data = {
    competition: mocks.competition,
    slug: "test",
    athleteName: "Alice",
    items: [],
    fulfillment: { items: [], registrations: [], purchases: [], downloads: [] },
    sessionId: "cs_a",
    registration: null,
  }
  mocks.check.mockResolvedValue({
    ready: false,
    total: 0,
    pending: 0,
    status: "pending",
    registrationIds: [],
  })
  mocks.invalidate.mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// @lat: [[checkout-safety-tests#Checkout Safety Tests#Timeout does not confirm]]
it("offers recovery after polling times out without showing a success banner", async () => {
  vi.useFakeTimers()
  render(<Registered />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(61_000)
  })
  expect(
    screen.queryByText("Registration confirmed banner"),
  ).not.toBeInTheDocument()
  expect(screen.getByText("Registration not confirmed yet")).toBeInTheDocument()
  expect(
    screen.getByRole("button", { name: /check again/i }),
  ).toBeInTheDocument()
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Failed order recovery]]
it("shows failure recovery for a settled failed order even with an unrelated registration", async () => {
  mocks.data.items = [{ registrationId: "old_reg", divisionLabel: "RX" }]
  mocks.check.mockResolvedValue({
    ready: false,
    total: 1,
    pending: 0,
    status: "failed",
    registrationIds: [],
  })
  render(<Registered />)
  await act(async () => {})
  expect(
    screen.queryByText("Registration confirmed banner"),
  ).not.toBeInTheDocument()
  expect(screen.getByText(/could not be completed/i)).toBeInTheDocument()
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Confirmation requires loaded participation]]
it("shows success only when the completed checkout matches a loaded registration", async () => {
  mocks.data.items = [{ registrationId: "reg_a", divisionLabel: "RX" }]
  mocks.check.mockResolvedValue({
    ready: true,
    total: 1,
    pending: 0,
    status: "confirmed",
    registrationIds: ["reg_a"],
  })
  render(<Registered />)
  await act(async () => {})
  expect(screen.getByText("Registration confirmed banner")).toBeInTheDocument()
  expect(mocks.check).toHaveBeenCalledWith({
    data: { sessionId: "cs_a", competitionId: "comp_a" },
  })
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Alternate success without proof]]
it("does not assert successful payment on the alternate route without registration evidence", () => {
  render(<Success />)
  expect(
    screen.queryByText(/Your payment was successful/i),
  ).not.toBeInTheDocument()
  expect(screen.getByText("Registration not confirmed yet")).toBeInTheDocument()
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Alternate checkout uses shared confirmation]]
it("redirects alternate session returns to the same evidence-gated route before fetching success data", async () => {
  const loader = (
    successRoute as unknown as { loader: (ctx: unknown) => Promise<unknown> }
  ).loader
  await expect(
    loader({
      params: { slug: "test" },
      context: { session: { userId: "alice" } },
      deps: { session_id: "cs_a" },
      parentMatchPromise: Promise.resolve({
        loaderData: { competition: mocks.competition },
      }),
    }),
  ).rejects.toMatchObject({
    to: "/compete/$slug/registered",
    search: { session_id: "cs_a" },
  })
})

// @lat: [[checkout-safety-tests#Checkout Safety Tests#Retry and route changes preserve evidence]]
it("can retry after timeout and does not reuse confirmation for another session", async () => {
  vi.useFakeTimers()
  const view = render(<Registered />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(61_000)
  })
  mocks.data.items = [{ registrationId: "reg_a", divisionLabel: "RX" }]
  mocks.check.mockResolvedValueOnce({
    ready: true,
    status: "confirmed",
    total: 1,
    pending: 0,
    registrationIds: ["reg_a"],
  })
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /check again/i }))
  })
  expect(screen.getByText("Registration confirmed banner")).toBeInTheDocument()
  mocks.data.sessionId = "cs_other"
  view.rerender(<Registered />)
  expect(
    screen.queryByText("Registration confirmed banner"),
  ).not.toBeInTheDocument()
  // Navigating to a free/existing registration does not inherit a pending session.
  mocks.data.sessionId = null
  view.rerender(<Registered />)
  expect(screen.getByText("Registration confirmed banner")).toBeInTheDocument()
})
// @lat: [[checkout-safety-tests#Checkout Safety Tests#Missing loaded registration stays unconfirmed]]
it("does not render a banner when confirmed participation has not loaded yet", async () => {
  mocks.check.mockResolvedValueOnce({
    ready: true,
    status: "confirmed",
    total: 1,
    pending: 0,
    registrationIds: ["reg_a"],
  })
  render(<Registered />)
  await act(async () => {})
  expect(
    screen.queryByText("Registration confirmed banner"),
  ).not.toBeInTheDocument()
  expect(screen.getByText("Registration not confirmed yet")).toBeInTheDocument()
})
