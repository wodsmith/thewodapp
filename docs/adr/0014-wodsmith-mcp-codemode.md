---
status: proposed
date: 2026-05-27
decision-makers: [Zac Jones]
consulted: [Cloudflare Code Mode docs, Cloudflare Dynamic Workers docs, PostHog agent-first product engineering article]
informed: []
---

# ADR-0014: Server-Side Code Mode for the WODsmith MCP Server

## Context and Problem Statement

WODsmith is adding an MCP server so external coding and operations agents can work with competition, registration, scoring, scheduling, CRM, and organizer data without driving the browser UI. A naive MCP server would expose many fine-grained tools, one per endpoint or server function. That creates a large token footprint, pushes orchestration back into the LLM one tool call at a time, and makes multi-step workflows slow and brittle.

Cloudflare's Code Mode pattern addresses this by exposing a compact code execution tool: the model writes TypeScript or JavaScript against a typed API, and that code runs in a Dynamic Worker sandbox. The sandbox can only call host-provided tool methods, while the host Worker keeps credentials, authorization checks, validation, logging, and policy enforcement.

The WODsmith-specific question is not only "how do we wrap tools in Code Mode?" It is "what product surface should agents receive?" PostHog's agent-first guidance is useful here: agents should be able to do the same work users can do, but at an abstraction level they reason about well, with universal product context front-loaded and sensitive exceptions made deliberately. For WODsmith, that means Code Mode should expose curated product capabilities, not a dump of UI handlers or database access.

How should WODsmith implement Code Mode for its MCP server so agents get a compact, composable interface while WODsmith keeps tenant isolation, entitlement checks, auditability, and destructive actions under control?

## Decision Drivers

- **Agent capability parity**: agents should be able to complete real WODsmith workflows without handing the user back to the UI for routine steps.
- **Compact context**: the MCP server should avoid loading dozens or hundreds of tool schemas into every model context.
- **Semantic product API**: tool methods should reflect WODsmith domain tasks and safe data shapes, not raw route internals or unrestricted SQL.
- **Deny-by-default exposure**: no endpoint, server function, binding, table, or external service becomes available to agents unless a product-area manifest explicitly opts it in.
- **Host-owned trust boundary**: secrets, user credentials, tenant/team scope, entitlements, logging, and approval policy remain in the host Worker, never in generated code.
- **Sandbox isolation**: generated code must run without direct Internet access and without direct Cloudflare binding access.
- **Operational debuggability**: each run needs traceable code, tool calls, logs, duration, user/team scope, output size, and failure reason.
- **Incremental adoption**: the first version should ship read-heavy workflows, then broaden writes behind preview/approval patterns.

## Considered Options

### A. Expose every WODsmith operation as a normal MCP tool

Build a conventional MCP server with many individual tools, each carrying its full JSON schema and description.

**Pros:** Simple conceptually. Works with every MCP client. Fine for a small tool set.
**Cons:** Token usage grows with every product area. Agents have to chain many calls through model round trips. Tool names tend to mirror implementation boundaries instead of agent reasoning boundaries. Large workflows are slower and easier to derail. **Rejected** as the default strategy.

### B. Wrap a curated WODsmith MCP tool registry with Cloudflare Code Mode

Build a normal, host-side registry of WODsmith capabilities and expose it primarily through `@cloudflare/codemode/mcp` using `codeMcpServer({ server, executor })`. Generated code runs in a Dynamic Worker through `DynamicWorkerExecutor`, and each `codemode.*` call RPCs back into host-side tool handlers.

**Pros:** Keeps a small MCP surface while preserving typed, composable operations. Host handlers retain validation, auth, entitlements, logging, redaction, and write policy. Fits the existing Cloudflare stack and the existing AI-agent pattern in `apps/wodsmith-start`. Supports loops, joins, filtering, retries, and result shaping inside one sandbox run.
**Cons:** Code Mode is currently experimental in Cloudflare's docs, so package APIs may move. Debugging includes one more layer: generated code plus host tool calls. Some MCP clients and models may be weaker at code-generation workflows than direct tool calls.

### C. Generate Code Mode directly from an OpenAPI spec

Expose the WODsmith API through OpenAPI and use `openApiMcpServer({ spec, executor, request })`.

**Pros:** Good long-term fit if WODsmith develops a public, stable REST API. Keeps auth headers in the host request handler. Can scale across many endpoints.
**Cons:** WODsmith's main app is currently built around TanStack Start server functions and domain-specific server modules, not a comprehensive OpenAPI API. An endpoint-shaped surface risks exposing the wrong abstraction to agents. **Rejected for v1**, but worth revisiting after a stable public API exists.

### D. Let generated code call WODsmith HTTP endpoints directly

