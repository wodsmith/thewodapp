/**
 * OAuth scopes exposed by the WODsmith MCP server.
 *
 * These are the only scopes a client may request via the OAuth `scope` param
 * and the only scopes a user may grant on the consent screen. The values are
 * what gets stored in the issued token's grant.
 */
export const MCP_SCOPES = {
  /** Permission to enumerate competitions the user organizes. */
  EVENTS_LIST: "events:list",
  /** Permission to read details of a specific competition the user organizes. */
  EVENTS_READ: "events:read",
} as const

export type McpScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES]

export const ALL_MCP_SCOPES: McpScope[] = [
  MCP_SCOPES.EVENTS_LIST,
  MCP_SCOPES.EVENTS_READ,
]

export const SCOPE_DESCRIPTIONS: Record<McpScope, string> = {
  [MCP_SCOPES.EVENTS_LIST]:
    "List competitions you organize (any status — including drafts).",
  [MCP_SCOPES.EVENTS_READ]:
    "Read details of any competition you organize (any status).",
}

/**
 * Props stored on an issued OAuth grant. The MCP API handler reads these from
 * `ctx.props` on every authenticated request.
 */
export interface McpGrantProps {
  userId: string
  scopes: McpScope[]
}

/**
 * Returns true if a grant's scope set includes the required scope.
 */
export function hasScope(
  props: McpGrantProps | undefined,
  required: McpScope,
): boolean {
  return !!props?.scopes?.includes(required)
}
