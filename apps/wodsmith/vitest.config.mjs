import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./test/setup.ts"],
		include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],
		// Use node environment for integration tests (better-sqlite3 needs native modules)
		environmentMatchGlobs: [
			["test/integration/**", "node"],
			["test/unit/**", "node"],
			["test/components/**", "jsdom"],
		],
		testTimeout: 10000,
		// Coverage configuration
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: ["src/actions/**", "src/server/**"],
		},
	},
	plugins: [tsconfigPaths()],
	resolve: {
		alias: {
			"server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
			"@": resolve(__dirname, "./src"),
		},
	},
})
