import type { ErrorComponentProps } from "@tanstack/react-router"
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router"
import { LogIn, UserPlus } from "lucide-react"
import type { ReactNode } from "react"
import { Toaster } from "sonner"

import LogoutButton from "@/components/nav/logout-button"
import { Button } from "@/components/ui/button"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "WODsmith Crew",
      },
      {
        name: "description",
        content:
          "WODsmith Crew helps organizers coordinate event staffing, volunteers, and schedules.",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  beforeLoad: async () => {
    const { session, isAdmin, canManageCrewEvents } = await getCrewAuthStateFn()
    return { session, isAdmin, canManageCrewEvents }
  },
  component: RootComponent,
  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
})

function RootComponent() {
  const { session, isAdmin } = Route.useRouteContext()
  const usesEventSidebar = useRouterState({
    select: (state) => usesCrewEventSidebar(state.location.pathname),
  })
  const usesAuthShell = useRouterState({
    select: (state) => usesCrewAuthShell(state.location.pathname),
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      {!usesEventSidebar && !usesAuthShell && (
        <header className="border-b bg-background/95">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link to="/" className="flex items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
                C
              </span>
              <span>WODsmith Crew</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                to="/calculator"
                activeProps={{
                  className: "bg-muted text-foreground",
                }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Calculator
              </Link>
              <Link
                to="/events"
                activeProps={{
                  className: "bg-muted text-foreground",
                }}
                className="rounded-md px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Events
              </Link>
              <Link
                to="/events/new"
                activeProps={{
                  className: "bg-primary text-primary-foreground",
                }}
                className="rounded-md bg-primary px-3 py-2 text-primary-foreground hover:bg-primary/90"
              >
                New event
              </Link>
            </nav>
            <div className="flex items-center gap-2 text-sm">
              {session ? (
                <>
                  <span className="hidden max-w-48 truncate text-muted-foreground sm:block">
                    {session.user.email}
                  </span>
                  {isAdmin && (
                    <Link
                      to="/admin/crew"
                      className="hidden rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground md:inline-flex"
                    >
                      Admin
                    </Link>
                  )}
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/sign-in">
                      <LogIn />
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to="/sign-up">
                      <UserPlus />
                      Sign up
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>
      )}
      <Outlet />
    </div>
  )
}

function usesCrewEventSidebar(pathname: string) {
  const normalizedPathname = pathname.replace(/\/$/, "")
  return (
    /^\/events\/(?!new(?:\/|$))[^/]+(?:\/.*)?$/.test(normalizedPathname) ||
    /^\/admin\/crew\/events\/[^/]+(?:\/.*)?$/.test(normalizedPathname)
  )
}

function usesCrewAuthShell(pathname: string) {
  return /^\/sign-(?:in|up)(?:\/)?$/.test(pathname.replace(/\/$/, ""))
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
        <Scripts />
      </body>
    </html>
  )
}

function RootErrorComponent({ reset }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        The Crew shell hit an unexpected error. Try again when you are ready.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </main>
  )
}

function NotFoundComponent() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">
        That Crew route is not part of this shell.
      </p>
      <Link
        to="/"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Go home
      </Link>
    </main>
  )
}
