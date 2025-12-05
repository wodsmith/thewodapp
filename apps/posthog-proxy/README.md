# PostHog Reverse Proxy (Cloudflare Worker)

Cloudflare Worker that forwards PostHog traffic through a custom domain to avoid ad blockers and keep analytics on `*.wodsmith.com`.

## Defaults

- Upstream ingest host: `us.i.posthog.com`
- Asset host: `us-assets.i.posthog.com`
- Public path prefix: `/ingest` (strip this before forwarding)
- Allowed origins: `https://wodsmith.com`, `https://www.wodsmith.com`

## Local development

```bash
pnpm install --filter posthog-proxy
pnpm dev --filter posthog-proxy
```

## Deploy

Update `routes` in `wrangler.jsonc` if you need a different domain, then:

```bash
pnpm deploy --filter posthog-proxy
```

Point your PostHog clients to `https://analytics.wodsmith.com/ingest`.
