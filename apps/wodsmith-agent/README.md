# WodSmith agent gateway

Remote MCP over a private binding to WodSmith Start. OAuth consent uses the existing login origin at `/agent/authorize`; connected apps can be reviewed and revoked at `/agent/connections`.

Alchemy deploys the hosted gateway alongside Start, including its custom domain and named `AgentTrainingService` binding. Demo uses `https://mcp-demo.wodsmith.com/mcp` and authenticates through `https://demo.wodsmith.com`. Production agent access remains disabled by default. See [demo deployment](../../docs/guides/agent-demo-deployment.md).

The checked-in Wrangler configuration is local-only. For repeatable local or phone testing, run `pnpm agent:ensure --lan`; see [local development](../../docs/guides/agent-local-development.md).

Start owns `OAUTH_KV`, SQL grants and the application database. The gateway receives only the private service binding and exact public authorization/resource URLs. No credentials belong in Wrangler configuration.

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
