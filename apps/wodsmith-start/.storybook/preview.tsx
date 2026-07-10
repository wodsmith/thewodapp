import type { Decorator, Preview } from "@storybook/react-vite"
import { TooltipProvider } from "../src/components/ui/tooltip"
import "../src/styles.css"
import "./theme.css"

const withWodsmithTheme: Decorator = (Story, context) => {
  const isDark = context.globals.theme === "dark"
  const isDocs = context.viewMode === "docs"

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={`wodsmith-story-theme group flex w-full items-center justify-center bg-background p-8 text-foreground${isDocs ? "" : " min-h-screen"}${isDark ? " dark" : ""}`}
      >
        <Story />
      </div>
    </TooltipProvider>
  )
}

const preview: Preview = {
  decorators: [withWodsmithTheme],
  initialGlobals: {
    theme: "light",
  },
  globalTypes: {
    theme: {
      description: "WODsmith color theme",
      toolbar: {
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
  },
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
  },
}

export default preview
