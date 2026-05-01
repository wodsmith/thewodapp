import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/cohost-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  beforeLoad: ({ search }) => {
    if (search.token) {
      throw redirect({
        to: "/compete/cohost-invite/$token",
        params: { token: search.token },
        search: () => ({ token: undefined }),
      })
    }
  },
  component: () => <Outlet />,
})
