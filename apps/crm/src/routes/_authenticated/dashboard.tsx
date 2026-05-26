import { createFileRoute } from "@tanstack/react-router"
import { Building2, Handshake, Megaphone, Users } from "lucide-react"
import { getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: async () => getCrmDataFn(),
  component: DashboardPage,
})

function DashboardPage() {
  const { gyms, contacts, interactions, campaigns } = Route.useLoaderData()
  const activeGyms = gyms.filter((gym) => gym.status !== "Closed")
  const recentInteractions = interactions.slice(0, 6)

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">CRM workspace</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gym prospects, owner contacts, and outreach activity from the generic
          CRM objects.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric
          icon={<Building2 className="h-5 w-5" />}
          label="Gyms"
          value={activeGyms.length}
        />
        <Metric
          icon={<Users className="h-5 w-5" />}
          label="Contacts"
          value={contacts.length}
        />
        <Metric
          icon={<Handshake className="h-5 w-5" />}
          label="Interactions"
          value={interactions.length}
        />
        <Metric
          icon={<Megaphone className="h-5 w-5" />}
          label="Campaigns"
          value={campaigns.length}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">Priority Gyms</h3>
          </div>
          <div className="divide-y divide-border">
            {gyms.slice(0, 8).map((gym) => (
              <div key={gym.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{gym.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {gym.location || "No location"}
                    </p>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                    {gym.status || "Prospect"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">Recent Interactions</h3>
          </div>
          <div className="divide-y divide-border">
            {recentInteractions.map((interaction) => (
              <div
                key={`${interaction.source}-${interaction.id}`}
                className="px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{interaction.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[interaction.companyName, interaction.contactName]
                        .filter(Boolean)
                        .join(" / ") || "Unassigned"}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {interaction.date || interaction.source}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  )
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  )
}
