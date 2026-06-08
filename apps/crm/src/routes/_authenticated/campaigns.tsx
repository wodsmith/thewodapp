import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { CalendarDays, Mail, Megaphone, Plus, Search, Send } from "lucide-react"
import { useMemo, useState } from "react"
import { MetricCard } from "@/components/metric-card"
import {
  createCampaignFn,
  createCampaignTouchFn,
  getCrmDataFn,
} from "@/server-fns/crm"

const CAMPAIGN_STATUS_OPTIONS = ["Planning", "Active", "Paused", "Completed"]
const TOUCH_CHANNEL_OPTIONS = [
  "Email",
  "Instagram",
  "Facebook",
  "LinkedIn",
  "Call",
  "Other",
]
const TOUCH_STATUS_OPTIONS = [
  "Planned",
  "Drafted",
  "Sent",
  "Posted",
  "Completed",
  "Skipped",
]
const OWNER_OPTIONS = ["Ian", "Zac"]
const UPCOMING_TOUCH_STATUSES = new Set(["Planned", "Drafted", "Follow Up"])

// `@lat`: [[crm-campaigns]]
export const Route = createFileRoute("/_authenticated/campaigns")({
  // `@lat`: [[crm-campaigns]]
  loader: async () => getCrmDataFn(),
  component: CampaignsPage,
})

