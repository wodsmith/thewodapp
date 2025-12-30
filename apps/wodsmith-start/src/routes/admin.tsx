import {createFileRoute, Link, Outlet, redirect} from '@tanstack/react-router'
import {createServerFn} from '@tanstack/react-start'
import {ClipboardList, Home, Settings, Trophy} from 'lucide-react'
import {DarkModeToggle} from '@/components/nav/dark-mode-toggle'
import LogoutButton from '@/components/nav/logout-button'
import {cn} from '@/utils/cn'

// Server function to validate admin session
const validateAdminSessionFn = createServerFn({method: 'GET'}).handler(
  async () => {
    const {ROLES_ENUM} = await import('@/db/schema')
    const {getSessionFromCookie} = await import('@/utils/auth')
    const session = await getSessionFromCookie()

    if (!session) {
      throw redirect({
        to: '/sign-in',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        search: {redirect: '/admin'} as any,
      })
    }

    // Check for admin role
    if (session.user.role !== ROLES_ENUM.ADMIN) {
      throw redirect({
        to: '/',
      })
    }

    return {session}
  },
)

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const {session} = await validateAdminSessionFn()
    return {session}
  },
  component: AdminLayout,
})

/**
 * Platform admin navigation items
 */
const platformNavItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: Home,
  },
  {
    title: 'Competitions',
    href: '/admin/competitions',
    icon: Trophy,
  },
  {
    title: 'Organizer Requests',
    href: '/admin/organizer-requests',
    icon: ClipboardList,
  },
  {
    title: 'Entitlements',
    href: '/admin/entitlements',
    icon: Settings,
  },
]

function AdminSidebar() {
  // Get current path from window.location for active state
  const currentPath =
    typeof window !== 'undefined' ? window.location.pathname : ''

  const isActive = (href: string) => {
    // Exact match for dashboard
    if (href === '/admin') {
      return currentPath === '/admin'
    }
    // Prefix match for other routes
    return currentPath.startsWith(href)
  }

  return (
    <div className="space-y-4">
      {/* Platform Section */}
      <div>
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Platform
        </p>
        <nav className="space-y-1">
          {platformNavItems.map((item) => {
            const active = isActive(item.href)
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="border-black border-b-2 bg-background p-4 dark:border-dark-border dark:bg-dark-background">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-xl font-bold">
              WODsmith
            </Link>
            <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900 dark:text-red-100">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            <DarkModeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Sidebar */}
          <aside className="space-y-4">
            <AdminSidebar />
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
