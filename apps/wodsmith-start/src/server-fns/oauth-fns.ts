/**
 * Server functions backing the MCP OAuth consent UI.
 *
 * These wrap the helper methods exposed by `@cloudflare/workers-oauth-provider`
 * (available as `env.OAUTH_PROVIDER` only on requests that flowed through the
 * provider). Splitting this into its own module keeps the consent route lean.
 */

import type { OAuthHelpers } from "@cloudflare/workers-oauth-provider"
import { createServerFn } from "@tanstack/react-start"
import { z } from "zod"
import { getOAuthHelpersFromContext } from "@/lib/oauth-context"
import { ALL_MCP_SCOPES, MCP_SCOPES, type McpScope } from "@/mcp/scopes"
import { getSessionFromCookie } from "@/utils/auth"

function getOAuthProvider(): OAuthHelpers {
  const provider = getOAuthHelpersFromContext()
  if (!provider) {
    throw new Error(
      "OAUTH_PROVIDER helpers are not available — this route must be served through the OAuth provider's defaultHandler.",
    )
  }
  return provider
}

const consentInfoSchema = z.object({
  // The full OAuth authorize URL is the canonical input — we pass it through
  // to the helper, which parses query params for us.
  authorizeUrl: z.string().min(1),
})

export interface AuthorizeConsentInfo {
  client: {
    clientId: string
    clientName: string
    clientUri: string | null
    logoUri: string | null
    redirectUris: string[]
  }
  /**
   * Scopes the client requested. May contain unknown scopes — the UI should
   * filter these against `supportedScopes` before rendering.
   */
  requestedScopes: string[]
  supportedScopes: McpScope[]
  /**
   * Defaulted-on scope set we'll grant unless the user opts out. Today this
   * is the intersection of `requestedScopes` and `supportedScopes`.
   */
  defaultGrantedScopes: McpScope[]
}

/**
 * Look up the OAuth client that requested this authorization and return
 * everything the consent UI needs to render. Called during page load.
 */
export const getAuthorizeConsentInfoFn = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => consentInfoSchema.parse(data))
  .handler(async ({ data }): Promise<AuthorizeConsentInfo> => {
    const provider = getOAuthProvider()
    const req = new Request(data.authorizeUrl)
    const parsed = await provider.parseAuthRequest(req)
    const client = await provider.lookupClient(parsed.clientId)
    if (!client) {
      throw new Error(`Unknown OAuth client: ${parsed.clientId}`)
    }
    const supportedSet = new Set<string>(ALL_MCP_SCOPES)
    const requested = parsed.scope.filter((s) => supportedSet.has(s))
    return {
      client: {
        clientId: client.clientId,
        clientName: client.clientName ?? client.clientId,
        clientUri: client.clientUri ?? null,
        logoUri: client.logoUri ?? null,
        redirectUris: client.redirectUris,
      },
      requestedScopes: parsed.scope,
      supportedScopes: [...ALL_MCP_SCOPES],
      defaultGrantedScopes: requested as McpScope[],
    }
  })

const completeAuthorizeSchema = z.object({
  authorizeUrl: z.string().min(1),
  // Scopes the user actually approved. Server re-validates against
  // `supportedScopes` so a tampered form can't grant unknown scopes.
  grantedScopes: z.array(
    z.enum([MCP_SCOPES.EVENTS_LIST, MCP_SCOPES.EVENTS_READ]),
  ),
})

export interface CompleteAuthorizeResult {
  redirectTo: string
}

/**
 * Complete the authorization on the user's behalf, issuing a redirect back
 * to the requesting OAuth client with the authorization code attached.
 *
 * Requires a logged-in user — the consent page is responsible for sending the
 * user to /sign-in first.
 */
export const completeAuthorizeFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => completeAuthorizeSchema.parse(data))
  .handler(async ({ data }): Promise<CompleteAuthorizeResult> => {
    const session = await getSessionFromCookie()
    if (!session?.user?.id) {
      throw new Error("Not signed in")
    }
    const provider = getOAuthProvider()
    const req = new Request(data.authorizeUrl)
    const parsed = await provider.parseAuthRequest(req)

    // Defensive double-check: only grant scopes that are both supported and
    // present in the original client request.
    const supportedSet = new Set<string>(ALL_MCP_SCOPES)
    const requestedSet = new Set<string>(parsed.scope)
    const safeScopes = data.grantedScopes.filter(
      (s) => supportedSet.has(s) && requestedSet.has(s),
    )

    const { redirectTo } = await provider.completeAuthorization({
      request: parsed,
      userId: session.user.id,
      metadata: { issuedFor: "wodsmith-mcp" },
      scope: safeScopes,
      props: {
        userId: session.user.id,
        scopes: safeScopes,
      },
    })
    return { redirectTo }
  })
