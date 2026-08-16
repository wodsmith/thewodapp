// @vitest-environment jsdom
import type { ComponentType } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("@tanstack/react-router", () => ({
  createFileRoute:
    () =>
    (config: Record<string, unknown>) =>
      ({ ...config, options: config }),
}))

const { Route } = await import("@/routes/admin/index")
const AdminDashboardPage = Route.options.component as ComponentType

describe("AdminDashboardPage headings", () => {
  // @lat: [[admin-navigation#Admin Dashboard Heading Tests#Direct Dashboard Exposes One Page Heading]]
  it("uses the visible dashboard title as the only h1", () => {
    render(<AdminDashboardPage />)

    expect(
      screen.getByRole("heading", { level: 1, name: "Admin Dashboard" }),
    ).toBeVisible()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })

  // @lat: [[admin-navigation#Admin Dashboard Heading Tests#Dashboard Sections Follow the Page Heading]]
  it("uses h2 headings for dashboard sections", () => {
    render(<AdminDashboardPage />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Quick Actions" }),
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { level: 2, name: "Recent Activity" }),
    ).toBeVisible()
  })
})
