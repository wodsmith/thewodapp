# WodSmith agent gateway

Remote MCP over a private binding to WodSmith Start. OAuth consent uses the existing login origin at `/agent/authorize`; connected apps can be reviewed and revoked at `/agent/connections`.

The checked-in Wrangler configuration is local-only and uses HTTPS localhost. Provider 0.10.3 requires HTTPS authorization-server identifiers, including local consent; run the Start preview with HTTPS on port 3000 and the gateway on HTTPS port 8791. It names `wodsmith-start`, which is the raw Start Wrangler configuration name. Alchemy generates a different stage-specific Worker name. For an Alchemy deployment, set the service binding to the **actual generated/deployed Start Worker name**, entrypoint `AgentTrainingService`; do not copy the local service name into a deployment.

Start requires `OAUTH_KV` (separate from browser sessions), `AGENT_AUTH_ORIGIN` (existing login origin) and `AGENT_RESOURCE` (exact gateway URL including `/mcp`). Alchemy provisions KV and uses `APP_URL` for the authorization origin. It leaves `AGENT_RESOURCE` empty unless supplied, disabling gateway OAuth on ordinary demo deployments. Apply reviewed SQL migrations before enabling this resource. Production and demo require separate KV and SQL environments, distinct canonical resource URLs, and matching gateway vars. No credentials belong in Wrangler configuration.

Local verification:

```sh
pnpm --filter wodsmith-agent cf-typegen
pnpm --filter wodsmith-agent type-check
pnpm --filter wodsmith-agent test
pnpm --filter wodsmith-agent build  # dry run only
WODSMITH_TEST_MYSQL_SOCKET=/path/to/local-test.sock pnpm --filter wodsmith-start exec vitest run test/integration/agent-oauth.test.ts test/integration/agent-planning.test.ts test/integration/agent-service.test.ts
```

Tests execute the shipped OAuth provider and MCP SDK inside workerd. The compatible Vitest 3 pool currently bundles March 2026 workerd and reports a compatibility-date fallback; do not treat it as a deployed runtime or real ChatGPT/Claude acceptance result. SQL tests create and drop only an isolated local database; the test configuration rejects remote hosts.

The public gateway never receives WodSmith browser cookies, database credentials, or caller-supplied actor permissions. Domain tool definitions and mutations come from Start services. Unsupported tools are absent. A failed domain action returns a structured error and `isError: true`; it never reports a successful save.
