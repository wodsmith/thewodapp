// Values provisioned in alchemy.run.ts; raw Wrangler defaults are development-only.
declare namespace Cloudflare {
  interface Env {
    OAUTH_KV: KVNamespace
    AGENT_AUTH_ORIGIN: string
    AGENT_RESOURCE: string
  }
}
