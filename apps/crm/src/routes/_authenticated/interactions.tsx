import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { createInteractionFn, getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/interactions")({
  loader: async () => getCrmDataFn(),
  component: InteractionsPage,
})

function InteractionsPage() {
  const { interactions, gyms, contacts } = Route.useLoaderData()
  const router = useRouter()
  const createInteraction = useServerFn(createInteractionFn)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const filteredInteractions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return interactions
    return interactions.filter((interaction) =>
      [
        interaction.title,
        interaction.companyName,
        interaction.contactName,
        interaction.channel,
        interaction.status,
        interaction.notes,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [interactions, query])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await createInteraction({
        data: {
          title: String(form.get("title") ?? ""),
          date: String(form.get("date") ?? ""),
          channel: String(form.get("channel") ?? ""),
          status: String(form.get("status") ?? ""),
          companyId: String(form.get("companyId") ?? ""),
          contactId: String(form.get("contactId") ?? ""),
          notes: String(form.get("notes") ?? ""),
          content: String(form.get("content") ?? ""),
        },
      })
      event.currentTarget.reset()
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Interactions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Track outreach and meeting history against gyms and contacts.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <TextInput name="title" label="Subject" required />
          <TextInput name="date" label="Date" type="date" />
          <SelectInput
            name="channel"
            label="Channel"
            options={["Email", "Call", "Instagram", "In Person", "Demo"]}
          />
          <SelectInput
            name="status"
            label="Status"
            options={["Planned", "Sent", "Completed", "No Response", "Replied"]}
          />
          <label className="space-y-1 text-sm font-medium">
            <span>Gym</span>
            <select
              name="companyId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No gym</option>
              {gyms.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Contact</span>
            <select
              name="contactId"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">No contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.fullName}
                </option>
              ))}
            </select>
          </label>
          <TextInput name="notes" label="Notes" />
          <TextInput name="content" label="Content" />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Adding..." : "Log Interaction"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 rounded-md border border-input px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search interactions"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <Th>Interaction</Th>
              <Th>Date</Th>
              <Th>Gym</Th>
              <Th>Contact</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredInteractions.map((interaction) => (
              <tr
                key={`${interaction.source}-${interaction.id}`}
                className="align-top"
              >
                <Td>
                  <p className="font-medium">{interaction.title}</p>
                  <p className="truncate text-muted-foreground">
                    {interaction.channel || interaction.source}
                  </p>
                </Td>
                <Td>{interaction.date || "-"}</Td>
                <Td>{interaction.companyName || "-"}</Td>
                <Td>{interaction.contactName || "-"}</Td>
                <Td>{interaction.status || "-"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TextInput({
  name,
  label,
  required,
  type = "text",
}: {
  name: string
  label: string
  required?: boolean
  type?: string
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

function SelectInput({
  name,
  label,
  options,
}: {
  name: string
  label: string
  options: string[]
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>
}
