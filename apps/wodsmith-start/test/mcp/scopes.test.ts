import { describe, expect, it } from "vitest"
import { hasScope, MCP_SCOPES } from "@/mcp/scopes"

describe("hasScope", () => {
  it("returns false when no props are provided (anonymous request)", () => {
    expect(hasScope(undefined, MCP_SCOPES.EVENTS_LIST)).toBe(false)
    expect(hasScope(undefined, MCP_SCOPES.EVENTS_READ)).toBe(false)
  })

  it("returns false when scope is not in the granted list", () => {
    const props = { userId: "u1", scopes: [MCP_SCOPES.EVENTS_LIST] }
    expect(hasScope(props, MCP_SCOPES.EVENTS_READ)).toBe(false)
  })

  it("returns true when scope is granted", () => {
    const props = {
      userId: "u1",
      scopes: [MCP_SCOPES.EVENTS_LIST, MCP_SCOPES.EVENTS_READ],
    }
    expect(hasScope(props, MCP_SCOPES.EVENTS_LIST)).toBe(true)
    expect(hasScope(props, MCP_SCOPES.EVENTS_READ)).toBe(true)
  })

  it("handles missing scopes array defensively", () => {
    const props = { userId: "u1", scopes: undefined as never }
    expect(hasScope(props, MCP_SCOPES.EVENTS_LIST)).toBe(false)
  })
})
