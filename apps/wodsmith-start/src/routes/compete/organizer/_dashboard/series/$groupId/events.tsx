import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId/events",
)({
  component: () => <Outlet />,
})
