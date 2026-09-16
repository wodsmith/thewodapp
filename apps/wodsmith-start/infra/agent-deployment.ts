/** Resolve public agent URLs without enabling production during a demo rollout. */
export function resolveAgentDeployment(
  stage: string,
  appUrl: string | undefined,
  resourceOverride: string | undefined,
) {
  const resource = resourceOverride ??
    (stage === "demo" ? "https://mcp-demo.wodsmith.com/mcp" : "")
  if (!resource) return undefined

  const domains = {
    demo: { authOrigin: "https://demo.wodsmith.com", domain: "mcp-demo.wodsmith.com" },
    prod: { authOrigin: "https://wodsmith.com", domain: "mcp.wodsmith.com" },
  }
  if (stage !== "demo" && stage !== "prod") {
    throw new Error("Hosted agent access is only configured for demo and prod")
  }
  const config = domains[stage]
  if (appUrl !== config.authOrigin || resource !== `https://${config.domain}/mcp`) {
    throw new Error(`Agent OAuth URLs must match the ${stage} environment`)
  }
  return { ...config, resource }
}
