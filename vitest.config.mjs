import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: [],
		exclude: ["tests/e2e/**"],
	},
	plugins: [tsconfigPaths()],
	resolve: {
		alias: {
			"server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
		},
	},
})
