import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config"
export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        miniflare: {
          compatibilityDate: "2026-09-12",
          compatibilityFlags: ["nodejs_compat", "global_fetch_strictly_public"],
          kvNamespaces: ["OAUTH_KV"],
        },
      },
    },
  },
})