Give the Dynamic Worker outbound network access and session/API credentials so generated code can call the same HTTP routes a browser would.

**Pros:** Fastest to prototype if endpoints already exist.
**Cons:** Breaks the trust boundary. Secrets or bearer tokens enter generated code or an outbound proxy. Authorization, redaction, and policy become harder to centralize. Direct egress also makes prompt-injection and data-exfiltration failures more damaging. **Rejected.**

### E. Run Code Mode inside the browser

Use `@cloudflare/codemode/browser` with an iframe sandbox and client-side tools.

**Pros:** Useful for browser-owned capabilities and local UI automation.
**Cons:** The WODsmith MCP server is a server-side automation surface. Browser Code Mode cannot own server credentials, cross-session automation, database access, or reliable audit logs. **Rejected for the MCP server.**

## Decision Outcome

Chosen option: **B. Wrap a curated WODsmith MCP tool registry with Cloudflare server-side Code Mode.**

WODsmith will implement the MCP server as a host Cloudflare Worker route, initially inside `apps/wodsmith-start` so it can reuse the existing Cloudflare deployment, PlanetScale/Hyperdrive access, session/auth utilities, entitlements, evlog/Sentry/PostHog logging, and product-domain modules. If MCP traffic, release cadence, or security review later requires stronger isolation, the same registry can move to a dedicated `apps/wodsmith-mcp` Worker that imports shared domain packages.

The MCP server will maintain a normal host-side capability registry, but external clients will primarily see a compact Code Mode surface. The host will wrap the upstream MCP server with `codeMcpServer({ server, executor })`; the executor will be `DynamicWorkerExecutor` backed by an Alchemy `WorkerLoader()` binding named `LOADER`.

Generated code is untrusted. It runs in a fresh Dynamic Worker per execution using `load()` semantics through the Code Mode executor. The executor must set `globalOutbound: null` and an explicit timeout. The sandbox receives no secrets, no database handles, no R2/KV bindings, no Cloudflare AI binding, and no raw session tokens. Its only useful capability is calling `codemode.<capability>()`, which is proxied back to host-side handlers.

The product API exposed to Code Mode will be deliberately agent-facing:

1. Capabilities are grouped by WODsmith product area: competitions, registrations, athletes/teams, scoring, heats/scheduling, broadcasts, commerce summaries, CRM, and docs/context.
2. Each product area owns a manifest that opts in capabilities explicitly. Nothing is exported by scanning routes or server functions.
3. Capability names are verb-oriented and domain-level, for example `searchCompetitions`, `getCompetitionWorkspace`, `listRegistrations`, `previewScoreImport`, `createBroadcastDraft`, and `summarizeOrganizerStatus`.
4. Capabilities return redacted, bounded DTOs. They do not return arbitrary database rows, raw payment payloads, session cookies, password/auth fields, or unlimited lists.
5. Universal WODsmith context is front-loaded into the Code Mode tool description: domain vocabulary, tenant/team scoping rules, common workflow invariants, date/time handling, PII constraints, and when to prefer preview/draft operations.
6. Specialized "skills" or recipes describe WODsmith taste and edge cases, not step-by-step scripts. They should answer "what would an agent get wrong about WODsmith without us?"

### Write Policy

The v1 Code Mode surface is read-first and draft-first.

- **Allowed in v1**: read queries, summaries, validations, simulations, preview imports, draft creation, and idempotent updates with narrow schemas.
- **Requires explicit approval outside Code Mode**: payments, refunds, registration cancellation, publishing scores, sending broadcasts, deleting data, changing organizer permissions, and any action that contacts athletes.
- **Pattern for sensitive writes**: Code Mode creates a host-side pending operation with a typed diff, risk summary, idempotency key, and expiration. A separate direct MCP tool or first-party UI applies the pending operation after user approval. Code Mode itself does not pause mid-execution for approval.

This deliberately creates exceptions to "agents can do everything users can" for high-impact actions. The exceptions are product policy, not accidental missing capabilities.

### Consequences

- **Good**, because the MCP surface stays compact even as WODsmith capabilities grow.
- **Good**, because agents can use normal TypeScript control flow for loops, joins, filtering, retries, and result shaping instead of spending model steps on glue.
- **Good**, because WODsmith keeps credentials and tenant enforcement in host-side handlers.
- **Good**, because product teams can broaden the agent surface by opting in capabilities one product area at a time.
- **Good**, because the same host registry can support direct MCP tools for smoke tests, internal diagnostics, or emergency fallback without making them the default model-facing surface.
- **Bad**, because Code Mode and Dynamic Workers add new Cloudflare dependencies and are documented as experimental, so implementation should expect API churn.
- **Bad**, because observability must account for both generated code and the host tool calls it triggers.
- **Bad**, because some clients may perform worse with code-generation tools than with direct tools; we need evals and fallback guidance.
- **Neutral**, because the first version does not expose every WODsmith action. Sensitive writes move through pending operations until approval UX and audit controls are mature.

