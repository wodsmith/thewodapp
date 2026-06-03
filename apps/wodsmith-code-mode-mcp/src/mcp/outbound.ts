import type { SessionCredential } from "../types"
import { callCompetitionOperation } from "../wodsmith-service"

const INTERNAL_HOSTNAME = "wodsmith-mcp.internal"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function json(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

function describeValue(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" }
  if (value === undefined) return { type: "undefined" }
  if (Array.isArray(value)) return { type: "array", length: value.length }
  if (value instanceof Response) {
    return {
      type: "response",
      status: value.status,
      contentType: value.headers.get("Content-Type"),
      serialized: value.headers.has("x-tss-serialized"),
    }
  }
  if (typeof value === "object") {
    return { type: "object", keys: Object.keys(value).slice(0, 20) }
  }
  return { type: typeof value }
}

export async function handleMcpOperationOutbound(
  request: Request,
  env: Env,
  credential: SessionCredential,
): Promise<Response> {
  const url = new URL(request.url)
  if (url.hostname !== INTERNAL_HOSTNAME || url.pathname !== "/operation") {
    return json(
      { error: `Forbidden outbound request: ${url.hostname}${url.pathname}` },
      { status: 403 },
    )
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object") {
    return json({ error: "Request body must be an object" }, { status: 400 })
  }

  const { operation, input } = body as {
    operation?: unknown
    input?: unknown
  }

  if (typeof operation !== "string" || operation.length === 0) {
    return json(
      { error: "operation must be a non-empty string" },
      { status: 400 },
    )
  }

  try {
    console.info("[MCP outbound] Calling WODsmith operation", {
      operation,
      input: describeValue(input ?? {}),
      credentialKind: credential.kind,
    })
    const result = await callCompetitionOperation(
      env,
      credential,
      operation,
      input ?? {},
    )
    console.info("[MCP outbound] WODsmith operation returned", {
      operation,
      result: describeValue(result),
    })
    return json({ result })
  } catch (error) {
    console.error("[MCP] Operation failed", error)
    const message = errorMessage(error)
    const status = message.startsWith("Unknown competition operation")
      ? 404
      : 500
    return json(
      {
        error: message,
      },
      { status },
    )
  }
}
