import { readFileSync } from "node:fs"
import { join } from "node:path"
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import agents from "agents/vite"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const dir = process.env.WODSMITH_AGENT_LOCAL_DIR
if (!dir) throw new Error("Start this configuration with pnpm agent:ensure")
const local = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"))

export default defineConfig({
  envDir: join(dir, "empty"),
  cacheDir: join(dir, "vite-cache"),
  plugins: [
    cloudflare({
      configPath: join(dir, "start.json"),
      viteEnvironment: { name: "ssr" },
      persistState: { path: join(dir, "state/start") },
      inspectorPort: local.base + 6,
    }),
    agents(),
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    host: local.host,
    port: local.base,
    strictPort: true,
    https: {
      // The installed HTTP/2 adapter loses Host and stalls large dev modules.
      ALPNCallback: () => "http/1.1",
      key: readFileSync(join(dir, "key.pem")),
      cert: readFileSync(join(dir, "cert.pem")),
    },
  },
  resolve: {
    alias: {
      "server-only": new URL("./src/lib/server-only-stub.ts", import.meta.url)
        .pathname,
    },
  },
})
