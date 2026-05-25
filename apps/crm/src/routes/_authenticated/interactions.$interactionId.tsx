import { createFileRoute, Link, notFound } from "@tanstack/react-router"
import {
  Building2,
  CalendarDays,
  Clock3,
  Handshake,
  Send,
  UserRound,
} from "lucide-react"
import { getCrmDataFn } from "@/server-fns/crm"
import { EntityDocumentPanel } from "@/components/entity-document-panel"

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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <MetaInline
            icon={<CalendarDays className="h-4 w-4" aria-hidden="true" />}
            value={interaction.date}
            label="Date"
          />
          <Badge value={interaction.channel} />
          <Badge value={interaction.status} />
        </div>
      </header>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
          <MetaItem
            icon={<Building2 className="h-4 w-4" aria-hidden="true" />}
            value={interaction.companyName}
            label="Gym"
          />
          <MetaItem
            icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
            value={interaction.contactName}
            label="Contact"
          />
          <MetaItem
            icon={<Send className="h-4 w-4" aria-hidden="true" />}
            value={interaction.channel}
            label="Channel"
          />
          <MetaItem
            icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
            value={interaction.updatedAt}
            label="Updated"
          />
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

      <EntityDocumentPanel
        entryId={interaction.id}
        label={interaction.title || interaction.source}
      />
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

function MetaInline({
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
      className="inline-flex min-w-0 items-center gap-1.5"
    >
      {icon}
      <span className="truncate">{value}</span>
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
