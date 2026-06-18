/**
 * MCP server for WODsmith competitions.
 *
 * Exposes competitions over the Model Context Protocol:
 *
 * - **Resources** (browseable via `resources/list` and `resources/read`):
 *   - `competition://public/{slug}` — published + public competitions
 *   - `competition://organizer/{slug}` — competitions the authenticated user
 *     organizes (any status). Requires the `events:list` / `events:read` scope.
 *
 * - **Tools** (semantic interaction returning `resource_link` and
 *   `embedded_resource` content blocks):
 *   - `list_competitions(scope?)` — returns `resource_link` content blocks,
 *     one per competition.
 *   - `get_competition(slug, scope?)` — returns an `embedded_resource`
 *     content block holding the full JSON.
 *
 * The MCP server is stateless per request. Auth context (when present) is
 * threaded in as `McpGrantProps` so the same code can serve anonymous public
 * requests and authenticated organizer requests from one server instance.
 */

import "server-only"
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
  getOrganizerCompetitionBySlug,
  getPublicCompetitionBySlug,
  listOrganizerCompetitionsForUser,
  listPublicCompetitions,
  type McpCompetitionSummary,
} from "./data"
import { hasScope, MCP_SCOPES, type McpGrantProps } from "./scopes"

const SERVER_INFO = {
  name: "wodsmith-competitions",
  version: "0.1.0",
} as const

const PUBLIC_URI_PREFIX = "competition://public/"
const ORGANIZER_URI_PREFIX = "competition://organizer/"

/**
 * Create an MCP server bound to the current request's auth context.
 *
 * Pass `props` when the request was authenticated by the OAuth provider.
 * Pass `undefined` for anonymous requests — only public resources/tools work.
 */
export function createMcpServer(props: McpGrantProps | undefined): McpServer {
  const server = new McpServer(SERVER_INFO, {
    capabilities: {
      resources: { listChanged: false },
      tools: { listChanged: false },
    },
    instructions:
      "Browse WODsmith competitions. Public competitions are visible to everyone. " +
      "Organizer competitions require `events:list` / `events:read` scopes and " +
      "include drafts and private events for the authenticated organizer.",
  })

  registerResources(server, props)
  registerTools(server, props)
  return server
}

function registerResources(
  server: McpServer,
  props: McpGrantProps | undefined,
) {
  server.registerResource(
    "public-competition",
    new ResourceTemplate(`${PUBLIC_URI_PREFIX}{slug}`, {
      list: async () => {
        const items = await listPublicCompetitions()
        return {
          resources: items.map((c) => publicResourceDescriptor(c)),
        }
      },
    }),
    {
      title: "Public competition",
      description:
        "A published, publicly-visible WODsmith competition. Anyone may read these.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const slug = String(variables.slug)
      const competition = await getPublicCompetitionBySlug(slug)
      if (!competition) {
        throw new Error(`Public competition not found: ${slug}`)
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(competition, null, 2),
          },
        ],
      }
    },
  )

  server.registerResource(
    "organizer-competition",
    new ResourceTemplate(`${ORGANIZER_URI_PREFIX}{slug}`, {
      list: async () => {
        // hasScope already null-checks props; the explicit guard below is for
        // TypeScript so it can narrow `props` to non-undefined.
        if (!props || !hasScope(props, MCP_SCOPES.EVENTS_LIST)) {
          // Listing requires the `events:list` scope. Returning an empty list
          // (rather than throwing) keeps anonymous `resources/list` calls quiet.
          return { resources: [] }
        }
        const items = await listOrganizerCompetitionsForUser(props.userId)
        return {
          resources: items.map((c) => organizerResourceDescriptor(c)),
        }
      },
    }),
    {
      title: "Organizer competition",
      description:
        "A WODsmith competition the authenticated user organizes. " +
        "Includes drafts and private events. Requires the `events:read` scope.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      if (!props) {
        throw new Error("Authentication required to read organizer resources")
      }
      if (!hasScope(props, MCP_SCOPES.EVENTS_READ)) {
        throw new Error("Missing required scope: events:read")
      }
      const slug = String(variables.slug)
      const competition = await getOrganizerCompetitionBySlug(
        props.userId,
        slug,
      )
      if (!competition) {
        throw new Error(`Organizer competition not found: ${slug}`)
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(competition, null, 2),
          },
        ],
      }
    },
  )
}

