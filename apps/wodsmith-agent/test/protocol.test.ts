import { describe, expect, it, vi } from "vitest"
import { handleGateway, type GatewayEnv } from "../src"
const ctx = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext
function setup() {
  const env: GatewayEnv = {
    AGENT_RESOURCE: "https://agent.example.com/mcp",
    AGENT_AUTH_ORIGIN: "https://app.example.com",
    TRAINING: {
      authorize: vi.fn(async () => true),
      listOperations: vi.fn(async () => [
        {
          name: "training_context",
          description: "Read accessible training",
          inputSchema: {
            type: "object" as const,
            properties: {},
            additionalProperties: false,
          },
          outputSchema: {
            type: "object" as const,
            properties: { value: { type: "string" } },
            required: ["value"],
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
      ]),
      execute: vi.fn(async () => ({
        ok: true as const,
        data: { value: "private training" },
      })),
    },
  }
  return env
}
async function rpc(
  env: GatewayEnv,
  method: string,
  params: object = {},
  version = "2025-11-25",
) {
  const response = await handleGateway(
    new Request(env.AGENT_RESOURCE, {
      method: "POST",
      headers: {
        Host: "agent.example.com",
        Authorization: "Bearer secret",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...("name" in params ? { "Mcp-Name": String(params.name) } : {}),
        "Mcp-Method": method,
        "MCP-Protocol-Version": version,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params:
          version === "2026-07-28"
            ? {
                ...params,
                _meta: {
                  "io.modelcontextprotocol/protocolVersion": version,
                  "io.modelcontextprotocol/clientCapabilities": {},
                },
              }
            : params,
      }),
    }),
    env,
    ctx,
  )
  const raw = await response.text()
  const data = raw.startsWith("event:")
    ? JSON.parse(raw.split("data: ")[1].split("\n")[0])
    : JSON.parse(raw)
  return { response, data }
}
describe("remote training gateway", () => {
  it("challenges missing credentials with real HTTP discovery, never browser session auth", async () => {
    const env = setup()
    const response = await handleGateway(
      new Request(env.AGENT_RESOURCE, {
        headers: { Cookie: "session=secret" },
      }),
      env,
      ctx,
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toContain(
      'resource_metadata="https://agent.example.com/.well-known/oauth-protected-resource/mcp"',
    )
    expect(env.TRAINING.authorize).not.toHaveBeenCalled()
    const metadata = await handleGateway(
      new Request(
        "https://agent.example.com/.well-known/oauth-protected-resource/mcp",
      ),
      env,
      ctx,
    )
    expect(await metadata.json()).toMatchObject({
      resource: env.AGENT_RESOURCE,
      authorization_servers: [env.AGENT_AUTH_ORIGIN],
    })
  })
  it("rejects invalid and revoked credentials before any domain call", async () => {
    const env = setup()
    vi.mocked(env.TRAINING.authorize).mockResolvedValue(false)
    expect(
      (await rpc(env, "tools/call", { name: "training_context" })).response
        .status,
    ).toBe(401)
    expect(env.TRAINING.execute).not.toHaveBeenCalled()
    expect(env.TRAINING.listOperations).not.toHaveBeenCalled()
  })
  it("fails closed with 503 when authorization storage is unavailable", async () => {
    const env = setup()
    vi.mocked(env.TRAINING.authorize).mockRejectedValue(
      new Error("private DB credentials"),
    )
    const { response, data } = await rpc(env, "tools/list")
    expect(response.status).toBe(503)
    expect(data).toEqual({ error: "temporarily_unavailable" })
  })
  it.each(["2025-03-26", "2025-06-18", "2025-11-25"])(
    "serves initialization and stateless tools for %s",
    async (version) => {
      const env = setup()
      const initialized = await rpc(
        env,
        "initialize",
        {
          protocolVersion: version,
          capabilities: {},
          clientInfo: { name: "test", version: "1" },
        },
        version,
      )
      expect(initialized.response.status).toBe(200)
      expect(initialized.data.result.protocolVersion).toBe(version)
      const list = await rpc(env, "tools/list", {}, version)
      expect(list.data.result.tools[0].annotations.readOnlyHint).toBe(true)
      const result = await rpc(
        env,
        "tools/call",
        { name: "training_context", arguments: {} },
        version,
      )
      expect(result.data.result.structuredContent).toEqual({
        ok: true,
        data: { value: "private training" },
      })
      expect(env.TRAINING.execute).toHaveBeenCalledWith(
        "secret",
        "training_context",
        {},
      )
    },
  )
  it("serves modern per-request envelopes without session state", async () => {
    const env = setup()
    const result = await rpc(
      env,
      "tools/call",
      { name: "training_context", arguments: {} },
      "2026-07-28",
    )
    expect(result.response.status, JSON.stringify(result.data)).toBe(200)
    expect(result.data.result.structuredContent).toEqual({
      ok: true,
      data: { value: "private training" },
    })
  })
  it.each([
    "VALIDATION",
    "CONFLICT",
    "FORBIDDEN",
    "NOT_AUTHORIZED",
    "NOT_FOUND",
    "UNAVAILABLE",
  ] as const)("preserves %s as a structured tool error", async (code) => {
    const env = setup()
    vi.mocked(env.TRAINING.execute).mockResolvedValue({
      ok: false,
      error: { code, message: "Action could not be completed" },
    })
    const result = await rpc(env, "tools/call", {
      name: "training_context",
      arguments: {},
    })
    expect(result.response.status).toBe(200)
    expect(result.data.result).toMatchObject({
      isError: true,
      structuredContent: { error: { code } },
    })
  })
  it("rejects another origin, sibling resource path, and query aliases", async () => {
    const env = setup()
    for (const url of [
      "https://evil.example.com/mcp",
      `${env.AGENT_RESOURCE}/other`,
      `${env.AGENT_RESOURCE}?audience=other`,
    ])
      expect((await handleGateway(new Request(url), env, ctx)).status).toBe(404)
    expect(env.TRAINING.authorize).not.toHaveBeenCalled()
  })
})
