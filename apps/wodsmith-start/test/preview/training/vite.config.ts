import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const source = fileURLToPath(new URL("../../../src/", import.meta.url))
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: "@/components/workout-import/workout-import-entry", replacement: fileURLToPath(new URL("./import-entry-fixture.tsx", import.meta.url)) },
    { find: "@/server-fns/training-fns", replacement: fileURLToPath(new URL("./fixtures.ts", import.meta.url)) },
    { find: "@/server-fns/training-personal-fns", replacement: fileURLToPath(new URL("./personal-fixtures.ts", import.meta.url)) },
    { find: "@/server-fns/log-fns", replacement: fileURLToPath(new URL("./personal-fixtures.ts", import.meta.url)) },
    { find: "@", replacement: source },
  ] },
  server: { host: "127.0.0.1", port: 8766, strictPort: true },
})
