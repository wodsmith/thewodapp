import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  redirect,
  useMatches,
} from "@tanstack/react-router"
import { SeriesSidebar } from "@/components/series-sidebar"
import { getCompetitionGroupByIdFn } from "@/server-fns/competition-fns"

export const Route = createFileRoute(
  "/compete/organizer/_dashboard/series/$groupId",
)({
  component: SeriesLayout,
  loader: async ({ params, context }) => {
    const session = context.session

    if (!session?.user?.id) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: `/compete/organizer/series/${params.groupId}` },
      })
    }

    const groupResult = await getCompetitionGroupByIdFn({
      data: { groupId: params.groupId },
    })

    if (!groupResult.group) {
      throw notFound()
    }

    return {
      group: groupResult.group,
    }
  },
})

const routeLabels: Record<string, string> = {
  edit: "Edit Series",
  divisions: "Divisions",
  events: "Event Templates",
  "event-mappings": "Event Mappings",
  leaderboard: "Global Leaderboard",
}

function SeriesLayout() {
  const { group } = Route.useLoaderData()
  const { groupId } = Route.useParams()
  const matches = useMatches()

  const currentPath = matches[matches.length - 1]?.pathname ?? ""
  const segments = currentPath.split("/").filter(Boolean)
  const lastSegment = segments[segments.length - 1]

  return (
    <SeriesSidebar groupId={groupId}>
      <div className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        {/* Series Header */}
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            <Link
              to="/compete/organizer/series"
              className="hover:underline"
            >
              Series
            </Link>
            {" / "}
            <span>{group.name}</span>
            {lastSegment && lastSegment !== groupId && routeLabels[lastSegment] && (
              <>
                {" / "}
                <span>{routeLabels[lastSegment]}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold">{group.name}</h1>
          {group.description && (
            <p className="text-muted-foreground mt-1">{group.description}</p>
          )}
        </div>

        {/* Child route content */}
        <Outlet />
      </div>
    </SeriesSidebar>
  )
}
