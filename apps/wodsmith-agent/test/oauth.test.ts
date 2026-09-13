import { createExecutionContext, env, fetchMock } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import {
  oauthApi,
  oauthProvider,
  parseAgentAuthorizationRequest,
  resourceMetadata,
} from "@repo/agent-auth/provider"
import { agentScopes } from "@repo/agent-auth"
const config = {
  AGENT_AUTH_ORIGIN: "https://app.example.com",
  AGENT_RESOURCE: "https://agent.example.com/mcp",
  OAUTH_KV: (env as { OAUTH_KV: KVNamespace }).OAUTH_KV,
}
const verifier =
  "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
async function fixture(scopes = ["training:read"], omitScope = false) {
  const api = oauthApi(config)
  const client = await api.createClient({
    clientName: "Test connection",
    redirectUris: ["https://client.example.com/callback"],
    tokenEndpointAuthMethod: "none",
    grantTypes: ["authorization_code", "refresh_token"],
    responseTypes: ["code"],
  })
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  )
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
  const url = new URL("/agent/authorize", config.AGENT_AUTH_ORIGIN)
  url.search = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: client.redirectUris[0],
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: scopes.join(" "),
    state: "opaque-client-state",
    resource: config.AGENT_RESOURCE,
  }).toString()
  if (omitScope) url.searchParams.delete("scope")
  const parsed = await parseAgentAuthorizationRequest(api, new Request(url))
  const { redirectTo } = await api.completeAuthorization({
    request: parsed,
    userId: "athlete1",
    scope: parsed.scope,
    metadata: {},
    props: {
      grantId: "live-sql-grant",
      userId: "athlete1",
      clientId: client.clientId,
    },
  })
  const code = new URL(redirectTo).searchParams.get("code")!
  return { api, client, url, redirectTo, code }
}
async function token(body: Record<string, string>) {
  return oauthProvider(config).fetch(
    new Request(`${config.AGENT_AUTH_ORIGIN}/agent/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    }),
    config,
    createExecutionContext(),
  )
}
describe("published Cloudflare OAuth provider", () => {
  it("advertises login-origin issuer, S256, CIMD, DCR, and all supported scopes", async () => {
    const response = await oauthProvider(config).fetch(
      new Request(
        `${config.AGENT_AUTH_ORIGIN}/.well-known/oauth-authorization-server`,
      ),
      config,
      createExecutionContext(),
    )
    const metadata = await response.json<Record<string, unknown>>()
    expect(metadata).toMatchObject({
      issuer: config.AGENT_AUTH_ORIGIN,
      authorization_endpoint: `${config.AGENT_AUTH_ORIGIN}/agent/authorize`,
      token_endpoint: `${config.AGENT_AUTH_ORIGIN}/agent/token`,
      registration_endpoint: `${config.AGENT_AUTH_ORIGIN}/agent/register`,
      client_id_metadata_document_supported: true,
    })
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"])
    expect(metadata.token_endpoint_auth_methods_supported).toContain("none")
    expect(resourceMetadata(config).scopes_supported).toEqual([...agentScopes])
  })
  it("resolves a real URL-based client metadata document in the Worker runtime", async () => {
    const f = await fixture()
    const clientId = "https://metadata.example.com/client.json"
    fetchMock.activate()
    fetchMock.disableNetConnect()
    fetchMock
      .get("https://metadata.example.com")
      .intercept({ path: "/client.json", method: "GET" })
      .reply(
        200,
        JSON.stringify({
          client_id: clientId,
          client_name: "CIMD client",
          redirect_uris: ["https://client.example.com/callback"],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
        { headers: { "content-type": "application/json" } },
      )
    try {
      const request = new URL(f.url)
      request.searchParams.set("client_id", clientId)
      expect(await f.api.parseAuthRequest(new Request(request))).toMatchObject({
        clientId,
        redirectUri: "https://client.example.com/callback",
      })
      fetchMock.assertNoPendingInterceptors()
    } finally {
      fetchMock.deactivate()
      fetchMock.enableNetConnect()
    }
  })
  it("issues a resource-bound token after S256 and retains authenticated grant identity", async () => {
    const f = await fixture()
    expect(new URL(f.redirectTo).searchParams.get("iss")).toBe(
      config.AGENT_AUTH_ORIGIN,
    )
    expect(new URL(f.redirectTo).searchParams.get("state")).toBe(
      "opaque-client-state",
    )
    const response = await token({
      grant_type: "authorization_code",
      code: f.code,
      client_id: f.client.clientId,
      redirect_uri: f.client.redirectUris[0],
      code_verifier: verifier,
      resource: config.AGENT_RESOURCE,
    })
    expect(response.status).toBe(200)
    const result = await response.json<{ access_token: string }>()
    const summary = await f.api.unwrapToken(result.access_token)
    expect(summary).toMatchObject({
      audience: config.AGENT_RESOURCE,
      userId: "athlete1",
      scope: ["training:read"],
      grant: { props: { grantId: "live-sql-grant" } },
    })
    expect(await f.api.unwrapToken(`${result.access_token}tampered`)).toBeNull()
  })
  it("refreshes without widening the audience or trusted grant identity", async () => {
    const f = await fixture()
    const exchanged = await token({
      grant_type: "authorization_code",
      code: f.code,
      client_id: f.client.clientId,
      redirect_uri: f.client.redirectUris[0],
      code_verifier: verifier,
      resource: config.AGENT_RESOURCE,
    })
    const first = await exchanged.json<{
      access_token: string
      refresh_token: string
    }>()
    expect(first.refresh_token).toBeTruthy()
    const refreshed = await token({
      grant_type: "refresh_token",
      refresh_token: first.refresh_token,
      client_id: f.client.clientId,
      resource: config.AGENT_RESOURCE,
    })
    expect(refreshed.status).toBe(200)
    const next = await refreshed.json<{
      access_token: string
      refresh_token: string
    }>()
    expect(await f.api.unwrapToken(next.access_token)).toMatchObject({
      audience: config.AGENT_RESOURCE,
      scope: ["training:read"],
      grant: {
        props: {
          grantId: "live-sql-grant",
          userId: "athlete1",
          clientId: f.client.clientId,
        },
      },
    })
    expect(
      (
        await token({
          grant_type: "refresh_token",
          refresh_token: next.refresh_token,
          client_id: f.client.clientId,
          resource: "https://attacker.example/mcp",
        })
      ).status,
    ).toBe(400)
  })
  it.each(["wrong_verifier", "wrong_redirect", "wrong_resource"])(
    "rejects %s at code exchange",
    async (attack) => {
      const f = await fixture()
      const body = {
        grant_type: "authorization_code",
        code: f.code,
        client_id: f.client.clientId,
        redirect_uri: f.client.redirectUris[0],
        code_verifier: verifier,
        resource: config.AGENT_RESOURCE,
        scope: "training:read",
      }
      if (attack === "wrong_verifier") body.code_verifier = "wrong".repeat(10)
      if (attack === "wrong_redirect")
        body.redirect_uri = "https://attacker.example/callback"
      if (attack === "wrong_resource")
        body.resource = "https://agent.example.com/other"
      expect((await token(body)).status).toBe(400)
    },
  )
  it("never grants token-exchange scope escalation beyond the approved scopes", async () => {
    const f = await fixture()
    const response = await token({
      grant_type: "authorization_code",
      code: f.code,
      client_id: f.client.clientId,
      redirect_uri: f.client.redirectUris[0],
      code_verifier: verifier,
      scope: "results:delete",
    })
    const result = await response.json<{ access_token: string }>()
    expect((await f.api.unwrapToken(result.access_token))?.scope).toEqual([])
  })
  it("connects a generic client with omitted scope using read-only consent", async () => {
    const f = await fixture([], true)
    const response = await token({
      grant_type: "authorization_code",
      code: f.code,
      client_id: f.client.clientId,
      redirect_uri: f.client.redirectUris[0],
      code_verifier: verifier,
    })
    expect(response.status).toBe(200)
    const result = await response.json<{ access_token: string }>()
    expect((await f.api.unwrapToken(result.access_token))?.scope).toEqual([
      "training:read",
    ])
  })
  it("rejects an unregistered redirect, foreign resource, and plain PKCE before consent", async () => {
    const f = await fixture()
    for (const [key, value] of [
      ["redirect_uri", "https://attacker.example"],
      ["resource", "https://attacker.example/mcp"],
      ["code_challenge_method", "plain"],
    ]) {
      const request = new URL(f.url)
      request.searchParams.set(key, value)
      await expect(
        f.api.parseAuthRequest(new Request(request)),
      ).rejects.toThrow()
    }
  })
})
