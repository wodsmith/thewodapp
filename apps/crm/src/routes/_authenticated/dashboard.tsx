import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <section className="max-w-2xl space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">CRM workspace</h2>
      <p className="text-sm text-muted-foreground">
        This app shell is ready for CRM-specific workflows.
      </p>
    </section>
  )
}
