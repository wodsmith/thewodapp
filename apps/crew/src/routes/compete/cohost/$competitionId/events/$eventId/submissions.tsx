/**
 * Cohost Submissions Layout Route
 *
 * Renders an Outlet so child routes (list index, detail) display correctly.
 */

import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/compete/cohost/$competitionId/events/$eventId/submissions",
)({
  component: SubmissionsLayout,
})

function SubmissionsLayout() {
  return <Outlet />
}