## Detailed Design

### Host Location and Routing

Initial implementation lands in `apps/wodsmith-start`:

- `apps/wodsmith-start/src/server/mcp/` contains MCP server construction, capability registry, auth helpers, output redaction, and Code Mode setup.
- `apps/wodsmith-start/src/server.ts` routes `/mcp` to the MCP handler before falling through to the TanStack Start handler.
- `apps/wodsmith-start/alchemy.run.ts` adds `LOADER: WorkerLoader()` to the Worker bindings and keeps existing AI Gateway, Hyperdrive, KV, R2, queue, and Durable Object bindings host-only.
- `apps/wodsmith-start/package.json` adds `@cloudflare/codemode` and, if not already present through the existing `agents` dependency, `@modelcontextprotocol/sdk`.

This is the lowest-friction path because the main app already owns WODsmith's Cloudflare deployment, session cookies, entitlement checks, database access, and logging stack. The registry should still be written so it can move to `apps/wodsmith-mcp` later without changing tool semantics.

### MCP and Code Mode Assembly

The host creates an upstream MCP server from curated capabilities, then wraps it:

```ts
import { DynamicWorkerExecutor } from "@cloudflare/codemode"
import { codeMcpServer } from "@cloudflare/codemode/mcp"

const executor = new DynamicWorkerExecutor({
  loader: env.LOADER,
  globalOutbound: null,
  timeout: 30_000,
})

const upstream = createWodsmithMcpServer({ env, authContext, requestId })
const server = await codeMcpServer({ server: upstream, executor })
```

The host uses Cloudflare's MCP transport helpers (`McpAgent.serve()` for stateful sessions or `createMcpHandler()` for stateless transport). Start with `createMcpHandler()` unless v1 requires per-session MCP state or elicitation; add `McpAgent` only when there is a concrete stateful need.

### Capability Registry

Each capability is declared once with:

- stable name and description
- Zod input schema
- output size budget and redaction policy
- required auth scope, team scope, and feature entitlement
- mutability class: `read`, `draft`, `idempotent_write`, or `approval_required`
- handler that calls existing WODsmith server/data modules

Proposed file shape:

```text
apps/wodsmith-start/src/server/mcp/
  auth.ts
  capability-registry.ts
  code-mode.ts
  handler.ts
  redaction.ts
  capabilities/
    competitions.ts
    registrations.ts
    scoring.ts
    scheduling.ts
    broadcasts.ts
    crm.ts
    docs.ts
```

This follows the existing agent split: pure schemas and helpers should live under `src/lib/mcp/` when they are testable without Cloudflare bindings; DB-backed loaders and handlers stay under `src/server/mcp/`.

### Security Controls

- `globalOutbound: null` is mandatory. No direct `fetch()` or socket access from generated code.
- Dynamic Workers receive no WODsmith bindings except the Code Mode RPC dispatcher managed by `@cloudflare/codemode`.
- Host handlers validate every input with Zod, even though the model saw TypeScript definitions.
- Every handler checks authenticated user, team scope, role, competition ownership/cohost permissions, and feature entitlement as appropriate.
- Outputs are redacted before returning to the sandbox and again before logging.
- List endpoints enforce pagination and hard result limits. Large results return cursors, summaries, or references.
- Tool call logs include user id, team id, competition id when available, capability name, duration, status, sandbox run id, and redacted error.
- Generated code is stored only in redacted audit logs with a retention period set by policy. Do not log secrets or full PII payloads.

### Universal Context and Agent Taste

The Code Mode tool description should include concise WODsmith guidance that agents cannot infer:

- WODsmith is multi-tenant by team; never mix competition data across teams unless a host capability explicitly returns a cross-team operator view.
- Competition organizer workflows distinguish drafts, previews, published state, and athlete-visible side effects.
- Time zones matter for event schedules and registration windows; return/accept explicit ISO timestamps and competition timezone where possible.
- Athlete contact, payment, and account-authentication data are sensitive and should be minimized in outputs.
- Prefer preview/draft capabilities before irreversible actions.
- When summarizing registrations or scoring, include assumptions and unresolved conflicts rather than silently choosing.

This is "taste" context, not a procedural script. The model should remain free to compose capabilities creatively inside the sandbox.

### Observability and Evals

MCP Code Mode needs first-class test and review loops:

