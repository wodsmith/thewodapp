# MCP Server

WODsmith exposes its public and organizer competition data over the Model Context Protocol (MCP) so AI clients can browse events without scraping the web UI.

The MCP server is hosted in the same Cloudflare Worker as the rest of [[architecture#Monorepo Structure#apps/wodsmith-start]] and is fronted by the Cloudflare workers-oauth-provider so authenticated requests can target an individual user's competitions.

## Endpoints

The provider intercepts the worker `fetch` and routes paths to:

- `/mcp` — Streamable HTTP MCP endpoint. With a valid bearer token the request reaches [[apps/wodsmith-start/src/mcp/handler.ts#mcpApiHandler]] with `ctx.props` populated. Without a token it falls through the OAuth provider's defaultHandler, where `fetchWithLogging` in [[apps/wodsmith-start/src/server.ts]] hands it to [[apps/wodsmith-start/src/mcp/handler.ts#handleAnonymousMcpRequest]] so anonymous public browsing still works.
- `/oauth/authorize` — Consent UI implemented in [[apps/wodsmith-start/src/routes/oauth/authorize.tsx]]. Reuses the existing cookie session; unauthenticated visitors are redirected to `/sign-in` and back. Denials only redirect to the client's registered redirect URI.
- `/oauth/token`, `/oauth/register`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource` — Implemented by `@cloudflare/workers-oauth-provider` itself. Dynamic Client Registration is enabled so clients like Claude Desktop can self-register.

The OAuth provider is wired in [[apps/wodsmith-start/src/server.ts]], wrapping the Sentry handler and the TanStack Start default handler.

The provider attaches its helpers to the `env` arg it passes into `defaultHandler.fetch`. That mutation is not visible through `import { env } from "cloudflare:workers"`, so the consent route's server fns can't read it from the global env. [[apps/wodsmith-start/src/lib/oauth-context.ts]] captures the helpers in AsyncLocalStorage at the handler boundary and [[apps/wodsmith-start/src/server-fns/oauth-fns.ts]] reads them back via `getOAuthHelpersFromContext()`.

## Scopes

Two scopes are exposed today, both demo-grade and read-only. See [[apps/wodsmith-start/src/mcp/scopes.ts]].

- `events:list` — list competitions the user organizes (any status, including drafts).
- `events:read` — read details of any competition the user organizes (any status).

Public resources do not require any scope and are visible to anonymous MCP sessions.

## Resources and tools

The server registers both classic MCP resources (browseable via `resources/list`/`resources/read`) and semantic tools that return `resource_link` and `embedded_resource` content blocks. Both interfaces are backed by the same data layer in [[apps/wodsmith-start/src/mcp/data.ts]].

### Public

Available to anyone, no auth required.

- Resource template: `competition://public/{slug}` — JSON of a published+public competition.
- Tool `list_competitions` with `scope=public` — returns `resource_link` blocks pointing at each public competition.
- Tool `get_competition` with `scope=public` — returns one `embedded_resource` block with the competition JSON.

### Organizer

Requires a bearer token whose grant includes the appropriate scope.

- Resource template `competition://organizer/{slug}` — requires `events:read`. Lists/reads competitions organized by the authenticated user, including drafts and private events.
- Tool `list_competitions` with `scope=organizer` — requires `events:list`.
- Tool `get_competition` with `scope=organizer` — requires `events:read`.

A user "organizes" a competition when they are a site admin or have an active organizing-team membership with `manage_competitions` permission. See [[apps/wodsmith-start/src/mcp/data.ts#listOrganizerCompetitionsForUser]].

## Storage

OAuth state lives in a dedicated `OAUTH_KV` Cloudflare KV namespace bound in [[apps/wodsmith-start/alchemy.run.ts]]. This is intentionally separate from `KV_SESSION` so cookie sessions and OAuth grants can be inspected or cleared independently.

## Tests

See [[apps/wodsmith-start/test/mcp/scopes.test.ts]] for scope-check unit tests and [[apps/wodsmith-start/test/mcp/server.test.ts]] for in-memory MCP server tests covering anonymous browsing, scope enforcement, and embedded-resource shape.
