import {createFileRoute, Outlet} from '@tanstack/react-router'

export const Route = createFileRoute('/compete/organizer/series/$groupId')({
  component: SeriesLayout,
})

function SeriesLayout() {
  return <Outlet />
}
