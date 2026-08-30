import type { CaptureResult } from "posthog-js"
import { describe, expect, it } from "vitest"

import { filterPostHogEvent } from "@/lib/posthog/event-filter"

function exceptionEvent(value: string): CaptureResult {
  return {
    uuid: "exception-event-id",
    event: "$exception",
    properties: {
      $exception_list: [{ type: "TypeError", value }],
    },
  }
}

describe("filterPostHogEvent", () => {
  it("drops the broken Instagram iOS webview bridge exception", () => {
    const event = exceptionEvent(
      "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
    )

    expect(filterPostHogEvent(event)).toBeNull()
  })

  it("preserves unrelated exceptions", () => {
    const event = exceptionEvent("Something in the application failed")

    expect(filterPostHogEvent(event)).toBe(event)
  })

  it("preserves non-exception events", () => {
    const event: CaptureResult = {
      uuid: "pageview-event-id",
      event: "$pageview",
      properties: {},
    }

    expect(filterPostHogEvent(event)).toBe(event)
  })
})
