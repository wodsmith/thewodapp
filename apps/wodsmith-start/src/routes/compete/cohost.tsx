import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/compete/cohost")({
  component: CohostLayout,
})

function CohostLayout() {
  return <Outlet />
}
