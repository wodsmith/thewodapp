import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
const local = (file: string) => fileURLToPath(new URL(file, import.meta.url))
export default defineConfig({
  root: local("."),
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "track-preview-fallback",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (
            request.url?.startsWith("/training") ||
            request.url?.startsWith("/programming") ||
            request.url?.startsWith("/admin")
          )
            request.url = "/track-preview.html"
          next()
        })
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: "@tanstack/react-start",
        replacement: local("./start-fixture.ts"),
      },
      {
        find: "@/server-fns/training-fns",
        replacement: local("./track-training-fixtures.ts"),
      },
      {
        find: "@/server-fns/training-personal-fns",
        replacement: local("./track-personal-fixtures.ts"),
      },
      {
        find: "@/server-fns/log-fns",
        replacement: local("./personal-fixtures.ts"),
      },
      {
        find: "@/server-fns/track-follow-fns",
        replacement: local("./track-fixtures.ts"),
      },
      {
        find: "@/server-fns/crossfit-import-fns",
        replacement: local("./track-fixtures.ts"),
      },
      { find: "@", replacement: local("../../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 8767, strictPort: true },
})
