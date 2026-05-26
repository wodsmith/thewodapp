import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useMatches,
  useNavigate,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Building2,
  ChevronRight,
  Handshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
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
            <NavLink to="/campaigns" icon={<Megaphone className="h-4 w-4" />}>
              Campaigns
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
        <CrmBreadcrumbs />
        <Outlet />
      </main>
    </div>
  )
}

function CrmBreadcrumbs() {
  const location = useLocation()
  const matches = useMatches()
  const pathParts = location.pathname.split("/").filter(Boolean)

  if (pathParts.length === 0 || pathParts[0] === "dashboard") return null

  const section = pathParts[0]
  const detailLabel = getDetailLabel({
    section,
    loaderData: matches.at(-1)?.loaderData,
  })
  const crumbs = [
    { label: "Dashboard", to: "/dashboard" as const },
    { label: sectionLabel(section), to: `/${section}` },
  ]

  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
    >
      {crumbs.map((crumb, index) => (
        <span key={crumb.to} className="inline-flex items-center gap-1">
          {index > 0 ? <ChevronRight className="h-3.5 w-3.5" /> : null}
          <Link
            to={crumb.to}
            className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {crumb.label}
          </Link>
        </span>
      ))}
      {detailLabel ? (
        <span className="inline-flex min-w-0 items-center gap-1 text-foreground">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{detailLabel}</span>
        </span>
      ) : null}
    </nav>
  )
}

function sectionLabel(section: string) {
  if (section === "gyms") return "Gyms"
  if (section === "contacts") return "Contacts"
  if (section === "interactions") return "Interactions"
  if (section === "campaigns") return "Campaigns"
  return section
}

function getDetailLabel({
  section,
  loaderData,
}: {
  section: string
  loaderData: unknown
}) {
  if (!loaderData || typeof loaderData !== "object") return null
  if (
    !(
      "gym" in loaderData ||
      "contact" in loaderData ||
      "interaction" in loaderData
    )
  ) {
    return null
  }

  if (section === "gyms" && "gym" in loaderData) {
    return (loaderData.gym as { name?: string } | undefined)?.name ?? null
  }
  if (section === "contacts" && "contact" in loaderData) {
    return (
      (loaderData.contact as { fullName?: string } | undefined)?.fullName ??
      null
    )
  }
  if (section === "interactions" && "interaction" in loaderData) {
    return (
      (loaderData.interaction as { title?: string } | undefined)?.title ?? null
    )
  }

  return null
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: "/dashboard" | "/gyms" | "/contacts" | "/interactions" | "/campaigns"
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
