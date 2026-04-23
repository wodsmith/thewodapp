import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/cohost-invite")({
  component: () => <Outlet />,
})
