import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { baseConfig } from "@repo/test-utils/vitest"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"
import { mergeConfig } from "vitest/config"

const __dirname = dirname(fileURLToPath(import.meta.url))

export default mergeConfig(baseConfig, {
	test: {
		name: "wodsmith",
		environment: "jsdom",
		globals: true,
		setupFiles: ["./test/setup.ts"],
		include: ["./test/**/*.test.ts", "./test/**/*.test.tsx"],
		exclude: ["./e2e/**", "**/node_modules/**"],
	},
	plugins: [react(), tsconfigPaths()],
	resolve: {
		alias: {
			"server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
			"@": resolve(__dirname, "./src"),
		},
	},
})
