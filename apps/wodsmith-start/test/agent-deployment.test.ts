import { describe, expect, it } from "vitest"
import { resolveAgentDeployment } from "../infra/agent-deployment"

describe("agent deployment boundaries", () => {
  // @lat: [[agent-gateway#Demo deployment defaults]]
  it("enables the demo endpoint while leaving ordinary production deployments disabled", () => {
    expect(resolveAgentDeployment("demo", "https://demo.wodsmith.com", undefined)).toEqual({
      authOrigin: "https://demo.wodsmith.com",
      domain: "mcp-demo.wodsmith.com",
      resource: "https://mcp-demo.wodsmith.com/mcp",
    })
    expect(resolveAgentDeployment("prod", "https://wodsmith.com", undefined)).toBeUndefined()
    expect(resolveAgentDeployment("dev", "http://localhost:3000", undefined)).toBeUndefined()
    expect(resolveAgentDeployment("demo", "https://demo.wodsmith.com", "")).toBeUndefined()
    expect(resolveAgentDeployment("prod", "https://wodsmith.com", "https://mcp.wodsmith.com/mcp")).toMatchObject({ domain: "mcp.wodsmith.com" })
  })

  // @lat: [[agent-gateway#Deployment origin isolation]]
  it("rejects cross-environment and noncanonical authorization or resource URLs", () => {
    for (const [stage, appUrl, resource] of [
      ["demo", "https://wodsmith.com", undefined],
      ["demo", "https://demo.wodsmith.com", "https://mcp.wodsmith.com/mcp"],
      ["prod", "https://wodsmith.com", "https://mcp-demo.wodsmith.com/mcp"],
      ["demo", "https://demo.wodsmith.com", "http://mcp-demo.wodsmith.com/mcp"],
      ["demo", "https://demo.wodsmith.com", "https://mcp-demo.wodsmith.com/mcp?test=1"],
      ["dev", "http://localhost:3000", "https://mcp-demo.wodsmith.com/mcp"],
    ]) {
      expect(() => resolveAgentDeployment(stage!, appUrl, resource)).toThrow()
    }
  })
})
