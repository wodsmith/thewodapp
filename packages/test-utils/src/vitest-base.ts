import { defineConfig } from "vitest/config"

/**
 * Base Vitest configuration for all packages in the monorepo.
 * Extend this config using mergeConfig for package-specific settings.
 * 
 * @example
 * ```ts
 * // apps/wodsmith/vitest.config.ts
 * import { mergeConfig } from "vitest/config"
 * import { baseConfig } from "@repo/test-utils/vitest"
 * 
 * export default mergeConfig(baseConfig, {
 *   test: {
 *     name: "wodsmith",
 *     environment: "jsdom"
 *   }
 * })
 * ```
 */
export const baseConfig = defineConfig({
  test: {
    mockReset: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      enabled: false,
      exclude: ["**/node_modules/**", "**/test/**", "**/*.test.{ts,tsx}"]
    },
    include: ["**/*.{test,spec}.{ts,tsx}"]
  }
})

// Re-export mergeConfig for convenience
export { mergeConfig } from "vitest/config"
