import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const config = defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  build: {
    target: "esnext",
    rollupOptions: {
      external: [
        "node:async_hooks",
        "node:stream",
        "node:stream/web",
        "cloudflare:workers",
      ],
    },
  },
  ssr: {
    optimizeDeps: {
      include: ["clsx", "tailwind-merge"],
    },
  },
})

export default config
