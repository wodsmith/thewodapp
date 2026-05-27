import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  CalendarDays,
  Check,
  Clipboard,
  Mail,
  Megaphone,
  Plus,
  Send,
  UsersRound,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { createCampaignTouchFn, getCrmDataFn } from "@/server-fns/crm"

const TOUCH_CHANNEL_OPTIONS = ["Email", "Instagram", "Facebook", "LinkedIn"]
const TOUCH_STATUS_OPTIONS = ["Planned", "Drafted", "Sent", "Posted"]
const OWNER_OPTIONS = ["Ian", "Zac"]

export const Route = createFileRoute("/_authenticated/campaigns/$campaignId")({
  loader: async ({ params }) => {
    const data = await getCrmDataFn()
    const campaign = data.campaigns.find(
      (item) => item.id === params.campaignId,
    )
    if (!campaign) throw notFound()

    const audienceGyms = data.gyms.filter((gym) =>
      campaign.audienceGymIds.includes(gym.id),
    )
    const audienceContacts = data.contacts.filter((contact) =>
      campaign.audienceContactIds.includes(contact.id),
    )
    const audienceGymIds = new Set(audienceGyms.map((gym) => gym.id))
    const campaignTouches = data.campaignTouches
      .filter((touch) => touch.campaignId === campaign.id)
      .sort((a, b) => touchDateValue(a.date) - touchDateValue(b.date))

    return {
      campaign,
      audienceGyms,
      audienceContacts,
      campaignTouches,
      relatedContacts: data.contacts.filter(
        (contact) =>
          campaign.audienceContactIds.includes(contact.id) ||
          (contact.companyId ? audienceGymIds.has(contact.companyId) : false),
      ),
    }
  },
  notFoundComponent: () => <EntityNotFound label="Campaign" />,
  component: CampaignDetailPage,
})

