import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: ".",
  testMatch: "calculator.spec.ts",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8778",
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: "pnpm exec vite --config test/preview/calculator/vite.config.ts",
    cwd: "../../../",
    url: "http://127.0.0.1:8778/calculator",
    reuseExistingServer: !process.env.CI,
  },
})
