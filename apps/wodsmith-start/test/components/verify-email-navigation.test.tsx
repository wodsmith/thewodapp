import { act, cleanup, render, screen } from "@testing-library/react"
import { StrictMode, type ComponentType } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Route } from "@/routes/_auth/verify-email"

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), verify: vi.fn() }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => ({ token: "mailbox-token" }),
  }),
  useRouter: () => ({ navigate: mocks.navigate }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/sign-in">{children}</a>
  ),
}))
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => mocks.verify }))
vi.mock("@/server-fns/auth-fns", async () => ({
  verifyEmailFn: vi.fn(),
  verifyEmailSchema: (await import("@/schemas/auth.schema")).verifyEmailSchema,
}))
vi.mock("@/server-fns/volunteer-fns", () => ({ confirmVolunteerSignupFn: vi.fn() }))
const Page = Route.options.component as ComponentType

describe("verification navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.verify.mockResolvedValue({ success: true })
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Verification redirect cancellation]]
  it("cancels the successful verification redirect when leaving the page", async () => {
    const page = render(<Page />)
    await act(async () => {})
    expect(screen.getByText("Email Verified!")).toBeInTheDocument()
    page.unmount()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Late verification completion]]
  it("does not schedule navigation when the request finishes after unmount", async () => {
    let finish!: (value: unknown) => void
    mocks.verify.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const page = render(<Page />)
    page.unmount()
    await act(async () => {
      finish({ success: true })
    })
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  // @lat: [[auth-boundary-tests#Account boundary regressions#Mounted verification success]]
  it("verifies once in StrictMode and navigates while still mounted", async () => {
    render(
      <StrictMode>
        <Page />
      </StrictMode>,
    )
    await act(async () => {})
    expect(screen.getByText("Email Verified!")).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(mocks.verify).toHaveBeenCalledTimes(1)
    expect(mocks.navigate).toHaveBeenCalledTimes(1)
  })
})
