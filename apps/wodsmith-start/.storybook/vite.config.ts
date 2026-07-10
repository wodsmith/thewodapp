import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [resolve(import.meta.dirname, "../tsconfig.json")],
    }),
    tailwindcss(),
  ],
})