- Unit test capability schemas, auth policy, redaction, pagination, and mutability classification.
- Integration test `code` execution with a mocked or local Dynamic Worker executor: multi-call loop, join/filter workflow, direct `fetch()` failure, timeout, output truncation, and host error propagation.
- Add golden eval traces for common agent workflows: find likely registration issues, summarize competition readiness, preview score import, draft athlete broadcast, and inspect CRM follow-ups.
- Dogfood through an MCP CLI/inspector before UI testing, matching the environment external agents use.
- Review real traces regularly and convert repeated agent mistakes into capability descriptions, universal context, or eval cases.

## Implementation Plan

### Phase 1: Read-Only Code Mode MCP

1. Add `@cloudflare/codemode` to `apps/wodsmith-start`.
2. Add `WorkerLoader` to the Alchemy Cloudflare import list and bind `LOADER: WorkerLoader()` in `alchemy.run.ts`.
3. Add the MCP route in `src/server.ts`, using the existing request logging wrapper and auth/session helpers.
4. Create `src/server/mcp/handler.ts`, `capability-registry.ts`, `code-mode.ts`, `auth.ts`, and `redaction.ts`.
5. Implement read-only capabilities for identity, teams, competition search, competition workspace summary, registration lists/counts, scoring status, scheduling status, and docs/context search.
6. Wrap the upstream MCP server with `codeMcpServer({ server, executor })`.
7. Verify generated code cannot use outbound `fetch()` and can only call host capabilities.

### Phase 2: Draft and Preview Writes

1. Add draft/preview capabilities for score imports, broadcast drafts, organizer checklist changes, and CRM follow-up drafts.
2. Require idempotency keys for all idempotent writes.
3. Persist pending operations for any action that needs approval.
4. Add a direct MCP approval/apply tool or first-party UI route for applying pending operations.
5. Add audit views/log queries for pending and applied operations.

### Phase 3: Broader Agent Capability Parity

1. Add per-product-area manifests for additional WODsmith workflows.
2. Promote stable capabilities into shared docs and eval cases.
3. Revisit whether the MCP server should move from `apps/wodsmith-start` to a dedicated `apps/wodsmith-mcp` Worker.
4. Consider `openApiMcpServer` only after WODsmith has a stable OpenAPI surface whose endpoint semantics match agent tasks.

## Verification

- [ ] `pnpm --filter wodsmith-start type-check` passes after adding Code Mode dependencies and the `LOADER` binding type.
- [ ] `pnpm --filter wodsmith-start test -- --runInBand src/server/mcp` or the equivalent targeted Vitest suite passes.
- [ ] A Code Mode integration test proves `fetch("https://example.com")` from generated code fails when `globalOutbound: null`.
- [ ] A Code Mode integration test proves generated code can call at least three host capabilities in a loop and return a reduced result.
- [ ] Auth tests prove a user cannot access another team's competition through Code Mode.
- [ ] Redaction tests prove payment, auth, session, token, password, and raw PII fields are not returned or logged.
- [ ] Write-policy tests prove `approval_required` capabilities cannot be executed inside Code Mode as final side effects.
- [ ] MCP CLI/inspector smoke test connects to `/mcp`, sees the Code Mode surface, and completes a read-only competition summary workflow.
- [ ] evlog/Sentry/PostHog logs include run id, user/team scope, capability call summaries, duration, status, and redacted errors.
- [ ] `lat.md/architecture.md` documents the MCP Code Mode architecture and links implementation code once it exists.

## Non-Goals

- **No direct database or SQL access for generated code in v1.** Any future query language must run through allowlisted views, row/column policy, and output budgets.
- **No browser automation MCP for the main app.** The MCP server is an API-level automation surface, not a replacement for Playwright or browser agents.
- **No direct network egress from the sandbox.** External APIs are exposed only through host capabilities.
- **No automatic export of TanStack server functions as MCP tools.** Every capability is explicitly designed and opted in.
- **No final execution of destructive user-visible actions inside Code Mode v1.** Use pending operations and approval.

## References

- Cloudflare Agents docs: [Codemode](https://developers.cloudflare.com/agents/api-reference/codemode/)
- Cloudflare Dynamic Workers docs: [Getting started](https://developers.cloudflare.com/dynamic-workers/getting-started/), [Bindings](https://developers.cloudflare.com/dynamic-workers/usage/bindings/), [Egress control](https://developers.cloudflare.com/dynamic-workers/usage/egress-control/), [Observability](https://developers.cloudflare.com/dynamic-workers/usage/observability/)
- Cloudflare Agents docs: [McpAgent](https://developers.cloudflare.com/agents/api-reference/mcp-agent-api/), [Remote MCP server](https://developers.cloudflare.com/agents/guides/remote-mcp-server/), [MCP tools](https://developers.cloudflare.com/agents/model-context-protocol/tools/)
- PostHog: [The golden rules of agent-first product engineering](https://posthog.com/newsletter/agent-first-product-engineering)
