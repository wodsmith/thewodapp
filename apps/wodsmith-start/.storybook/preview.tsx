import type { Decorator, Preview } from "@storybook/react-vite"
import { type ReactNode, useLayoutEffect } from "react"
import { TooltipProvider } from "../src/components/ui/tooltip"
import "../src/styles.css"
import "./theme.css"

function CanvasThemeRoot({
  children,
  isDark,
  isDocs,
}: {
  children: ReactNode
  isDark: boolean
  isDocs: boolean
}) {
  useLayoutEffect(() => {
    if (isDocs) return

    const targets = [
      document.documentElement,
      document.body,
      document.getElementById("storybook-root"),
    ].filter((target): target is HTMLElement => target !== null)
    const previousState = targets.map((target) =>
      target.classList.contains("dark"),
    )

    for (const target of targets) target.classList.toggle("dark", isDark)

    return () => {
      targets.forEach((target, index) => {
        target.classList.toggle("dark", previousState[index])
      })
    }
  }, [isDark, isDocs])

  return children
}

const withWodsmithTheme: Decorator = (Story, context) => {
  const isDark = context.globals.theme === "dark"
  const isDocs = context.viewMode === "docs"

  return (
    <CanvasThemeRoot isDark={isDark} isDocs={isDocs}>
      <TooltipProvider delayDuration={0}>
        <div
          className={`wodsmith-story-theme group flex w-full items-center justify-center bg-background p-8 text-foreground${isDocs ? "" : " min-h-screen"}${isDark ? " dark" : ""}`}
          data-wodsmith-theme={isDark ? "dark" : "light"}
          data-wodsmith-view-mode={isDocs ? "docs" : "story"}
        >
          <Story />
        </div>
      </TooltipProvider>
    </CanvasThemeRoot>
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
