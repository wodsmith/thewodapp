/** TEST ONLY: isolated visual fixture; production never loads this configuration. */
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
export default defineConfig({ root: fileURLToPath(new URL("../../", import.meta.url)), plugins: [react(), tailwindcss()], resolve: { alias: { "@": fileURLToPath(new URL("../../src", import.meta.url)) } } })
