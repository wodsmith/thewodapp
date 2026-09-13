# Agent gateway

The training MCP gateway delegates named tools through a private Worker binding. WodSmith remains the authority for login, grants, workspace access and all domain operations.

## OAuth and consent

Consent stays on the existing login origin. The gateway accepts OAuth access tokens only, with no browser-session fallback or caller-supplied actor fields.

[[apps/wodsmith-start/src/agent/consent.ts#handleAgentOAuth]] hosts consent at `/agent/authorize`, token and registration endpoints under `/agent`, and connected-app management at `/agent/connections`, linked from Settings. An unset resource disables these routes. Alchemy defaults it to empty, so an ordinary deployment does not enable an unmigrated gateway.

The shipped `@cloudflare/workers-oauth-provider` 0.10.3 owns code exchange, refresh, S256 PKCE, CIMD and DCR. Its installed API differs from the newer split-provider API on the upstream main branch. An omitted scope defaults to `training:read` only. All resource scopes are discoverable; consent initially checks only the requested read scope. Deletion and publication require separate selections.

Consent uses a ten-minute database ticket bound to the authenticated user and browser cookie digest. Approval validates the same origin, consumes the ticket once under a row lock, reparses the stored authorization URL, and intersects requested permissions with explicit selections. Workspace choices are checked against current active, unexpired memberships. Client text is escaped; the page cannot be framed.

## Live grants

SQL grants govern immediate application revocation independently of the OAuth library's eventually consistent KV protocol records.

[[apps/wodsmith-start/src/agent/grants.ts#resolveAgentActor]] requires the exact resource URL, unexpired provider token, matching user/client identity, and a live SQL grant. Token scopes intersect the SQL grant. Allowed teams intersect current memberships. Password hash changes, authentication generation changes and account deletion invalidate old grants; browser recovery does not silently renew an agent connection.

[[apps/wodsmith-start/src/agent/grants.ts#assertLiveAgentGrant]] checks grants and memberships on the domain transaction connection. Shared row locks serialize an in-flight commit with grant revocation. Consent created before password recovery cannot be completed afterward using a stale browser proof. Hyperdrive caching remains disabled.

## Transport and domain boundary

A fresh SDK server handles each request, with modern MCP envelopes and stateless compatibility for 2025 clients. The gateway has no SQL connection or domain mutation implementation.

[[apps/wodsmith-agent/src/index.ts#handleGateway]] returns a real HTTP 401 and protected-resource discovery for missing or invalid tokens. Authorization storage failure returns a sanitized 503. Exact origin, resource path and query checks prevent token use on another resource. The protocol implementation uses `agents` 0.23.0 and MCP server 2.0.0, verified from installed package types and runtime.

[[apps/wodsmith-start/src/agent/service.ts#AgentTrainingService]] exposes only private RPC methods. Each invocation resolves its actor again and delegates the catalogue and execution to [[training-agent-services]]. Structured outcomes retain domain error codes and MCP `isError`; reads, writes, deletes and publication use their domain catalogue annotations. No unimplemented operation is advertised.

## Local validation and rollout

Local tests use the shipped OAuth provider in workerd and isolated MySQL grant tables. Real ChatGPT and Claude account connections remain a deployment acceptance gate.

Gateway tests cover discovery, actual URL client metadata resolution, exact audiences, S256, registered redirects, scope narrowing, refresh identity, token tampering, legacy initialization and modern envelopes. Alchemy explicitly enables `global_fetch_strictly_public`; the custom-entrypoint build check guards that deployment setting. SQL tests cover cross-user revoke, scope/workspace tampering, ticket concurrency, live membership changes, expiry, deletion and password recovery. OAuth protocol tests use real provider KV; SQL boundary tests replace token parsing with controlled validated-token fixtures.

The Vitest 3-compatible Worker pool currently runs a March 2026 workerd and reports a compatibility-date fallback. This is not evidence of production or live-host interoperability. Gateway CI runs tests, generated binding types, TypeScript and a Wrangler dry-run build. Its path filters include the private service, Start entrypoint, Alchemy configuration and canonical training catalog/planning sources. The Start database integration workflow runs the grant tests against MySQL.

Migration `0011_agent_oauth_grants.sql` creates grants and consent tickets. Apply schema through the normal reviewed database workflow before explicitly configuring matching authorization/resource URLs and the actual Start Worker service name. No production migration or deployment is part of this change.

## Planning adapter

The gateway advertises eight canonical planning operations with explicit read/write scopes. Draft creation is distinct from an idempotent commit, and stale previews remain actionable errors.

[[apps/wodsmith-start/src/agent/planning-operations.ts#executePlanningOperation]] uses the schemas and service from [[training-plans#Canonical Adapter]]. It requires live grant authorization even for the versioned blueprint, preserves planning error details under stable validation/conflict categories, and sanitizes unknown failures. Canonical SQL tests cover the domain lifecycle; gateway adapter tests cover scope-filtered discovery, blueprint versions, annotations and error mapping.

## Successful service integration

A composed service test exercises successful authorization, discovery, canonical reads, plan creation, preview, commit retry and revocation against isolated MySQL.

This test runs the real private service methods, SQL grants, entitlement checks and A/B domain implementations. It substitutes validated provider-token input and the WorkerEntrypoint host base; separate workerd tests verify real OAuth parsing and the compiled named binding. These seams do not claim a live client connection.
