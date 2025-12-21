import { defineConfig, devices } from "@playwright/test"

const isCI = !!process.env.CI
const baseURL = "http://localhost:3000"

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: isCI ? "50%" : undefined,

	// Run database seeding before all tests
	globalSetup: "./e2e/global-setup.ts",

	reporter: isCI
		? [["blob"], ["github"], ["list"]]
		: [["html", { open: "never" }]],

	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		command: isCI ? "pnpm start" : "pnpm dev",
		url: baseURL,
		reuseExistingServer: !isCI,
		timeout: 120_000,
	},
})
