import { defineConfig } from "vite"
import tsConfigPaths from "vite-tsconfig-paths"
import { cloudflare } from "@cloudflare/vite-plugin"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"

export default defineConfig({
	server: {
		port: 3000,
	},
	resolve: {
		alias: {
			// Alias vinxi/http to a browser-safe stub in client builds
			// The actual vinxi/http is only used in server-side code
			"vinxi/http": "./src/lib/vinxi-http-stub.ts",
		},
	},
	build: {
		rollupOptions: {
			// Cloudflare Workers-only module specifier. It must not be bundled into the browser build.
			external: ["cloudflare:workers"],
		},
	},
	plugins: [
		tsConfigPaths({
			projects: ["./tsconfig.json"],
		}),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart(),
		viteReact(),
	],
})
