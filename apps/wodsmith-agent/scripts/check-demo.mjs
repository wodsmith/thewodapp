import assert from "node:assert/strict"

const origin = "https://demo.wodsmith.com"
const resource = "https://mcp-demo.wodsmith.com/mcp"
const metadataUrl = "https://mcp-demo.wodsmith.com/.well-known/oauth-protected-resource/mcp"

async function verify() {
  const metadata = await fetch(metadataUrl, { signal: AbortSignal.timeout(15000) })
  assert.equal(metadata.status, 200, "Gateway discovery must be available")
  const resourceMetadata = await metadata.json()
  assert.equal(resourceMetadata.resource, resource)
  assert.deepEqual(resourceMetadata.authorization_servers, [origin])
  const auth = await fetch(`${origin}/.well-known/oauth-authorization-server`, { signal: AbortSignal.timeout(15000) })
  assert.equal(auth.status, 200, "WodSmith must serve OAuth discovery")
  const oauth = await auth.json()
  assert.equal(oauth.issuer, origin)
  assert.equal(oauth.authorization_endpoint, `${origin}/agent/authorize`)
  assert.equal(oauth.token_endpoint, `${origin}/agent/token`)
  assert.ok(oauth.code_challenge_methods_supported.includes("S256"))
  const unauthenticated = await fetch(resource, { signal: AbortSignal.timeout(15000) })
  assert.equal(unauthenticated.status, 401, "MCP requires authorization")
  assert.ok(unauthenticated.headers.get("www-authenticate")?.includes(metadataUrl))
}

for (let attempt = 1; ; attempt++) {
  try {
    await verify()
    console.log("Demo MCP discovery, OAuth origins, PKCE, and unauthenticated rejection passed")
    break
  } catch (error) {
    if (attempt === 12) throw error
    console.log(`Demo endpoint is not ready yet (${attempt}/12); retrying in 10s`)
    await new Promise(resolve => setTimeout(resolve, 10000))
  }
}
