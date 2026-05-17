import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { McpCompetitionSummary } from "@/mcp/data"
import { createMcpServer } from "@/mcp/server"
import { MCP_SCOPES, type McpGrantProps } from "@/mcp/scopes"

vi.mock("@/mcp/data", () => ({
  listPublicCompetitions: vi.fn(),
  getPublicCompetitionBySlug: vi.fn(),
  listOrganizerCompetitionsForUser: vi.fn(),
  getOrganizerCompetitionBySlug: vi.fn(),
}))

const dataMock = await import("@/mcp/data")
const listPublic = vi.mocked(dataMock.listPublicCompetitions)
const getPublic = vi.mocked(dataMock.getPublicCompetitionBySlug)
const listOrganizer = vi.mocked(dataMock.listOrganizerCompetitionsForUser)
const getOrganizer = vi.mocked(dataMock.getOrganizerCompetitionBySlug)

const publicComp: McpCompetitionSummary = {
  id: "comp_1",
  slug: "open-2026",
  name: "Open 2026",
  description: null,
  startDate: "2026-02-01",
  endDate: "2026-02-03",
  registrationOpensAt: null,
  registrationClosesAt: null,
  timezone: "America/Denver",
  visibility: "public",
  status: "published",
  competitionType: "in-person",
  profileImageUrl: null,
  bannerImageUrl: null,
  organizingTeamId: "team_1",
  organizingTeamName: "WODsmith Gym",
  organizingTeamSlug: "wodsmith-gym",
}

const draftComp: McpCompetitionSummary = {
  ...publicComp,
  id: "comp_2",
  slug: "secret-throwdown",
  name: "Secret Throwdown",
  status: "draft",
  visibility: "private",
}

async function connectClient(props: McpGrantProps | undefined) {
  const server = createMcpServer(props)
  const [clientT, serverT] = InMemoryTransport.createLinkedPair()
  await server.connect(serverT)
  const client = new Client({ name: "test", version: "0.0.0" }, {})
  await client.connect(clientT)
  return { client, server }
}

beforeEach(() => {
  listPublic.mockResolvedValue([publicComp])
  getPublic.mockImplementation(async (slug) =>
    slug === publicComp.slug ? publicComp : null,
  )
  listOrganizer.mockResolvedValue([publicComp, draftComp])
  getOrganizer.mockImplementation(async (_userId, slug) => {
    if (slug === publicComp.slug) return publicComp
    if (slug === draftComp.slug) return draftComp
    return null
  })
})

describe("MCP server — anonymous request", () => {
  it("lists only public resources via resources/list", async () => {
    const { client } = await connectClient(undefined)
    const result = await client.listResources()
    const uris = result.resources.map((r) => r.uri)
    expect(uris).toContain(`competition://public/${publicComp.slug}`)
    // organizer template's list callback returns [] when no scope is granted
    expect(uris.some((u) => u.startsWith("competition://organizer/"))).toBe(
      false,
    )
  })

  it("reads a public competition", async () => {
    const { client } = await connectClient(undefined)
    const result = await client.readResource({
      uri: `competition://public/${publicComp.slug}`,
    })
    expect(result.contents).toHaveLength(1)
    const first = result.contents[0] as {
      mimeType?: string
      text: string
    }
    expect(first.mimeType).toBe("application/json")
    const parsed = JSON.parse(first.text)
    expect(parsed.slug).toBe(publicComp.slug)
  })

  it("rejects organizer scope when calling list_competitions tool", async () => {
    const { client } = await connectClient(undefined)
    const result = await client.callTool({
      name: "list_competitions",
      arguments: { scope: "organizer" },
    })
    expect(result.isError).toBe(true)
  })
})

describe("MCP server — authenticated with events:list only", () => {
  const props: McpGrantProps = {
    userId: "usr_test",
    scopes: [MCP_SCOPES.EVENTS_LIST],
  }

  it("lists organizer competitions including drafts via list_competitions tool", async () => {
    const { client } = await connectClient(props)
    const result = await client.callTool({
      name: "list_competitions",
      arguments: { scope: "organizer" },
    })
    expect(result.isError).toBeFalsy()
    const links = (result.content as Array<{ type: string; uri: string }>).filter(
      (b) => b.type === "resource_link",
    )
    const uris = links.map((b) => b.uri)
    expect(uris).toContain(`competition://organizer/${draftComp.slug}`)
    expect(listOrganizer).toHaveBeenCalledWith(props.userId)
  })

  it("rejects get_competition with scope=organizer (events:read missing)", async () => {
    const { client } = await connectClient(props)
    const result = await client.callTool({
      name: "get_competition",
      arguments: { scope: "organizer", slug: draftComp.slug },
    })
    expect(result.isError).toBe(true)
  })
})

describe("MCP server — authenticated with events:read", () => {
  const props: McpGrantProps = {
    userId: "usr_test",
    scopes: [MCP_SCOPES.EVENTS_LIST, MCP_SCOPES.EVENTS_READ],
  }

  it("returns an embedded_resource block for a draft competition the user organizes", async () => {
    const { client } = await connectClient(props)
    const result = await client.callTool({
      name: "get_competition",
      arguments: { scope: "organizer", slug: draftComp.slug },
    })
    expect(result.isError).toBeFalsy()
    const block = (result.content as Array<{
      type: string
      resource: { uri: string; text: string }
    }>)[0]!
    expect(block.type).toBe("resource")
    expect(block.resource.uri).toBe(
      `competition://organizer/${draftComp.slug}`,
    )
    const parsed = JSON.parse(block.resource.text)
    expect(parsed.slug).toBe(draftComp.slug)
    expect(parsed.status).toBe("draft")
  })

  it("returns 404-style error when slug doesn't exist", async () => {
    const { client } = await connectClient(props)
    const result = await client.callTool({
      name: "get_competition",
      arguments: { scope: "organizer", slug: "nope" },
    })
    expect(result.isError).toBe(true)
  })
})
