import type { Decorator, Preview } from "@storybook/react-vite"
import { TooltipProvider } from "../src/components/ui/tooltip"
import "../src/styles.css"

const withWodsmithTheme: Decorator = (Story, context) => {
  const isDark = context.globals.theme === "dark"
  document.documentElement.classList.add("group")
  document.documentElement.classList.toggle("dark", isDark)

  return (
    <TooltipProvider delayDuration={0}>
      <div className="min-h-screen bg-background p-8 text-foreground">
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
    layout: "centered",
  },
}

export default preview
