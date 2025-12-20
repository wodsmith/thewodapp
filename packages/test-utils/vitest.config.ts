import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		name: "@repo/test-utils",
		include: ["src/**/*.test.ts"],
	},
})
