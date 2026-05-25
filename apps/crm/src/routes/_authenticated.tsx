import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Building2,
  Handshake,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react"
import { checkAuthFn, logoutFn } from "@/server-fns/auth"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const isAuthenticated = await checkAuthFn()
    if (!isAuthenticated) {
      throw redirect({ to: "/" })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const navigate = useNavigate()
  const logout = useServerFn(logoutFn)

  const handleLogout = async () => {
    await logout()
    navigate({ to: "/" })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/wodsmith-logo-no-text.png"
              alt="WODsmith"
              width={32}
              height={32}
            />
            <h1 className="text-base font-semibold">WODsmith CRM</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink
              to="/dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink to="/gyms" icon={<Building2 className="h-4 w-4" />}>
              Gyms
            </NavLink>
            <NavLink to="/contacts" icon={<Users className="h-4 w-4" />}>
              Contacts
            </NavLink>
            <NavLink
              to="/interactions"
              icon={<Handshake className="h-4 w-4" />}
            >
              Interactions
            </NavLink>
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: "/dashboard" | "/gyms" | "/contacts" | "/interactions"
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-secondary [&.active]:text-foreground"
    >
      {icon}
      {children}
    </Link>
  )
}