function CampaignDetailPage() {
  const {
    campaign,
    audienceGyms,
    audienceContacts,
    campaignTouches,
    relatedContacts,
  } = Route.useLoaderData()
  const location = useLocation()
  const router = useRouter()
  const createCampaignTouch = useServerFn(createCampaignTouchFn)
  const [saving, setSaving] = useState(false)
  const [channel, setChannel] = useState("Email")
  const [selectedSourceId, setSelectedSourceId] = useState(
    audienceContacts[0]?.id ?? audienceGyms[0]?.id ?? "",
  )
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const sources = useMemo(
    () => [
      ...audienceContacts.map((contact) => ({
        id: contact.id,
        type: "contact" as const,
        label: contact.fullName,
        companyId: contact.companyId,
        companyName: contact.companyName,
        email: contact.email,
      })),
      ...audienceGyms.map((gym) => ({
        id: gym.id,
        type: "gym" as const,
        label: gym.name,
        companyId: gym.id,
        companyName: gym.name,
        email: gym.email,
      })),
    ],
    [audienceContacts, audienceGyms],
  )
  const selectedSource = sources.find(
    (source) => source.id === selectedSourceId,
  )
  const template = buildTemplate({
    channel,
    campaignName: campaign.name,
    campaignGoal: campaign.goal,
    source: selectedSource,
  })

  useEffect(() => {
    if (
      selectedSourceId &&
      sources.some((source) => source.id === selectedSourceId)
    ) {
      return
    }
    setSelectedSourceId(sources[0]?.id ?? "")
  }, [selectedSourceId, sources])

  if (location.pathname !== `/campaigns/${campaign.id}`) {
    return <Outlet />
  }

  async function handleTouchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const source = sources.find(
      (item) => item.id === String(form.get("sourceId") ?? ""),
    )
    setSaving(true)
    try {
      await createCampaignTouch({
        data: {
          campaignId: campaign.id,
          title: String(form.get("title") ?? ""),
          channel: String(form.get("channel") ?? ""),
          owner: String(form.get("owner") ?? "Ian") as "Ian" | "Zac",
          status: String(form.get("status") ?? ""),
          dueDate: String(form.get("dueDate") ?? ""),
          companyId: source?.companyId ?? "",
          contactId: source?.type === "contact" ? source.id : "",
          notes: String(form.get("notes") ?? ""),
          content: template.body,
        },
      })
      event.currentTarget.reset()
      setSelectedSourceId(sources[0]?.id ?? "")
      await router.invalidate()
    } finally {
      setSaving(false)
    }
  }

  async function copyTemplate(key: string, value: string) {
    await navigator.clipboard.writeText(value)
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(null), 1400)
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="h-4 w-4" />
            Campaign
          </div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {campaign.name}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge value={campaign.status || "Planning"} />
            <Badge value={campaign.owner || "Ian"} />
            <span>{formatRange(campaign.startDate, campaign.endDate)}</span>
          </div>
        </div>
        <Link
          to="/campaigns/$campaignId/audience"
          params={{ campaignId: campaign.id }}
          className="inline-flex h-10 items-center justify-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Build Audience
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={<UsersRound className="h-5 w-5" />}
          label="Gyms"
          value={audienceGyms.length}
        />
        <Metric
          icon={<UsersRound className="h-5 w-5" />}
          label="Contacts"
          value={audienceContacts.length}
        />
        <Metric
          icon={<CalendarDays className="h-5 w-5" />}
          label="Scheduled"
          value={campaignTouches.length}
        />
      </div>

      {campaign.goal ? (
        <section className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          {campaign.goal}
        </section>
      ) : null}

      <form
        onSubmit={handleTouchSubmit}
        className="rounded-lg border border-border p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-medium">Schedule an Interaction</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <SelectInput
            name="sourceId"
            label="Source"
            value={selectedSourceId}
            onChange={setSelectedSourceId}
            options={sources.map((source) => source.label)}
            optionValues={sources.map((source) => source.id)}
          />
          <TextInput
            name="title"
            label="Touch"
            defaultValue={`${channel}: ${campaign.name}`}
            required
          />
          <SelectInput
            name="channel"
            label="Channel"
            value={channel}
            onChange={setChannel}
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
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {saving ? "Scheduling..." : "Schedule Interaction"}
          </button>
        </div>
      </form>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">Scheduled Interactions</h3>
          </div>
          <div className="divide-y divide-border">
            {campaignTouches.length > 0 ? (
              campaignTouches.map((touch) => (
                <div
                  key={touch.id}
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_120px_120px]"
                >
                  <Link
                    to="/interactions/$interactionId"
                    params={{ interactionId: touch.id }}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {touch.title}
                  </Link>
                  <span className="text-muted-foreground">
                    {touch.date || "-"}
                  </span>
                  <span className="text-muted-foreground">
                    {touch.status || "-"}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                No interactions scheduled for this campaign yet.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-medium">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">
                {selectedSource?.label ?? "Choose a source"} template
              </p>
            </div>
            <Mail className="h-5 w-5 text-muted-foreground" />
          </div>
          {channel === "Email" ? (
            <div className="mb-3 rounded-md bg-secondary px-3 py-2 text-sm">
              <span className="font-medium">Subject:</span> {template.subject}
            </div>
          ) : null}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-sm">
            {template.body}
          </pre>
          <div className="mt-3 flex flex-wrap gap-2">
            {channel === "Email" ? (
              <CopyButton
                copied={copiedKey === "subject"}
                onClick={() => copyTemplate("subject", template.subject)}
              >
                Subject
              </CopyButton>
            ) : null}
            <CopyButton
              copied={copiedKey === "body"}
              onClick={() => copyTemplate("body", template.body)}
            >
              Body
            </CopyButton>
          </div>
        </div>
      </section>

      <RelatedSection title="Audience Sources">
        {[...relatedContacts, ...audienceGyms].map((item) => (
          <RelatedRow key={item.id}>
            {"fullName" in item ? (
              <Link
                to="/contacts/$contactId"
                params={{ contactId: item.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.fullName}
              </Link>
            ) : (
              <Link
                to="/gyms/$gymId"
                params={{ gymId: item.id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {item.name}
              </Link>
            )}
            <span>
              {"companyName" in item ? item.companyName || "Contact" : "Gym"}
            </span>
            <span>{"email" in item ? item.email || "-" : "-"}</span>
          </RelatedRow>
        ))}
      </RelatedSection>
    </section>
  )
}

function buildTemplate({
  channel,
  campaignName,
  campaignGoal,
  source,
}: {
  channel: string
  campaignName: string
  campaignGoal: string | null
  source:
    | {
        type: "contact" | "gym"
        label: string
        companyName: string | null
      }
    | undefined
}) {
  const firstName = source?.label.split(" ")[0] ?? "there"
  const gymName = source?.companyName ?? source?.label ?? "your gym"
  const goalLine = campaignGoal ? `\n\nContext: ${campaignGoal}` : ""

  if (channel === "Email") {
    return {
      subject: `${campaignName} for ${gymName}`,
      body: `Hey ${firstName},\n\nI wanted to reach out about ${campaignName}. I think it could be a strong fit for ${gymName} and wanted to see if it is worth a quick conversation.${goalLine}\n\nWould you be open to taking a look?\n\nIan`,
    }
  }

  return {
    subject: campaignName,
    body: `Hey ${firstName}, wanted to share ${campaignName} with ${gymName}. I think it could be a good fit. Open to a quick chat?`,
  }
}

function touchDateValue(date: string | null) {
  if (!date) return Number.MAX_SAFE_INTEGER
  const value = new Date(date).getTime()
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value
}

function formatRange(startDate: string | null, endDate: string | null) {
  if (startDate && endDate) return `${startDate} to ${endDate}`
  return startDate ?? endDate ?? "No dates"
}

function Badge({ value }: { value: string | null }) {
  if (!value) return null
  return (
    <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
      {value}
    </span>
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
      <div className="mb-2 text-muted-foreground">{icon}</div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

function TextInput({
  name,
  label,
  required,
  type = "text",
  defaultValue,
}: {
  name: string
  label: string
  required?: boolean
  type?: string
  defaultValue?: string
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <input
        name={name}
        required={required}
        type={type}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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
  value,
  onChange,
}: {
  name: string
  label: string
  options: string[]
  optionValues?: string[]
  required?: boolean
  value?: string
  onChange?: (value: string) => void
}) {
  return (
    <label className="space-y-1 text-sm font-medium">
      <span>{label}</span>
      <select
        name={name}
        required={required}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
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

function CopyButton({
  children,
  copied,
  onClick,
}: {
  children: React.ReactNode
  copied: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <Clipboard className="h-4 w-4" />
      )}
      {copied ? "Copied" : `Copy ${children}`}
    </button>
  )
}

function RelatedSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium">{title}</h3>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  )
}

function RelatedRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[1fr_160px_220px]">
      {children}
    </div>
  )
}

function EntityNotFound({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-border p-6">
      <h2 className="text-xl font-semibold">{label} not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        The record may have been deleted or moved.
      </p>
    </section>
  )
}
