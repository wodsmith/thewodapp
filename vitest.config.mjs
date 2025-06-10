import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": resolve(__dirname, "./test/__mocks__/server-only.js"),
    },
  },
});