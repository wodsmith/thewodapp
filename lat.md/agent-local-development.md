# Agent local development

The local launcher provides a repeatable app, MCP gateway, Inspector, and synthetic MySQL environment for desktop and LAN browser testing.

Run `pnpm agent:ensure --lan` for phone testing or omit `--lan` for loopback. See `docs/guides/agent-local-development.md` for prerequisites and browser connection steps. The OAuth boundaries are described in [[agent-gateway]].

## Lifecycle and persistence

The supervisor reuses a running environment, preserves local state on stop, and only terminates process groups it spawned.

`scripts/agent-local/dev.mjs` (`ensure`) selects available ports, writes ignored configuration and starts the supervisor. `scripts/agent-local/dev.mjs` (`serve`) owns MySQL, Vite, Wrangler and pinned Inspector processes. A secret-authenticated loopback control endpoint handles status and stop. Dead supervisors with occupied ports require inspection instead of automatically killing processes.

`scripts/agent-local/seed.mjs` (`seedFixture`) creates a fresh current-schema database once, with a local athlete, entitled workspaces, track subscription and five published sessions. Its persisted schema fingerprint rejects incompatible restarts. Existing data and fixture dates are preserved. This does not validate historical migrations.

## Local configuration isolation

Generated bindings use private local resources and matching OAuth origins; network selection accepts only assigned private IPv4 addresses for LAN access.

`scripts/agent-local/config.mjs` (`configuration`) gives each checkout/profile distinct Worker names and keeps MySQL on loopback. The launcher excludes application environment files and avoids Alchemy provisioning. Unit coverage checks origins, service names, database destination and private-address boundaries.

## Occupied port protection

The port probe skips occupied port blocks without changing existing listeners, preventing interference with other development environments.

`scripts/agent-local/config.mjs` (`portsFree`) temporarily reserves each port and releases its own sockets. Its test keeps an unrelated listener open and verifies it remains running after a failed probe.

## Private Inspector entry

The HTTPS proxy requires a private entry link and secure cookie before serving Inspector, while the raw backend stays on loopback with its own authentication and isolated credential storage.

`scripts/agent-local/proxy.mjs` (`createInspectorProxy`) redirects the entry link to Inspector with its API token. The cookie is Secure, HttpOnly and SameSite=Lax. Requests without it are rejected; WebSocket upgrades additionally require the Inspector origin. Tests cover anonymous and malformed credentials, entry headers, and authenticated forwarding.

## Browser origin compatibility

The local Vite server uses HTTPS over HTTP/1.1 to preserve OAuth request authority and reliably load large development modules.

`apps/wodsmith-start/vite.agent-local.config.ts` selects HTTP/1.1 through TLS ALPN. The installed HTTP/2 adapter loses Host and stalls large module imports in Chromium. Production origin checks remain enabled. Real browser acceptance covers login, consent and a training-week tool call.
