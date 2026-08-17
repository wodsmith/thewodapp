import type { CaptureResult } from "posthog-js"

const INSTAGRAM_WEBVIEW_BRIDGE = "window.webkit.messageHandlers"

/**
 * Drop errors from Instagram's injected iOS webview bridge while preserving
 * application exceptions and every other PostHog event.
 */
// @lat: [[architecture#Client Error Filtering]]
export function filterPostHogEvent(
  event: CaptureResult | null,
): CaptureResult | null {
  if (event?.event !== "$exception") {
    return event
  }

  const exceptionList = event.properties.$exception_list
  const isInstagramBridgeError =
    Array.isArray(exceptionList) &&
    exceptionList.some(
      (exception) =>
        typeof exception?.value === "string" &&
        exception.value.includes(INSTAGRAM_WEBVIEW_BRIDGE),
    )

  return isInstagramBridgeError ? null : event
}
