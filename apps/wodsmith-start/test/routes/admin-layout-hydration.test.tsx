// @vitest-environment jsdom
import { act } from "react"
import type { ComponentType, ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { hydrateRoot } from "react-dom/client"
import { afterEach, describe, expect, it, vi } from "vitest"

let routerPath = "/admin"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: Record<string, unknown>) =>
      ({ ...config, options: config }),
  Link: ({
    activeOptions,
    activeProps,
    children,
    className,
    to,
  }: {
    activeOptions?: { exact?: boolean }
    activeProps?: { className?: string }
    children: ReactNode
    className?: string
    to: string
  }) => {
    const active = activeOptions?.exact
      ? routerPath === to
      : routerPath === to || routerPath.startsWith(`${to}/`)

    return (
      <a
        aria-current={active ? "page" : undefined}
        className={activeProps?.className && active ? activeProps.className : className}
        data-status={active ? "active" : undefined}
        href={to}
      >
        {children}
      </a>
    )
  },
  Outlet: () => <div data-testid="admin-outlet" />,
  redirect: vi.fn((options) => options),
}))

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (handler: unknown) => handler,
  }),
}))

vi.mock("@/components/nav/dark-mode-toggle", () => ({
  DarkModeToggle: () => <button type="button">Theme</button>,
}))

vi.mock("@/components/nav/logout-button", () => ({
  default: () => <button type="button">Log out</button>,
}))

vi.mock("@/db/schema", () => ({
  ROLES_ENUM: { ADMIN: "admin" },
}))

vi.mock("@/utils/auth", () => ({
  getSessionFromCookie: vi.fn(),
}))

const { Route } = await import("@/routes/admin")
const AdminLayout = Route.options.component as ComponentType

let root: ReturnType<typeof hydrateRoot> | undefined

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount())
    root = undefined
  }
  document.body.innerHTML = ""
})

async function expectHydrationStable(pathname: string, activeLabel: string) {
  routerPath = pathname
  window.history.replaceState({}, "", "/")
  const serverMarkup = renderToString(<AdminLayout />)
  window.history.replaceState({}, "", pathname)
  const container = document.createElement("div")
  container.innerHTML = serverMarkup
  document.body.appendChild(container)
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

  await act(async () => {
    root = hydrateRoot(container, <AdminLayout />)
  })

  expect(consoleError).not.toHaveBeenCalled()
  const activeLink = Array.from(container.querySelectorAll("a")).find(
    (link) => link.textContent?.trim() === activeLabel,
  )
  expect(activeLink).toHaveAttribute("data-status", "active")
  expect(activeLink).toHaveAttribute("aria-current", "page")
  expect(activeLink).toHaveClass("bg-primary", "text-primary-foreground")
}

describe("AdminLayout hydration", () => {
  // @lat: [[admin-navigation#Admin Navigation Hydration Tests#Dashboard Direct Load Hydrates Stably]]
  it("hydrates /admin with only Dashboard active", async () => {
    await expectHydrationStable("/admin", "Dashboard")
  })

  // @lat: [[admin-navigation#Admin Navigation Hydration Tests#Teams Direct Load Hydrates Stably]]
  it("hydrates /admin/teams with Teams active", async () => {
    await expectHydrationStable("/admin/teams", "Teams")
  })

  // @lat: [[admin-navigation#Admin Navigation Hydration Tests#Nested Team Route Preserves Parent Active State]]
  it("hydrates nested team routes with Teams active", async () => {
    await expectHydrationStable("/admin/teams/team_123", "Teams")
  })
})
