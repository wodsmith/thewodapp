import type { ErrorComponentProps } from "@tanstack/react-router"
import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Toaster } from "sonner"

import { CrewHeader } from "@/components/crew-header"
import { getCrewAuthStateFn } from "@/server-fns/crew-auth-fns"
import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
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
    <div className="crew-app min-h-svh min-w-0 bg-background text-foreground">
      {!usesEventSidebar && !usesAuthShell && (
        <CrewHeader session={session} isAdmin={isAdmin} />
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
        <Toaster
          richColors
          closeButton
          position="top-right"
          mobileOffset={{
            top: "calc(6rem + env(safe-area-inset-top))",
            right: 16,
            left: 16,
            bottom: 16,
          }}
        />
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
