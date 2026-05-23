import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LogOut } from "lucide-react"
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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img
              src="/wodsmith-logo-no-text.png"
              alt="WODsmith"
              width={32}
              height={32}
            />
            <h1 className="text-base font-semibold">WODsmith CRM</h1>
          </div>
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
