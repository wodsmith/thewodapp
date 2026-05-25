import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import {
  Building2,
  Clock3,
  Handshake,
  Mail,
  Phone,
  UserRound,
} from "lucide-react"
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge value={contact.status || "Lead"} />
          {contact.companyId && contact.companyName ? (
            <Link
              to="/gyms/$gymId"
              params={{ gymId: contact.companyId }}
              className="underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contact.companyName}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <MetaItem
            icon={<Mail className="h-4 w-4" aria-hidden="true" />}
            value={contact.email}
            label="Email"
          />
          <MetaItem
            icon={<Phone className="h-4 w-4" aria-hidden="true" />}
            value={contact.phone}
            label="Phone"
          />
          <MetaItem
            icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
            value={contact.companyName}
            label="Gym"
          />
          <MetaItem
            icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
            value={contact.updatedAt}
            label="Updated"
          />
        </div>
        {contact.notes ? <NoteBlock>{contact.notes}</NoteBlock> : null}
      </section>

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

function Badge({ value }: { value: string | null }) {
  if (!value) return null

  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {value}
    </span>
  )
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | null
}) {
  if (!value) return null

  return (
    <span
      title={`${label}: ${value}`}
      className="inline-flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 truncate">{value}</span>
    </span>
  )
}

function NoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
      {children}
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
