import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import { Building2, Handshake, UserRound } from "lucide-react"
import { getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute(
  "/_authenticated/interactions/$interactionId",
)({
  loader: async ({ params }) => {
    const data = await getCrmDataFn()
    const interaction = data.interactions.find(
      (item) => item.id === params.interactionId,
    )
    if (!interaction) throw notFound()

    const gym = interaction.companyId
      ? data.gyms.find((item) => item.id === interaction.companyId)
      : undefined
    const contact = interaction.contactId
      ? data.contacts.find((item) => item.id === interaction.contactId)
      : undefined

    return { interaction, gym: gym ?? null, contact: contact ?? null }
  },
  notFoundComponent: () => <EntityNotFound label="Interaction" />,
  component: InteractionDetailPage,
})

function InteractionDetailPage() {
  const { interaction, gym, contact } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <header>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Handshake className="h-4 w-4" />
          {interaction.source}
        </div>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">
          {interaction.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {[interaction.date, interaction.channel, interaction.status]
            .filter(Boolean)
            .join(" • ")}
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-2">
          <Fact label="Date" value={interaction.date} />
          <Fact label="Channel" value={interaction.channel} />
          <Fact label="Status" value={interaction.status} />
          <Fact label="Gym" value={interaction.companyName} />
          <Fact label="Contact" value={interaction.contactName} />
          <Fact label="Updated" value={interaction.updatedAt} />
        </div>
        {interaction.notes ? <NoteBlock>{interaction.notes}</NoteBlock> : null}
        {interaction.content ? (
          <NoteBlock>{interaction.content}</NoteBlock>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <AssociationCard
          icon={<Building2 className="h-4 w-4" />}
          title="Gym"
          empty="No gym linked"
        >
          {gym ? (
            <>
              <Link
                to="/gyms/$gymId"
                params={{ gymId: gym.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {gym.name}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {[gym.location, gym.status].filter(Boolean).join(" • ") || "-"}
              </p>
            </>
          ) : null}
        </AssociationCard>

        <AssociationCard
          icon={<UserRound className="h-4 w-4" />}
          title="Contact"
          empty="No contact linked"
        >
          {contact ? (
            <>
              <Link
                to="/contacts/$contactId"
                params={{ contactId: contact.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {contact.fullName}
              </Link>
              <p className="mt-1 text-sm text-muted-foreground">
                {contact.email || contact.phone || "-"}
              </p>
            </>
          ) : null}
        </AssociationCard>
      </section>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-sm">
      <span className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <span className="truncate">{value}</span>
    </span>
  )
}

function NoteBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="whitespace-pre-wrap border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
      {children}
    </div>
  )
}

function AssociationCard({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode
  title: string
  empty: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
        {icon}
        {title}
      </h3>
      <div className="mt-4 text-sm">{children || empty}</div>
    </section>
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
