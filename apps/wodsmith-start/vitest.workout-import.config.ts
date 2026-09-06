import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vitest/config"

// The real server adapter rejects browser environments. Keep these binding/DO
// tests separate from the app's Radix/jsdom setup, with no remote credentials.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.runtime.spec.ts"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./test/__mocks__/server-only.js", import.meta.url),
      ),
      "cloudflare:workers": fileURLToPath(
        new URL("./test/__mocks__/cloudflare-workers.js", import.meta.url),
      ),
    },
  },
})
