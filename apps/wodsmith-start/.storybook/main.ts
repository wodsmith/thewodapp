import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { StorybookConfig } from "@storybook/react-vite"

const configDirectory = dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  stories: ["../src/components/ui/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    builder: {
      name: "@storybook/builder-vite",
      options: {
        viteConfigPath: resolve(configDirectory, "vite.config.ts"),
      },
    },
    disableTelemetry: true,
  },
}

export default config
