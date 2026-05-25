import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Plus, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { createGymFn, getCrmDataFn } from "@/server-fns/crm"

export const Route = createFileRoute("/_authenticated/gyms")({
  loader: async () => getCrmDataFn(),
  component: GymsPage,
})

function GymsPage() {
  const { gyms } = Route.useLoaderData()
  const location = useLocation()
  const router = useRouter()
  const createGym = useServerFn(createGymFn)
  const [query, setQuery] = useState("")
  const [saving, setSaving] = useState(false)

  const filteredGyms = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return gyms
    return gyms.filter((gym) =>
      [
        gym.name,
        gym.location,
        gym.ownerManager,
        gym.status,
        gym.relationship,
        gym.crossfitPage,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [gyms, query])

  if (location.pathname !== "/gyms") {
    return <Outlet />
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSaving(true)
    try {
      await createGym({
        data: {
          name: String(form.get("name") ?? ""),
          location: String(form.get("location") ?? ""),
          website: String(form.get("website") ?? ""),
          crossfitPage: String(form.get("crossfitPage") ?? ""),
          email: String(form.get("email") ?? ""),
          phone: String(form.get("phone") ?? ""),
          instagram: String(form.get("instagram") ?? ""),
          ownerManager: String(form.get("ownerManager") ?? ""),
          status: String(form.get("status") ?? ""),
          priority: String(form.get("priority") ?? ""),
          relationship: String(form.get("relationship") ?? ""),
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
      <PageHeader
        title="Gyms"
        description="Manage the Company entries that represent gym prospects and customers."
      />

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <TextInput name="name" label="Gym" required />
          <TextInput name="location" label="Location" />
          <TextInput name="ownerManager" label="Owner / Manager" />
          <TextInput name="relationship" label="Relationship" />
          <TextInput name="website" label="Website" />
          <TextInput name="crossfitPage" label="CrossFit Page" />
          <TextInput name="email" label="Email" />
          <TextInput name="phone" label="Phone" />
          <TextInput name="instagram" label="Instagram" />
          <SelectInput
            name="status"
            label="Status"
            options={["Prospect", "Outreach Sent", "Demo", "Customer"]}
          />
          <SelectInput
            name="priority"
            label="Priority"
            options={["HIGH", "MED", "LOW"]}
          />
          <div className="md:col-span-2">
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
            {saving ? "Adding..." : "Add Gym"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 rounded-md border border-input px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search gyms"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <Th>Gym</Th>
              <Th>Location</Th>
              <Th>Status</Th>
              <Th>Owner</Th>
              <Th>Contact</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredGyms.map((gym) => (
              <tr key={gym.id} className="align-top">
                <Td>
                  <Link
                    to="/gyms/$gymId"
                    params={{ gymId: gym.id }}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {gym.name}
                  </Link>
                  <p className="truncate text-muted-foreground">
                    {gym.website ||
                      gym.crossfitPage ||
                      gym.instagram ||
                      "No web presence saved"}
                  </p>
                </Td>
                <Td>{gym.location || "-"}</Td>
                <Td>{gym.status || "Prospect"}</Td>
                <Td>{gym.ownerManager || "-"}</Td>
                <Td>
                  <p>{gym.email || "-"}</p>
                  <p className="text-muted-foreground">{gym.phone}</p>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PageHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
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