function registerTools(server: McpServer, props: McpGrantProps | undefined) {
  server.registerTool(
    "list_competitions",
    {
      title: "List competitions",
      description:
        "List WODsmith competitions as `resource_link` content blocks. " +
        "scope=public lists published+public events (no auth). " +
        "scope=organizer lists competitions the authenticated user organizes " +
        "(requires the `events:list` OAuth scope).",
      inputSchema: {
        scope: z
          .enum(["public", "organizer"])
          .default("public")
          .describe(
            "Which set to list. 'public' for anonymous browsing; 'organizer' for the authenticated user's competitions.",
          ),
      },
    },
    async ({ scope }) => {
      if (scope === "organizer") {
        if (!props) {
          return errorResult(
            "Authentication required to list organizer competitions.",
          )
        }
        if (!hasScope(props, MCP_SCOPES.EVENTS_LIST)) {
          return errorResult("Missing required scope: events:list")
        }
        const items = await listOrganizerCompetitionsForUser(props.userId)
        return {
          content: items.map((c) => competitionResourceLink(c, "organizer")),
        }
      }
      const items = await listPublicCompetitions()
      return {
        content: items.map((c) => competitionResourceLink(c, "public")),
      }
    },
  )

  server.registerTool(
    "get_competition",
    {
      title: "Get competition",
      description:
        "Read a single WODsmith competition by slug as an `embedded_resource` content block. " +
        "scope=public reads a published+public event (no auth). " +
        "scope=organizer reads any competition the authenticated user organizes " +
        "(any status, requires the `events:read` OAuth scope).",
      inputSchema: {
        slug: z.string().min(1).describe("URL slug of the competition."),
        scope: z
          .enum(["public", "organizer"])
          .default("public")
          .describe(
            "'public' for anonymous read of a public event; 'organizer' for the authenticated user.",
          ),
      },
    },
    async ({ slug, scope }) => {
      if (scope === "organizer") {
        if (!props) {
          return errorResult(
            "Authentication required to read organizer competitions.",
          )
        }
        if (!hasScope(props, MCP_SCOPES.EVENTS_READ)) {
          return errorResult("Missing required scope: events:read")
        }
        const competition = await getOrganizerCompetitionBySlug(
          props.userId,
          slug,
        )
        if (!competition) {
          return errorResult(`Organizer competition not found: ${slug}`)
        }
        return {
          content: [embeddedResource(competition, "organizer")],
        }
      }
      const competition = await getPublicCompetitionBySlug(slug)
      if (!competition) {
        return errorResult(`Public competition not found: ${slug}`)
      }
      return {
        content: [embeddedResource(competition, "public")],
      }
    },
  )
}

function publicResourceDescriptor(c: McpCompetitionSummary) {
  return {
    uri: `${PUBLIC_URI_PREFIX}${c.slug}`,
    name: c.slug,
    title: c.name,
    description: shortDescription(c),
    mimeType: "application/json",
  }
}

function organizerResourceDescriptor(c: McpCompetitionSummary) {
  return {
    uri: `${ORGANIZER_URI_PREFIX}${c.slug}`,
    name: c.slug,
    title: `${c.name} (${c.status})`,
    description: shortDescription(c),
    mimeType: "application/json",
  }
}

function competitionResourceLink(
  c: McpCompetitionSummary,
  scope: "public" | "organizer",
) {
  const prefix = scope === "public" ? PUBLIC_URI_PREFIX : ORGANIZER_URI_PREFIX
  return {
    type: "resource_link" as const,
    uri: `${prefix}${c.slug}`,
    name: c.slug,
    title: scope === "organizer" ? `${c.name} (${c.status})` : c.name,
    description: shortDescription(c),
    mimeType: "application/json",
  }
}

function embeddedResource(
  c: McpCompetitionSummary,
  scope: "public" | "organizer",
) {
  const prefix = scope === "public" ? PUBLIC_URI_PREFIX : ORGANIZER_URI_PREFIX
  return {
    type: "resource" as const,
    resource: {
      uri: `${prefix}${c.slug}`,
      mimeType: "application/json",
      text: JSON.stringify(c, null, 2),
    },
  }
}

function shortDescription(c: McpCompetitionSummary): string {
  const where = c.competitionType === "online" ? "online" : "in-person"
  const team = c.organizingTeamName ? ` by ${c.organizingTeamName}` : ""
  return `${where} competition${team}, ${c.startDate} → ${c.endDate}`
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
  }
}
