import { createFileRoute, Outlet } from "@tanstack/react-router"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"

export const Route = createFileRoute("/compete/series/$groupId")({
  loader: async ({ params }) => {
    const { group } = await getCompetitionGroupByIdFn({
      data: { groupId: params.groupId },
    })
    if (!group) throw new Error("Series not found")
    return { group }
  },
  component: SeriesLayout,
})

function SeriesLayout() {
  return <Outlet />
}
