import { createFileRoute, Outlet } from "@tanstack/react-router"
import CompeteNav from "@/components/compete-nav"

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="min-h-screen bg-background">
      <CompeteNav
        session={null}
        canOrganize={false}
        hasOrganizerApplication={false}
      />
      <main>
        <Outlet />
      </main>
    </div>
  )
}
