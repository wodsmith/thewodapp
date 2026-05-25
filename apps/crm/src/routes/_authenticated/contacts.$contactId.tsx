import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { Building2, Handshake, Mail, Phone, UserRound } from "lucide-react"
import { getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/contacts/$contactId")({
  loader: async ({ params }) => {
    const data = await getCrmDataFn()
    const contact = data.contacts.find((item) => item.id === params.contactId)
    if (!contact) throw notFound()

    const gym = contact.companyId
      ? data.gyms.find((item) => item.id === contact.companyId)
      : undefined
    const interactions = data.interactions.filter(
      (interaction) => interaction.contactId === contact.id,
    )

    return { contact, gym: gym ?? null, interactions }
  },
  notFoundComponent: () => <EntityNotFound label="Contact" />,
  component: ContactDetailPage,
})

function ContactDetailPage() {
  const { contact, gym, interactions } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" />
          Contact
        </div>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          {contact.fullName}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {[contact.status, contact.companyName].filter(Boolean).join(" • ")}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <section className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Details
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label="Status" value={contact.status || "Lead"} />
            <Field label="Updated" value={contact.updatedAt} />
            <Field label="Notes" value={contact.notes} wide />
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Contact
          </h3>
          <ContactLine
            icon={<Mail className="h-4 w-4" />}
            value={contact.email}
          />
          <ContactLine
            icon={<Phone className="h-4 w-4" />}
            value={contact.phone}
          />
        </aside>
      </div>

      <section className="rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
          <Building2 className="h-4 w-4" />
          Gym
        </div>
        {gym ? (
          <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.5fr_1fr_1fr]">
            <Link
              to="/gyms/$gymId"
              params={{ gymId: gym.id }}
              className="font-medium underline-offset-4 hover:underline"
            >
              {gym.name}
            </Link>
            <span>{gym.location || "-"}</span>
            <span>{gym.status || "Prospect"}</span>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No gym is linked to this contact yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
          <Handshake className="h-4 w-4" />
          Interactions
        </div>
        <div className="divide-y divide-border">
          {interactions.length > 0 ? (
            interactions.map((interaction) => (
              <div
                key={`${interaction.source}-${interaction.id}`}
                className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.5fr_0.75fr_1fr]"
              >
                <Link
                  to="/interactions/$interactionId"
                  params={{ interactionId: interaction.id }}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {interaction.title}
                </Link>
                <span>{interaction.date || "-"}</span>
                <span>{interaction.status || interaction.channel || "-"}</span>
              </div>
            ))
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No interactions are linked to this contact yet.
            </p>
          )}
        </div>
      </section>
    </section>
  )
}

function Field({
  label,
  value,
  wide,
}: {
  label: string
  value: string | null
  wide?: boolean
}) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value || "-"}</dd>
    </div>
  )
}

function ContactLine({
  icon,
  value,
}: {
  icon: React.ReactNode
  value: string | null
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span>{value || "-"}</span>
    </div>
  )
}

function EntityNotFound({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-border p-6">
      <h2 className="text-xl font-semibold">{label} not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This CRM record may have been removed or has not been seeded yet.
      </p>
    </section>
  )
}
