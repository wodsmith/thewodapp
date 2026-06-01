import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { afterEach, describe, expect, it, vi } from "vitest"
import type {
  AuthenticatedMcpSession,
  CompetitionOperationSpec,
} from "../../src/types"

const executeSearch = vi.fn(async () => [
  {
    id: "schedule.createHeat",
    mode: "write",
    description: "Create a heat for a competition schedule.",
  },
])

const executeCode = vi.fn(async () => ({
  ok: true,
  operation: "schedule.createHeat",
}))

vi.mock("../../src/mcp/executor", () => ({
  createSearchExecutor: () => executeSearch,
  createCodeExecutor: () => executeCode,
  toExecutorError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

const { createWodsmithMcpServer } = await import("../../src/mcp/server")
const { protectedResourceMetadata } = await import("../../src/oauth-resource")

const operationSpecs: CompetitionOperationSpec[] = [
  {
    id: "schedule.createHeat",
    exportName: "createHeatFn",
    category: "schedule",
    categoryTitle: "Schedule",
    mode: "write",
    source: "src/server-fns/competition-heats-fns.ts",
    description: "Create a heat for a competition schedule.",
    input: "Pass the same data object this TanStack server function expects.",
  },
]

const session: AuthenticatedMcpSession = {
  userId: "user_test",
  sessionId: "session_test",
  session: {
    id: "session_test",
    userId: "user_test",
    expiresAt: Date.now() + 60_000,
    createdAt: Date.now(),
  },
  credential: {
    kind: "bearer",
    authorization: "Bearer user_test:token_test",
  },
}

describe("WODsmith code mode MCP protocol server", () => {
  afterEach(() => {
    executeSearch.mockClear()
    executeCode.mockClear()
  })

  it("initializes, lists tools, and calls the search tool", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    const server = createWodsmithMcpServer(
      {} as Env,
      {} as ExecutionContext,
      session,
      operationSpecs,
    )
    const client = new Client({
      name: "wodsmith-mcp-test-client",
      version: "0.1.0",
    })

    await server.connect(serverTransport)
    await client.connect(clientTransport)

    expect(client.getServerVersion()).toMatchObject({
      name: "wodsmith-competition-code-mode",
      version: "0.1.0",
    })
    expect(client.getInstructions()).toContain("Use Code Mode")

    const tools = await client.listTools()
    expect(tools.tools.map((tool) => tool.name)).toEqual(["search", "execute"])

    const result = await client.callTool({
      name: "search",
      arguments: {
        code: 'async () => findOperations("heat schedule")',
      },
    })

    expect(executeSearch).toHaveBeenCalledWith(
      'async () => findOperations("heat schedule")',
    )
    expect(result.isError).toBeFalsy()
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          [
            {
              id: "schedule.createHeat",
              mode: "write",
              description: "Create a heat for a competition schedule.",
            },
          ],
          null,
          2,
        ),
      },
    ])

    await client.close()
    await server.close()
  })

  it("calls the execute tool through the code executor", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair()
    const server = createWodsmithMcpServer(
      {} as Env,
      {} as ExecutionContext,
      session,
      operationSpecs,
    )
    const client = new Client({
      name: "wodsmith-mcp-test-client",
      version: "0.1.0",
    })

    await server.connect(serverTransport)
    await client.connect(clientTransport)

    const result = await client.callTool({
      name: "execute",
      arguments: {
        code: 'async () => wodsmith.call("schedule.createHeat", { competitionId: "comp_test" })',
      },
    })

    expect(executeCode).toHaveBeenCalledWith(
      'async () => wodsmith.call("schedule.createHeat", { competitionId: "comp_test" })',
    )
    expect(result.isError).toBeFalsy()
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify(
          {
            ok: true,
            operation: "schedule.createHeat",
          },
          null,
          2,
        ),
      },
    ])

    await client.close()
    await server.close()
  })

  it("advertises the WODsmith authorization server as its OAuth resource metadata", async () => {
    const response = protectedResourceMetadata(
      new Request(
        "https://mcp.wodsmith.com/.well-known/oauth-protected-resource",
      ),
      {
        WODSMITH_AUTHORIZATION_SERVER_URL: "https://wodsmith.com",
      } as Env,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      resource: "https://mcp.wodsmith.com",
      authorization_servers: ["https://wodsmith.com"],
    })
  })
})
