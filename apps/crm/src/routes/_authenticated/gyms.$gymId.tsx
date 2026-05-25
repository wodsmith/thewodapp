import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { Building2, Handshake, UserRound } from "lucide-react"
import { getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/gyms/$gymId")({
  loader: async ({ params }) => {
    const data = await getCrmDataFn()
    const gym = data.gyms.find((item) => item.id === params.gymId)
    if (!gym) throw notFound()

    const contacts = data.contacts.filter(
      (contact) => contact.companyId === gym.id,
    )
    const contactIds = new Set(contacts.map((contact) => contact.id))
    const interactions = data.interactions.filter(
      (interaction) =>
        interaction.companyId === gym.id ||
        (interaction.contactId ? contactIds.has(interaction.contactId) : false),
    )

    return { gym, contacts, interactions }
  },
  notFoundComponent: () => <EntityNotFound label="Gym" />,
  component: GymDetailPage,
})

function GymDetailPage() {
  const { gym, contacts, interactions } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Gym
          </div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {gym.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {[gym.location, gym.status, gym.priority]
              .filter(Boolean)
              .join(" • ")}
          </p>
        </div>
        <Link
          to="/interactions"
          search={{}}
          className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
        >
          View all interactions
        </Link>
      </header>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-2">
          <Fact label="Status" value={gym.status || "Prospect"} />
          <Fact label="Priority" value={gym.priority} />
          <Fact label="Owner" value={gym.ownerManager} />
          <Fact label="Relationship" value={gym.relationship} />
          <Fact label="Email" value={gym.email} />
          <Fact label="Phone" value={gym.phone} />
          <Fact label="Last touched" value={gym.lastContacted} />
          <Fact label="Updated" value={gym.updatedAt} />
          <Fact label="Instagram" value={gym.instagram} />
          <Fact label="Website" value={gym.website} href={gym.website} />
        </div>
        {gym.notes ? <NoteBlock>{gym.notes}</NoteBlock> : null}
      </section>

      <RelatedSection
        icon={<UserRound className="h-4 w-4" />}
        title="Contacts"
        empty="No contacts are linked to this gym yet."
      >
        {contacts.map((contact) => (
          <RelatedRow key={contact.id}>
            <Link
              to="/contacts/$contactId"
              params={{ contactId: contact.id }}
              className="font-medium underline-offset-4 hover:underline"
            >
              {contact.fullName}
            </Link>
            <span>{contact.status || "Lead"}</span>
            <span>{contact.email || contact.phone || "-"}</span>
          </RelatedRow>
        ))}
      </RelatedSection>

      <RelatedSection
        icon={<Handshake className="h-4 w-4" />}
        title="Interactions"
        empty="No interactions are linked to this gym yet."
      >
        {interactions.map((interaction) => (
          <RelatedRow key={`${interaction.source}-${interaction.id}`}>
            <Link
              to="/interactions/$interactionId"
              params={{ interactionId: interaction.id }}
              className="font-medium underline-offset-4 hover:underline"
            >
              {interaction.title}
            </Link>
            <span>{interaction.date || "-"}</span>
            <span>{interaction.contactName || interaction.channel || "-"}</span>
          </RelatedRow>
        ))}
      </RelatedSection>
    </section>
  )
}

function Fact({
  label,
  value,
  href,
}: {
  label: string
  value: string | null
  href?: string | null
}) {
  if (!value) return null

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-sm">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      {href ? (
        <a
          href={href.startsWith("http") ? href : `https://${href}`}
          target="_blank"
          rel="noreferrer"
          className="truncate underline-offset-4 hover:underline"
        >
          {value}
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
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

function RelatedSection({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode
  title: string
  empty: string
  children: React.ReactNode[]
}) {
  return (
    <section className="rounded-lg border border-border">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="divide-y divide-border">
        {children.length > 0 ? (
          children
        ) : (
          <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  )
}

function RelatedRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1.5fr_0.75fr_1fr]">
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
