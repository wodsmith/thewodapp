import {
  type OAuthProviderOptions,
  getOAuthApi,
  OAuthProvider,
} from "@cloudflare/workers-oauth-provider"
import { agentScopes } from "./index"
export { AuthorizationError } from "@cloudflare/workers-oauth-provider"
export type {
  AuthRequest,
  OAuthHelpers,
  TokenSummary,
} from "@cloudflare/workers-oauth-provider"

export interface AgentOAuthConfig {
  AGENT_AUTH_ORIGIN: string
  AGENT_RESOURCE: string
}
// Shared by protocol endpoints and private token validation; no public session fallback.
export function oauthOptions<E extends AgentOAuthConfig>(
  env: E,
): OAuthProviderOptions<E> {
  return {
    apiRoute: env.AGENT_RESOURCE,
    apiHandler: { fetch: () => new Response("Not found", { status: 404 }) },
    defaultHandler: { fetch: () => new Response("Not found", { status: 404 }) },
    authorizeEndpoint: `${env.AGENT_AUTH_ORIGIN}/agent/authorize`,
    tokenEndpoint: `${env.AGENT_AUTH_ORIGIN}/agent/token`,
    clientRegistrationEndpoint: `${env.AGENT_AUTH_ORIGIN}/agent/register`,
    clientIdMetadataDocumentEnabled: true,
    allowPlainPKCE: false,
    allowImplicitFlow: false,
    scopesSupported: [...agentScopes],
    accessTokenTTL: 900,
    resourceMetadata: resourceMetadata(env),
  }
}
export function resourceMetadata(env: AgentOAuthConfig) {
  return {
    resource: env.AGENT_RESOURCE,
    authorization_servers: [env.AGENT_AUTH_ORIGIN],
    scopes_supported: [...agentScopes],
    bearer_methods_supported: ["header"],
    resource_name: "WodSmith training",
  }
}
export function oauthApi<E extends AgentOAuthConfig>(env: E) {
  return getOAuthApi(oauthOptions(env), env)
}
export function oauthProvider<E extends AgentOAuthConfig>(env: E) {
  return new OAuthProvider(oauthOptions(env))
}

/** Scope-less generic MCP clients receive an explicit read-only consent default. */
export async function parseAgentAuthorizationRequest(
  api: import("@cloudflare/workers-oauth-provider").OAuthHelpers,
  request: Request,
) {
  const parsed = await api.parseAuthRequest(request)
  return parsed.scope.length ? parsed : { ...parsed, scope: ["training:read"] }
}
