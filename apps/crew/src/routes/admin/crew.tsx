// @lat: [[crew#Crew Admin Shell]]
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useRouterState,
} from "@tanstack/react-router"
import { getCrewAuthRedirect } from "@/lib/crew/auth-redirect"
import {
  type CrewAdminEventListItem,
  getCrewAdminEventListFn,
} from "@/server-fns/crew-admin-event-fns"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"

export const Route = createFileRoute("/admin/crew")({
  beforeLoad: async ({ location }) => {
    const { session, isAdmin } = await getCrewAuthStateFn()

    if (!session) {
      throw redirect({
        to: "/sign-in",
        search: { redirect: getCrewAuthRedirect(location) },
      })
    }

    if (!isAdmin) {
      throw new Error("FORBIDDEN: Crew admin is available to WODsmith admins.")
    }
  },
  loader: async ({ location }) => {
    if (isAdminCrewEventDetailRoute(location.pathname)) {
      return { events: [] as CrewAdminEventListItem[] }
    }

    return await getCrewAdminEventListFn()
  },
  component: CrewAdminShell,
})

function CrewAdminShell() {
  const { events } = Route.useLoaderData() as {
    events: CrewAdminEventListItem[]
  }
  const isAdminEventDetail = useRouterState({
    select: (state) => isAdminCrewEventDetailRoute(state.location.pathname),
  })
  const isAdminIndex = useRouterState({
    select: (state) =>
      state.location.pathname.replace(/\/$/, "") === "/admin/crew",
  })

  if (isAdminEventDetail) {
    return <Outlet />
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium uppercase text-muted-foreground">
            WODsmith Admin
          </p>
          <h1 className="text-3xl font-semibold">Crew control room</h1>
          <p className="text-muted-foreground">
            Internal operator surface for pilots, diagnostics, billing, and
            conversion handoff.
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link
            to="/admin/crew"
            activeOptions={{ exact: true }}
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Overview
          </Link>
          <Link
            to="/admin/crew/events"
            activeProps={{ className: "bg-muted text-foreground" }}
            className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Events
          </Link>
        </nav>
      </div>

      {isAdminIndex ? (
        <section className="grid gap-4 md:grid-cols-3">
          <section className="rounded-md border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Crew events</p>
            <p className="mt-2 text-2xl font-semibold">{events.length}</p>
          </section>
          <section className="rounded-md border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Needs setup</p>
            <p className="mt-2 text-2xl font-semibold">
              {
                events.filter((event) => event.setupProgress.percent < 100)
                  .length
              }
            </p>
          </section>
          <section className="rounded-md border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Unpaid</p>
            <p className="mt-2 text-2xl font-semibold">
              {events.filter((event) => event.billingState === "unpaid").length}
            </p>
          </section>
          <Link
            to="/admin/crew/events"
            className="rounded-md border bg-card p-5 shadow-sm transition-colors hover:bg-muted/50 md:col-span-3"
          >
            <h2 className="text-lg font-semibold">Open event admin</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Inspect pilot status, source context, billing state, readiness
              diagnostics, and conversion readiness.
            </p>
          </Link>
        </section>
      ) : (
        <Outlet />
      )}
    </main>
  )
}

function isAdminCrewEventDetailRoute(pathname: string) {
  return /^\/admin\/crew\/events\/[^/]+(?:\/.*)?$/.test(
    pathname.replace(/\/$/, ""),
  )
}
