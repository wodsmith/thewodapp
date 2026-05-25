import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { createContactFn, getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/contacts")({
  loader: async () => getCrmDataFn(),
  component: ContactsPage,
})

function ContactsPage() {
  const { contacts, gyms } = Route.useLoaderData()
  const router = useRouter()
  const createContact = useServerFn(createContactFn)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const filteredContacts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return contacts
    return contacts.filter((contact) =>
      [contact.fullName, contact.email, contact.phone, contact.companyName]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [contacts, query])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await createContact({
        data: {
          fullName: String(form.get("fullName") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          status: String(form.get("status") ?? ""),
          companyId: String(form.get("companyId") ?? ""),
          notes: String(form.get("notes") ?? ""),
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
        <h2 className="text-2xl font-semibold tracking-tight">Contacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage People entries and connect them to gym Company entries.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <TextInput name="fullName" label="Name" required />
          <TextInput name="email" label="Email" />
          <TextInput name="phone" label="Phone" />
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
          <SelectInput
            name="status"
            label="Status"
            options={["Lead", "Contacted", "Qualified", "Customer"]}
          />
          <div className="md:col-span-3">
            <TextInput name="notes" label="Notes" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Adding..." : "Add Contact"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 rounded-md border border-input px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search contacts"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <Th>Contact</Th>
              <Th>Gym</Th>
              <Th>Status</Th>
              <Th>Phone</Th>
              <Th>Notes</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredContacts.map((contact) => (
              <tr key={contact.id} className="align-top">
                <Td>
                  <p className="font-medium">{contact.fullName}</p>
                  <p className="truncate text-muted-foreground">
                    {contact.email || "No email"}
                  </p>
                </Td>
                <Td>{contact.companyName || "-"}</Td>
                <Td>{contact.status || "Lead"}</Td>
                <Td>{contact.phone || "-"}</Td>
                <Td>
                  <p className="line-clamp-2 text-muted-foreground">
                    {contact.notes || "-"}
                  </p>
                </Td>
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
}: {
  name: string
  label: string
  required?: boolean
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        name={name}
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
