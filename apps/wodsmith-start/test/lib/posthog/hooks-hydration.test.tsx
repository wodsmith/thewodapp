import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useFeatureFlagEnabled } from "@/lib/posthog/hooks"

const { flagState, mockPostHog } = vi.hoisted(() => {
  const flagState = { enabled: false }
  return {
    flagState,
    mockPostHog: {
      isFeatureEnabled: vi.fn(() => flagState.enabled),
      onFeatureFlags: vi.fn(() => () => undefined),
    },
  }
})

vi.mock("@/lib/posthog/provider", () => ({
  usePostHog: () => ({ posthog: mockPostHog }),
}))

function FlaggedNavigation() {
  const enabled = useFeatureFlagEnabled("benchmark-comp-type")
  return <nav>{enabled ? <a href="/benchmarks">Benchmarks</a> : null}</nav>
}

describe("useFeatureFlagEnabled hydration", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    flagState.enabled = false
  })

  // @lat: [[competition-type-capabilities#Benchmark Rollout Gates#Hydration-Stable Navigation Flag]]
  it("matches SSR before applying a persisted browser flag", async () => {
    flagState.enabled = false
    const serverMarkup = renderToString(<FlaggedNavigation />)
    document.body.innerHTML = `<div id="root">${serverMarkup}</div>`

    flagState.enabled = true
    const recoverableErrors: Error[] = []
    const container = document.getElementById("root")
    expect(container).not.toBeNull()

    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container as HTMLElement, <FlaggedNavigation />, {
        onRecoverableError: (error) => {
          recoverableErrors.push(
            error instanceof Error ? error : new Error(String(error)),
          )
        },
      })
    })

    expect(recoverableErrors).toEqual([])
    expect(container?.querySelector('a[href="/benchmarks"]')).not.toBeNull()

    await act(async () => root?.unmount())
  })
})
