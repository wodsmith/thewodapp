import { describe, expect, it } from "vitest"
import {
  CREW_AUTH_FALLBACK_PATH,
  getCrewAuthRedirect,
  sanitizeCrewAuthRedirect,
} from "./auth-redirect"

describe("Crew auth redirects", () => {
  it("preserves Crew workflow destinations", () => {
    expect(
      getCrewAuthRedirect({
        pathname: "/events/comp_123/assignments",
        searchStr: "?tab=judges",
      }),
    ).toBe("/events/comp_123/assignments?tab=judges")
  })

  it("falls back for unsafe or looping redirects", () => {
    expect(sanitizeCrewAuthRedirect("https://example.com/events")).toBe(
      CREW_AUTH_FALLBACK_PATH,
    )
    expect(sanitizeCrewAuthRedirect("//example.com/events")).toBe(
      CREW_AUTH_FALLBACK_PATH,
    )
    expect(sanitizeCrewAuthRedirect("/sign-in?redirect=/events")).toBe(
      CREW_AUTH_FALLBACK_PATH,
    )
    expect(sanitizeCrewAuthRedirect("/sign-up?redirect=/events")).toBe(
      CREW_AUTH_FALLBACK_PATH,
    )
  })
})
