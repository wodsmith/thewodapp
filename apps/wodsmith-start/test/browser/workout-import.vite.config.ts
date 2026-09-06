/** TEST ONLY: isolated visual fixture; production never loads this configuration. */
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
export default defineConfig({ plugins: [react(), tailwindcss()], resolve: { alias: { "@": resolve(process.cwd(), "src") } } })
