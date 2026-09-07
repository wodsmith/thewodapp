import { readFileSync } from "node:fs"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const context = vi.hoisted(() => ({ hasWorkoutTracking: false }))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useRouteContext: () => context }),
  Outlet: () => <div>Settings content</div>,
  useLocation: () => ({ pathname: "/settings/appearance" }),
  Link: ({ to, children, ...props }: React.PropsWithChildren<{ to: string }>) => <a href={to} {...props}>{children}</a>,
}))
import { Route as Appearance } from "@/routes/_protected/settings/appearance/index"
import { Route as Settings } from "@/routes/_protected/settings"
const AppearancePage = Appearance.options.component as React.ComponentType
const SettingsPage = Settings.options.component as React.ComponentType
const rootSource = readFileSync("src/routes/__root.tsx", "utf8")
const startupScript = rootSource.match(/const themeScript = `([\s\S]*?)`/)![1]

beforeEach(() => {
  localStorage.clear()
  document.cookie = "theme=; Max-Age=0; path=/"
  document.documentElement.classList.remove("dark")
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe("Settings preferences", () => {
  // @lat: [[settings-account-tests#Settings Account Tests#Theme survives reload]]
  it.each(["dark", "light"] as const)("restores %s after root startup and remount", (theme) => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: theme === "light" })))
    const { unmount } = render(<AppearancePage />)
    fireEvent.click(screen.getByRole("button", { name: theme === "dark" ? "Dark" : "Light" }))
    expect(localStorage.getItem("theme")).toBe(theme)
    expect(document.cookie).toContain(`theme=${theme}`)
    unmount()
    document.documentElement.classList.toggle("dark", theme !== "dark")
    window.eval(startupScript)
    expect(document.documentElement.classList.contains("dark")).toBe(theme === "dark")
    render(<AppearancePage />)
    expect(screen.getByRole("button", { name: theme === "dark" ? "Dark" : "Light" })).toHaveAttribute("aria-pressed", "true")
  })

  // @lat: [[settings-account-tests#Settings Account Tests#Programming entitlement navigation]]
  it("passes the current route entitlement through to Programming navigation", () => {
    context.hasWorkoutTracking = false
    const { rerender } = render(<SettingsPage />)
    expect(screen.queryByRole("link", { name: "Programming" })).not.toBeInTheDocument()
    context.hasWorkoutTracking = true
    rerender(<SettingsPage />)
    expect(screen.getByRole("link", { name: "Programming" })).toHaveAttribute("href", "/settings/programming")
  })
})
