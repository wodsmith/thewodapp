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
	},
	plugins: [tsconfigPaths()],
	resolve: {
		alias: {
			"server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
			"@": resolve(__dirname, "./src"),
		},
	},
})
