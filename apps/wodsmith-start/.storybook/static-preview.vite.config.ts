import { resolve } from "node:path"
import { defineConfig } from "vite"

export default defineConfig({
  build: {
    outDir: resolve(import.meta.dirname, "../storybook-static"),
  },
  preview: {
    host: "127.0.0.1",
    port: 6007,
    strictPort: true,
  },
})