function CampaignsPage() {
  const { campaigns, campaignTouches } = Route.useLoaderData()
  const location = useLocation()
  const router = useRouter()
  const createCampaign = useServerFn(createCampaignFn)
  const createCampaignTouch = useServerFn(createCampaignTouchFn)
  const [query, setQuery] = useState("")
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [savingTouch, setSavingTouch] = useState(false)

  const filteredCampaigns = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return campaigns
    return campaigns.filter((campaign) =>
      [
        campaign.name,
        campaign.status,
        campaign.owner,
        campaign.goal,
        ...campaign.audienceGymNames,
        ...campaign.audienceContactNames,
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalized)),
    )
  }, [campaigns, query])

  // `@lat`: [[crm-campaigns]]
  const nextTouches = [...campaignTouches]
    .filter((touch) =>
      touch.status ? UPCOMING_TOUCH_STATUSES.has(touch.status) : true,
    )
    .sort((a, b) => touchDateValue(a.date) - touchDateValue(b.date))
    .slice(0, 8)

  // `@lat`: [[crm-campaigns]]
  if (location.pathname !== "/campaigns") {
    return <Outlet />
  }

  // `@lat`: [[crm-campaigns]]
  async function handleCampaignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSavingCampaign(true)
    try {
      await createCampaign({
        data: {
          name: String(form.get("name") ?? ""),
          status: String(form.get("status") ?? ""),
          owner: String(form.get("owner") ?? "Ian") as "Ian" | "Zac",
          goal: String(form.get("goal") ?? ""),
          startDate: String(form.get("startDate") ?? ""),
          endDate: String(form.get("endDate") ?? ""),
          audienceGymIds: form.getAll("audienceGymIds").map(String),
          audienceContactIds: form.getAll("audienceContactIds").map(String),
        },
      })
      event.currentTarget.reset()
      await router.invalidate()
    } finally {
      setSavingCampaign(false)
    }
  }

  // `@lat`: [[crm-campaigns]]
  async function handleTouchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSavingTouch(true)
    try {
      await createCampaignTouch({
        data: {
          campaignId: String(form.get("campaignId") ?? ""),
          title: String(form.get("title") ?? ""),
          channel: String(form.get("channel") ?? ""),
          owner: String(form.get("owner") ?? "Ian") as "Ian" | "Zac",
          status: String(form.get("status") ?? ""),
          dueDate: String(form.get("dueDate") ?? ""),
          notes: String(form.get("notes") ?? ""),
        },
      })
      event.currentTarget.reset()
      await router.invalidate()
    } finally {
      setSavingTouch(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Campaigns</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan manual marketing pushes with a goal, selected gym/contact
          audience, and email or social interactions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={<Megaphone className="h-5 w-5" />}
          label="Campaigns"
          value={campaigns.length}
        />
        <MetricCard
          icon={<Send className="h-5 w-5" />}
          label="Campaign interactions"
          value={campaignTouches.length}
        />
        <MetricCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Next up"
          value={nextTouches.length}
        />
      </div>

      <form
        onSubmit={handleCampaignSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <TextInput name="name" label="Campaign" required />
          <SelectInput
            name="status"
            label="Status"
            options={CAMPAIGN_STATUS_OPTIONS}
          />
          <SelectInput name="owner" label="Owner" options={OWNER_OPTIONS} />
          <TextInput name="startDate" label="Start" type="date" />
          <TextInput name="endDate" label="End" type="date" />
          <div className="md:col-span-3">
            <TextArea name="goal" label="Goal" required />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={savingCampaign}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {savingCampaign ? "Creating..." : "Create campaign"}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleTouchSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 md:grid-cols-4">
          <SelectInput
            name="campaignId"
            label="Campaign"
            options={campaigns.map((campaign) => campaign.name)}
            optionValues={campaigns.map((campaign) => campaign.id)}
            required
          />
          <TextInput name="title" label="Touch" required />
          <SelectInput
            name="channel"
            label="Channel"
            options={TOUCH_CHANNEL_OPTIONS}
          />
          <SelectInput
            name="status"
            label="Status"
            options={TOUCH_STATUS_OPTIONS}
          />
          <SelectInput name="owner" label="Owner" options={OWNER_OPTIONS} />
          <TextInput name="dueDate" label="Due" type="date" />
          <div className="md:col-span-2">
            <TextInput name="notes" label="Notes" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={savingTouch || campaigns.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            {savingTouch ? "Adding..." : "Add interaction"}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 rounded-md border border-input px-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search campaigns"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <Th>Campaign</Th>
              <Th>Owner</Th>
              <Th>Audience</Th>
              <Th>Interactions</Th>
              <Th>Goal</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredCampaigns.map((campaign) => (
              <tr key={campaign.id} className="align-top">
                <Td>
                  {/* `@lat`: [[crm-campaigns]] */}
                  <Link
                    to="/campaigns/$campaignId"
                    params={{ campaignId: campaign.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <p className="text-muted-foreground">
                    {campaign.status || "Planning"}
                  </p>
                </Td>
                <Td>{campaign.owner || "Ian"}</Td>
                <Td>
                  <p>{campaign.audienceGymIds.length} gyms</p>
                  <p className="text-muted-foreground">
                    {campaign.audienceContactIds.length} contacts
                  </p>
                  {/* `@lat`: [[crm-campaigns]] */}
                  <Link
                    to="/campaigns/$campaignId/audience"
                    params={{ campaignId: campaign.id }}
                    className="mt-1 inline-flex text-xs font-medium underline-offset-4 hover:underline"
                  >
                    Build audience
                  </Link>
                </Td>
                <Td>{campaign.touchCount}</Td>
                <Td>
                  <p className="line-clamp-2 text-muted-foreground">
                    {campaign.goal || "-"}
                  </p>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {nextTouches.length > 0 ? (
        <section className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">Upcoming Campaign Interactions</h3>
          </div>
          <div className="divide-y divide-border">
            {nextTouches.map((touch) => (
              <div
                key={touch.id}
                className="flex items-start justify-between gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{touch.title}</p>
                  <p className="text-muted-foreground">
                    {[touch.campaignName, touch.channel, touch.owner]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                </div>
                <span className="whitespace-nowrap text-muted-foreground">
                  {touch.date || touch.status || "Planned"}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  )
}

function touchDateValue(date: string | null) {
  if (!date) return Number.MAX_SAFE_INTEGER
  const value = new Date(date).getTime()
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
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
        required={required}
        type={type}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

function TextArea({
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
      <textarea
        name={name}
        required={required}
        rows={3}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  )
}

function SelectInput({
  name,
  label,
  options,
  optionValues,
  required,
}: {
  name: string
  label: string
  options: string[]
  optionValues?: string[]
  required?: boolean
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        required={required}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Choose...</option>
        {options.map((option, index) => (
          <option
            key={optionValues?.[index] ?? option}
            value={optionValues?.[index] ?? option}
          >
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
