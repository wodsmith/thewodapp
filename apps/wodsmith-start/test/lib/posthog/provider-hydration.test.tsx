import { act, render } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PostHogProvider } from "@/lib/posthog/provider"

const { capturePageview, initPostHog, subscribe } = vi.hoisted(() => ({
  capturePageview: vi.fn(),
  initPostHog: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}))

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ subscribe }),
}))

vi.mock("@/lib/posthog/client", () => ({
  capturePageleave: vi.fn(),
  capturePageview,
  getPostHog: vi.fn(() => ({})),
  initPostHog,
}))

describe("PostHogProvider hydration timing", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // @lat: [[architecture#Tech Stack#SSR Theme Hydration#Deferred Analytics Initialization]]
  it("waits for document load and browser idle before initializing", async () => {
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading")

    let idleCallback: IdleRequestCallback | undefined
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback) => {
      idleCallback = callback
      return 17
    })
    const cancelIdleCallback = vi.fn()
    vi.stubGlobal("requestIdleCallback", requestIdleCallback)
    vi.stubGlobal("cancelIdleCallback", cancelIdleCallback)

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <PostHogProvider>{children}</PostHogProvider>
    )
    const view = render(<div>Hydrating route</div>, { wrapper: Wrapper })

    expect(initPostHog).not.toHaveBeenCalled()
    expect(requestIdleCallback).not.toHaveBeenCalled()

    act(() => window.dispatchEvent(new Event("load")))

    expect(requestIdleCallback).toHaveBeenCalledOnce()
    expect(initPostHog).not.toHaveBeenCalled()

    act(() =>
      idleCallback?.({ didTimeout: false, timeRemaining: () => 50 }),
    )

    expect(initPostHog).toHaveBeenCalledOnce()
    expect(capturePageview).toHaveBeenCalledOnce()

    view.unmount()
    expect(cancelIdleCallback).toHaveBeenCalledWith(17)
  })
})
