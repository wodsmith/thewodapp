# MCP

WODsmith exposes a Code Mode MCP server so authenticated organizers and permitted cohosts can manage competitions through isolated JavaScript tools.

## Code Mode Server

The MCP protocol endpoint lives in a standalone Worker app.

[[apps/wodsmith-code-mode-mcp/src/index.ts]] serves `/mcp` and `/api/mcp` without going through the TanStack Start router. [[apps/wodsmith-code-mode-mcp/src/auth.ts]] accepts WODsmith bearer session tokens or the normal WODsmith cookie, validates the shared `KV_SESSION` record, and keeps the original credential for downstream operation calls.

[[apps/wodsmith-code-mode-mcp/src/oauth-resource.ts]] advertises the MCP worker as an OAuth protected resource. [[apps/wodsmith-start/src/mcp/oauth.ts]] makes WODsmith Start the OAuth authorization server with discovery metadata, dynamic client registration, authorization-code-with-PKCE issuance, and token exchange backed by the existing session KV store. The issued OAuth access token is the same opaque `{userId}:{sessionToken}` bearer format that the MCP worker and Start RPC already validate.

The server registers two tools in [[apps/wodsmith-code-mode-mcp/src/mcp/server.ts]]:
- `search` runs isolated JavaScript over the operation catalog only, for discovery and filtering.
- `execute` runs isolated JavaScript with `wodsmith.call(operationId, input)`, so agents can sequence multiple organizer operations in one sandboxed script.

[[apps/wodsmith-code-mode-mcp/alchemy.run.ts]] binds `MCP_CODE_LOADER` via Cloudflare `WorkerLoader()`, the shared WODsmith sessions KV namespace, and `WODSMITH_APP` as a named service binding to the WODsmith app. [[apps/wodsmith-code-mode-mcp/src/mcp/executor.ts]] uses Worker Loader to run user-supplied code in isolated Workers with a global outbound binding that can only call the MCP app's internal operation entrypoint.

## Local Development

The standalone MCP worker runs locally beside WODsmith Start.

[[apps/wodsmith-start/vite.config.ts]] registers the MCP worker as a Cloudflare Vite auxiliary worker, so `pnpm --filter wodsmith-start dev` loads both workers in one Miniflare runtime. Set `CLOUDFLARE_VITE_REMOTE_BINDINGS=false` when local dev should avoid Wrangler's remote proxy. Codex still needs an addressable MCP URL, so `apps/wodsmith-code-mode-mcp/package.json` runs standalone Wrangler on port 8788 with `--local` and `--persist-to ../wodsmith-start/.alchemy/local/.wrangler/state`; that shares the Start session KV while `WODSMITH_APP` connects to the `WodsmithMcpOperations` service-binding entrypoint. Local testing no longer uses a shared bridge secret.

## Operation Catalog

The MCP operation catalog is derived from organizer and cohost TanStack server functions.

[[apps/wodsmith-start/src/mcp/competition-operations.ts]] imports the relevant `server-fns` modules and exposes every exported `*Fn` as `{category}.{nameWithoutFn}`. Categories cover competition creation/editing, divisions, events, workout/movement lookup, locations/addresses, event-division mappings, scoring, leaderboard/results reads, online submission verification, registrations and transfers, invites, waivers, heat and judge scheduling, volunteers, broadcasts, pricing/revenue, Stripe Connect, coupons, sponsors, cohosts, series templates, judging assignments/rotations/sheets, registration questions, and cohost-scoped equivalents.

Operations execute through the existing server functions instead of bypassing application services. [[apps/wodsmith-start/src/utils/auth.ts#withSessionOverride]] lets MCP reuse the authenticated session inside TanStack server-function code, so normal organizer, team, admin, and cohost permission checks still apply.

[[apps/wodsmith-start/src/mcp/rpc.ts]] exports `WodsmithMcpOperations` as a named Worker entrypoint. The MCP app uses Cloudflare service-binding RPC to list the catalog and call operations; operation execution revalidates the WODsmith bearer token or cookie before calling the server function.

## Internal Operation Dispatch

Sandboxed code cannot import app modules directly; it calls a narrow MCP worker entrypoint.

[[apps/wodsmith-code-mode-mcp/src/index.ts]] exports `WodsmithCodeModeOutbound`, a Worker entrypoint used as the Worker Loader isolate's global outbound binding. [[apps/wodsmith-code-mode-mcp/src/mcp/outbound.ts]] accepts only `POST https://wodsmith-mcp.internal/operation`, validates the request shape, and forwards the call through [[apps/wodsmith-code-mode-mcp/src/wodsmith-service.ts]], which invokes the `WODSMITH_APP` service binding instead of HTTP.

[[apps/wodsmith-start/src/mcp/competition-operations.ts#callCompetitionOperation]] invokes the imported server function directly under a minimal Start context, so MCP calls stay on the server execution path outside normal `_serverFn` requests. If direct execution is unavailable for a compiled handler, the dispatcher falls back to `__executeServer`.

Compiled TanStack server functions can return a Start-serialized JSON `Response` rather than a plain `{ result }` object. The MCP operation wrapper unwraps that response before it crosses the service-binding boundary so Code Mode receives the actual operation result instead of `undefined`.

The operation path logs bounded diagnostics at every boundary so undefined-result bugs can be traced without exposing payload values. Logs identify the operation id, credential kind, input/result shape, response status, content type, and serialized-response flag across [[apps/wodsmith-code-mode-mcp/src/mcp/outbound.ts]], [[apps/wodsmith-code-mode-mcp/src/wodsmith-service.ts]], [[apps/wodsmith-start/src/mcp/rpc.ts]], and [[apps/wodsmith-start/src/mcp/competition-operations.ts]].

This keeps the MCP surface broad but still routed through the same validation, database writes, audit behavior, and permission checks used by the organizer dashboard without an addressable internal HTTP endpoint.

## Protocol Tests

The MCP protocol contract is covered by focused tests in the standalone app.

[[apps/wodsmith-code-mode-mcp/test/mcp/server-protocol.test.ts]] verifies initialization, tool discovery, and calls to the `search` and `execute` tools. [[apps/wodsmith-start/test/mcp/competition-operations.test.ts]] continues to cover operation id stability, server-function execution through `__executeServer`, and unwrapping serialized TanStack responses.
