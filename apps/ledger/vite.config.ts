import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import alchemy from "alchemy/cloudflare/tanstack-start"
import { defineConfig } from "vite"
import viteTsConfigPaths from "vite-tsconfig-paths"

const config = defineConfig({
	plugins: [
		alchemy({
			persistState: {
				path: "./.alchemy/local/.wrangler/state",
			},
		}),
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
			external: ["node:async_hooks", "cloudflare:workers"],
		},
	},
	ssr: {
		optimizeDeps: {
			include: ["clsx", "tailwind-merge", "class-variance-authority"],
		},
	},
})

export default config
