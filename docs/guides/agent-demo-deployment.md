# Deploy and test the demo agent

The existing Alchemy deployment owns both the WodSmith Start app and its MCP gateway. Demo uses isolated demo SQL and KV resources.

## Deploy demo

Run the GitHub **Deploy** workflow on the reviewed branch with **stage = demo**. Once merged, pushes to main also deploy demo automatically. The workflow pushes the demo schema, validates the agent configuration, deploys Start followed by the gateway, and checks the public OAuth endpoints.

```sh
gh workflow run deploy.yml --ref YOUR_BRANCH -f stage=demo
```

Alchemy provisions `mcp-demo.wodsmith.com` and its TLS certificate. The gateway service binding references the actual deployed app resource and its `AgentTrainingService` entrypoint. There is no manual Worker-name or DNS setup. Existing Cloudflare, PlanetScale and Alchemy workflow credentials are reused.

## Connect

Add a remote MCP connection in your client using **https://mcp-demo.wodsmith.com/mcp**. Sign in with your demo WodSmith account, select the permitted workspaces and scopes, and approve. Review or revoke connections at **https://demo.wodsmith.com/agent/connections**. A public HTTPS endpoint also works from your phone without sharing the Mac's local certificate or Inspector proxy.

Start with read access and ask for the week's published training. With write access, create a session draft, preview it, commit it and verify it in the demo app. Exercise workout/result creation, update and deletion with demo records. Revoke the connection and verify that subsequent calls fail. Real client OAuth and tool execution are separate acceptance checks from the automated endpoint smoke test.

```sh
node apps/wodsmith-agent/scripts/check-demo.mjs
```

The read-only smoke check verifies the exact resource and issuer, expected OAuth endpoints, S256 PKCE and unauthenticated MCP rejection. It retries briefly for custom-domain propagation.

## Production remains explicit

This work does not deploy production. Production deployment still requires selecting `main` and `stage=prod` in the manual workflow and satisfying its production environment protection. Production agent access additionally requires an explicit `AGENT_RESOURCE=https://mcp.wodsmith.com/mcp` configuration, reviewed production schema changes and client acceptance testing. The current workflow does not pass that setting, so ordinary production deployments leave agent access disabled.
