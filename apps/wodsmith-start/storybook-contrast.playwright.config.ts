import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./storybook-tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  use: {
    baseURL: "http://127.0.0.1:6007",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vite preview --config .storybook/static-preview.vite.config.ts",
    url: "http://127.0.0.1:6007/index.json",
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
