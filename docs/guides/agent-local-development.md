# Agent local development

Run WodSmith's app, MCP Worker, MySQL fixture, and MCP Inspector together with one command. The app runs through Vite with hot reload; the gateway uses local Wrangler service bindings.

## Start

From the repository root, using Node 24 or newer:

```sh
pnpm install
pnpm agent:ensure --lan
```

Prerequisites are pnpm, Node, OpenSSL, and a MySQL 8-compatible `mysqld` binary on PATH. On macOS, `brew install mysql openssl` supplies the latter two. No system MySQL service needs to be started. Linux is supported by the launcher; macOS is the verified host. Windows requires WSL and may need additional LAN forwarding.

For computer-only testing, omit `--lan`. The two modes have separate fixture databases and Worker state. `--lan` detects the Mac's default network interface; if detection is ambiguous, use `pnpm agent:ensure --lan --host 192.168.1.20` with an address assigned to your computer.

The command prints the app URL, MCP URL, private Inspector link, fixture login, and training week. Keep the computer awake and the terminal command's background supervisor running. A healthy environment is reused when you run the command again. First startup takes longer while Inspector is downloaded and Vite prepares dependencies.

## Connect from your phone

Connect your phone and computer to the same trusted Wi-Fi/LAN. Open the printed **Inspector** link in your phone's browser. This is a private link: anyone with it can use your local Inspector. Bookmark it; it remains stable across restarts while the LAN address and ports remain available.

The setup uses a self-signed certificate. Visit the printed app URL and Inspector link and accept the browser's local certificate exception where supported. It does not install a trusted root certificate on either device. Inspector's backend already trusts this certificate, so the phone does not need to visit the MCP URL separately.

In Inspector, switch on the WodSmith server, sign in, select a workspace and permissions, and approve. If prompted to configure a server manually, choose **Streamable HTTP** and use the printed MCP URL. OAuth happens in the same browser and returns you to Inspector.

The default fixture credentials are `athlete@wodsmith.local` / `LocalTraining123!`. Choose **Local Programming Lab** to inspect published programming. Call `get_training_week` with the JSON printed by the launcher. It specifies `team_agent_provider`, `track_agent_local`, and the fixture's Monday. There are five published sessions. **My local training** is the athlete's personal workspace, initially empty, where you can build your own week.

If a phone cannot load the app URL, check that it is on the same network, not guest Wi-Fi, and that the computer's firewall allows these local Node processes. A certificate refusal is different from an unreachable host. If the browser offers no certificate exception, use a certificate trusted on that device before testing there.

This workflow tests MCP from a phone browser using Inspector. Connecting a cloud-hosted assistant requires an endpoint reachable by that assistant; a private LAN URL alone does not provide that. The launcher does not create a public tunnel. Inspector's MCP Apps iframe sandbox is not exposed over LAN; this setup covers tools, resources, prompts, and OAuth.

## Everyday commands

```sh
pnpm agent:ensure --lan  # Start or reuse; print phone link and fixture details
pnpm agent:status --lan  # Show the current environment and URLs
pnpm agent:stop --lan    # Stop only services owned by this supervisor
pnpm test:agent-local    # Check configuration, port isolation, and private proxy
```

Omit `--lan` consistently to operate the desktop-only environment. App and gateway source edits reload during development. Launcher/configuration changes should be followed by stop and ensure. If your LAN address changes, stop and start again to regenerate matching OAuth origins and a certificate.

All generated state is under ignored `.agent-local/desktop/` or `.agent-local/lan/`: `manifest.json`, certificate/key, logs, MySQL data, Worker KV, and `fixture.json`. `app.log`, `gateway.log`, `inspector.log`, and `supervisor.log` are the first logs to inspect. The launcher selects an available ten-port block starting at 3400. Only app, MCP, and protected Inspector ports bind to the selected LAN address. MySQL, the raw Inspector backend, auxiliary origins, debugger ports, and the supervisor control endpoint stay on loopback.

Stopping preserves data, OAuth grants, sessions, fixture dates, and the private link. The launcher signals only its retained child process groups. It never searches for and kills unrelated Vite, Wrangler, or MySQL processes. After an abnormal supervisor crash, it refuses to claim occupied ports belonging to the old environment; inspect the logs before manually cleaning up orphaned processes.

## Data and configuration boundaries

The local MySQL instance contains synthetic data and listens on loopback with an empty local root password. The launcher generates the current Drizzle schema in a new database and seeds it once. This checks current-schema behavior, **not migration history**. Repeated starts do not reset or move your training data. A changed schema fingerprint stops startup with an explanation instead of attempting a destructive migration.

To start fresh after a schema change, first stop both profiles. Move `.agent-local` to a backup directory, then run ensure again. Keep the backup if you want to retain your test workouts. Do not delete a live MySQL data directory.

The launcher uses generated Worker configs and an empty environment directory. It does not load application `.env` files, run Alchemy provisioning, require Cloudflare account credentials, or connect to production bindings. Inspector is pinned to version 2.6.0. Its catalog and local OAuth credentials use a private file store inside the profile, separate from your normal Inspector/keychain connections. The local compatibility date is 2026-04-22, supported by the gateway's locked Wrangler 4.83 runtime; deployed configuration is separate.

The local Vite server negotiates HTTPS over HTTP/1.1. The installed HTTP/2 adapter loses request authority and stalls large development modules in Chromium. HTTP/1.1 preserves OAuth origins and reliable client hydration. Sign-in remains disabled until its client handler is ready. Application authorization and CSRF checks remain enabled.

## Reference

This workflow adapts Kody's generated local configuration, persistent fixtures, and healthy-environment reuse patterns: [local development](https://github.com/kentcdodds/kody/blob/72d0c62d821fb03fffe179d147c4cf5190cee484/docs/contributing/setup/local-development.md) and [dev:ensure](https://github.com/kentcdodds/kody/blob/72d0c62d821fb03fffe179d147c4cf5190cee484/tools/ensure-dev.ts). WodSmith retains its pnpm/Node toolchain and MySQL architecture.
