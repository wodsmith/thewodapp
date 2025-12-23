import {createFileRoute, Outlet, redirect} from '@tanstack/react-router'
import {validateSession} from '@/server-fns/middleware/auth'

export const Route = createFileRoute('/compete/organizer')({
  beforeLoad: async () => {
    // Validate session - organizer routes require authentication
    const session = await validateSession()

    // Redirect to sign-in if no session
    if (!session) {
      throw redirect({
        to: '/sign-in',
        search: {
          redirect: '/compete/organizer',
        },
      })
    }

    return {session}
  },
  component: OrganizerLayout,
})

function OrganizerLayout() {
  return <Outlet />
}
