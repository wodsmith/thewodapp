import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
	test: {
		// Use node environment by default for better-sqlite3 compatibility
		// Component tests that need jsdom should use // @vitest-environment jsdom directive
		environment: "node",
		globals: true,
		setupFiles: ["./test/setup.ts"],
		include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],
		// Exclude component tests until React environment is properly configured
		exclude: [
			"**/node_modules/**",
			"**/test/components/**",
			"**/test/pages/**",
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
