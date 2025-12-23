import {createFileRoute, Outlet} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import CompeteNav from '@/components/compete-nav'
import {getSessionFromCookie} from '@/utils/auth'
import {TEAM_PERMISSIONS} from '@/db/schemas/teams'

// Server function to get session and permissions
const getCompeteNavDataFn = createServerFn({method: 'GET'}).handler(
  async () => {
    const session = await getSessionFromCookie()

    // Check if user has MANAGE_COMPETITIONS permission in any team
    const canOrganize = session?.teams
      ? session.teams.some((team) =>
          team.permissions.includes(TEAM_PERMISSIONS.MANAGE_COMPETITIONS),
        )
      : false

    return {session, canOrganize}
  },
)

export const Route = createFileRoute('/compete')({
  component: CompeteLayout,
  loader: async () => {
    const {session, canOrganize} = await getCompeteNavDataFn()
    return {session, canOrganize}
  },
})

function CompeteLayout() {
  const {session, canOrganize} = Route.useLoaderData()

  return (
    <div className="flex min-h-screen flex-col">
      <CompeteNav session={session} canOrganize={canOrganize} />

      <main className="container mx-auto flex-1 pt-4 sm:p-4">
        <Outlet />
      </main>

      <footer className="border-black border-t-2 p-4">
        <div className="container mx-auto">
          <p className="text-center">
            &copy; {new Date().getFullYear()} WODsmith. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
