import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/organizer/series/$groupId/events",
)({
  component: () => <Outlet />,
})
