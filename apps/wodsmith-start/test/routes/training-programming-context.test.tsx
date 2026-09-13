import { cleanup, render } from "@testing-library/react"
import type { ComponentType } from "react"
import { afterEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({
  activeTeamId: "navbar-team" as string | null,
  planner: vi.fn(() => null),
}))
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    options,
    useLoaderData: () => ({ activeTeamId: "fallback-team", teams: [], userId: "user" }),
    useRouteContext: () => ({ activeTeamId: mock.activeTeamId }),
    useSearch: () => ({ teamId: "legacy-url-team" }),
  }),
}))
vi.mock("@/components/training/coach-planner", () => ({ CoachPlanner: mock.planner }))
vi.mock("@/server-fns/training-fns", () => ({ getTrainingContextFn: vi.fn() }))
import { Route } from "@/routes/_protected/training/programming"
afterEach(cleanup)

// @lat: [[training#Active Team Programming Tests#Legacy URLs cannot override navbar context]]
it("uses root active-team context even when the loader or old URL points elsewhere", () => {
  const Page = Route.options.component as ComponentType
  const view = render(<Page />)
  expect(mock.planner).toHaveBeenLastCalledWith(expect.objectContaining({ context: expect.objectContaining({ activeTeamId: "navbar-team" }) }), undefined)
  const validate = Route.options.validateSearch as (search: unknown) => unknown
  expect(validate({ teamId: "legacy-url-team" })).toEqual({})
  mock.activeTeamId = null
  view.rerender(<Page />)
  expect(mock.planner).toHaveBeenLastCalledWith(expect.objectContaining({ context: expect.objectContaining({ activeTeamId: null }) }), undefined)
})
