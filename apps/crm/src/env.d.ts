// Augment the Cloudflare Env interface with project-specific bindings.
// This replaces the gitignored worker-configuration.d.ts for type-checking.
declare namespace Cloudflare {
  interface Env {
    DB: D1Database
    CRM_MCP: DurableObjectNamespace
    R2_BUCKET: R2Bucket
    APP_URL: string
    NODE_ENV: string
    CRM_AUTH_PASSWORD: string
    CRM_SESSION_SECRET: string
  }
}

// Cloudflare Workers extends SubtleCrypto with timingSafeEqual.
// The DOM lib's SubtleCrypto interface doesn't include it, so we augment it here.
interface SubtleCrypto {
  timingSafeEqual(
    a: ArrayBuffer | ArrayBufferView,
    b: ArrayBuffer | ArrayBufferView,
  ): boolean
}
