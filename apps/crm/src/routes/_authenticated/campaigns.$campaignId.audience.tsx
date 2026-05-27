// `@lat`: [[crm-campaigns]]
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
} from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
  Building2,
  Check,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"
import { useMemo, useState } from "react"
import {
  type CrmContact,
  type CrmGym,
  getCrmDataFn,
  updateCampaignAudienceFn,
} from "@/server-fns/crm"

type AudienceCandidate =
  | { type: "gym"; item: CrmGym }
  | { type: "contact"; item: CrmContact }

type CandidateType = "all" | "gyms" | "contacts"

// `@lat`: [[crm-campaigns]]
export const Route = createFileRoute(
  "/_authenticated/campaigns/$campaignId/audience",
)({
  loader: async ({ params }) => {
    const data = await getCrmDataFn()
    const campaign = data.campaigns.find(
      (item) => item.id === params.campaignId,
    )
    if (!campaign) throw notFound()

    return {
      campaign,
      gyms: data.gyms,
      contacts: data.contacts,
    }
  },
  notFoundComponent: () => <EntityNotFound label="Campaign" />,
  component: CampaignAudienceBuilderPage,
})

function CampaignAudienceBuilderPage() {
  const { campaign, gyms, contacts } = Route.useLoaderData()
  const router = useRouter()
  const updateCampaignAudience = useServerFn(updateCampaignAudienceFn)
  const [query, setQuery] = useState("")
  const [candidateType, setCandidateType] = useState<CandidateType>("all")
  const [statusFilter, setStatusFilter] = useState("")
  const [selectedGymIds, setSelectedGymIds] = useState(campaign.audienceGymIds)
  const [selectedContactIds, setSelectedContactIds] = useState(
    campaign.audienceContactIds,
  )
  const [activeCandidateKey, setActiveCandidateKey] = useState<string | null>(
    selectedContactIds[0]
      ? `contact:${selectedContactIds[0]}`
      : selectedGymIds[0]
        ? `gym:${selectedGymIds[0]}`
        : null,
  )
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const selectedGymSet = new Set(selectedGymIds)
  const selectedContactSet = new Set(selectedContactIds)
  const candidates = useMemo<AudienceCandidate[]>(
    () => [
      ...gyms.map((item) => ({ type: "gym" as const, item })),
      ...contacts.map((item) => ({ type: "contact" as const, item })),
    ],
    [gyms, contacts],
  )
  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(
          candidates
            .map((candidate) => candidate.item.status)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [candidates],
  )
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return candidates.filter((candidate) => {
      if (candidateType === "gyms" && candidate.type !== "gym") return false
      if (candidateType === "contacts" && candidate.type !== "contact") {
        return false
      }
      if (statusFilter && candidate.item.status !== statusFilter) return false
      if (!normalized) return true
      return candidateSearchText(candidate).includes(normalized)
    })
  }, [candidates, candidateType, query, statusFilter])
  const selectedGyms = gyms.filter((gym) => selectedGymSet.has(gym.id))
  const selectedContacts = contacts.filter((contact) =>
    selectedContactSet.has(contact.id),
  )
  const activeCandidate =
    filteredCandidates.find(
      (candidate) => candidateKey(candidate) === activeCandidateKey,
    ) ?? filteredCandidates[0]

  function toggleCandidate(candidate: AudienceCandidate) {
    if (candidate.type === "gym") {
      setSelectedGymIds((current) =>
        current.includes(candidate.item.id)
          ? current.filter((id) => id !== candidate.item.id)
          : [...current, candidate.item.id],
      )
      return
    }

    setSelectedContactIds((current) =>
      current.includes(candidate.item.id)
        ? current.filter((id) => id !== candidate.item.id)
        : [...current, candidate.item.id],
    )
  }

  async function handleSave() {
    setErrorMessage(null)
    setSaving(true)
    try {
      await updateCampaignAudience({
        data: {
          campaignId: campaign.id,
          audienceGymIds: selectedGymIds,
          audienceContactIds: selectedContactIds,
        },
      })
      await router.invalidate()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Audience could not be saved.",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            Audience Builder
          </div>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {campaign.name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedGyms.length} gyms and {selectedContacts.length} contacts
            selected.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/campaigns/$campaignId"
            params={{ campaignId: campaign.id }}
            className="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
          >
            Campaign
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {saving ? "Saving..." : "Save Audience"}
          </button>
        </div>
      </header>
      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
              <div className="flex h-10 items-center gap-2 rounded-md border border-input px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search names, locations, emails, notes"
                  className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <select
                value={candidateType}
                onChange={(event) =>
                  setCandidateType(event.target.value as CandidateType)
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">Gyms and contacts</option>
                <option value="gyms">Gyms only</option>
                <option value="contacts">Contacts only</option>
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any status</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
              {filteredCandidates.length} matches
            </div>
            <div className="max-h-[min(760px,calc(100vh-22rem))] divide-y divide-border overflow-y-auto">
              {filteredCandidates.map((candidate) => {
                const selected = isSelected({
                  candidate,
                  selectedGymSet,
                  selectedContactSet,
                })
                return (
                  <button
                    key={candidateKey(candidate)}
                    type="button"
                    onClick={() =>
                      setActiveCandidateKey(candidateKey(candidate))
                    }
                    className="grid w-full gap-3 px-4 py-3 text-left text-sm hover:bg-accent md:grid-cols-[32px_1fr_120px]"
                  >
                    <span className="mt-1 text-muted-foreground">
                      {candidate.type === "gym" ? (
                        <Building2 className="h-4 w-4" />
                      ) : (
                        <UserRound className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {candidateLabel(candidate)}
                      </span>
                      <span className="block truncate text-muted-foreground">
                        {candidateDescription(candidate)}
                      </span>
                    </span>
                    <span
                      className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {selected ? "Selected" : "Preview"}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4">
          <CandidatePanel
            candidate={activeCandidate}
            selected={
              activeCandidate
                ? isSelected({
                    candidate: activeCandidate,
                    selectedGymSet,
                    selectedContactSet,
                  })
                : false
            }
            onToggle={() => activeCandidate && toggleCandidate(activeCandidate)}
          />
          <SelectedAudience
            gyms={selectedGyms}
            contacts={selectedContacts}
            onRemoveGym={(id) =>
              setSelectedGymIds((current) =>
                current.filter((item) => item !== id),
              )
            }
            onRemoveContact={(id) =>
              setSelectedContactIds((current) =>
                current.filter((item) => item !== id),
              )
            }
          />
        </aside>
      </section>
    </section>
  )
}

function CandidatePanel({
  candidate,
  selected,
  onToggle,
}: {
  candidate: AudienceCandidate | undefined
  selected: boolean
  onToggle: () => void
}) {
  if (!candidate) {
    return (
      <section className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        Select a gym or contact to preview details.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">
            {candidate.type}
          </p>
          <h3 className="mt-1 text-lg font-semibold">
            {candidateLabel(candidate)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {candidateDescription(candidate)}
          </p>
        </div>
        {candidate.type === "gym" ? (
          <Building2 className="h-5 w-5 text-muted-foreground" />
        ) : (
          <UserRound className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="space-y-2 text-sm">
        {candidateDetails(candidate).map(([label, value]) =>
          value ? (
            <div key={label} className="grid grid-cols-[110px_1fr] gap-3">
              <span className="text-muted-foreground">{label}</span>
              <span className="min-w-0 break-words">{value}</span>
            </div>
          ) : null,
        )}
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium ${
          selected
            ? "border border-input bg-background hover:bg-accent"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {selected ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {selected ? "Remove from Audience" : "Add to Audience"}
      </button>
    </section>
  )
}

function SelectedAudience({
  gyms,
  contacts,
  onRemoveGym,
  onRemoveContact,
}: {
  gyms: CrmGym[]
  contacts: CrmContact[]
  onRemoveGym: (id: string) => void
  onRemoveContact: (id: string) => void
}) {
  return (
    <section className="rounded-lg border border-border">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-medium">Selected Audience</h3>
      </div>
      <div className="max-h-80 divide-y divide-border overflow-auto">
        {[
          ...gyms.map((item) => ({ type: "gym" as const, item })),
          ...contacts.map((item) => ({ type: "contact" as const, item })),
        ].map((candidate) => (
          <div
            key={candidateKey(candidate)}
            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">
                {candidateLabel(candidate)}
              </p>
              <p className="truncate text-muted-foreground">
                {candidate.type === "gym" ? "Gym" : "Contact"}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                candidate.type === "gym"
                  ? onRemoveGym(candidate.item.id)
                  : onRemoveContact(candidate.item.id)
              }
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-accent"
              aria-label={`Remove ${candidateLabel(candidate)}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {gyms.length === 0 && contacts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No audience selected yet.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function candidateKey(candidate: AudienceCandidate) {
  return `${candidate.type}:${candidate.item.id}`
}

function candidateLabel(candidate: AudienceCandidate) {
  return candidate.type === "gym"
    ? candidate.item.name
    : candidate.item.fullName
}

function candidateDescription(candidate: AudienceCandidate) {
  if (candidate.type === "gym") {
    return [
      candidate.item.location,
      candidate.item.status,
      candidate.item.priority,
    ]
      .filter(Boolean)
      .join(" / ")
  }
  return [
    candidate.item.companyName,
    candidate.item.email,
    candidate.item.status,
  ]
    .filter(Boolean)
    .join(" / ")
}

function candidateSearchText(candidate: AudienceCandidate) {
  return [
    candidateLabel(candidate),
    candidateDescription(candidate),
    ...candidateDetails(candidate).map(([, value]) => value),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function candidateDetails(
  candidate: AudienceCandidate,
): Array<[string, string | null]> {
  if (candidate.type === "gym") {
    return [
      ["Location", candidate.item.location],
      ["Status", candidate.item.status],
      ["Priority", candidate.item.priority],
      ["Relationship", candidate.item.relationship],
      ["Owner", candidate.item.ownerManager],
      ["Email", candidate.item.email],
      ["Phone", candidate.item.phone],
      ["Website", candidate.item.website],
      ["Instagram", candidate.item.instagram],
      ["Last Contacted", candidate.item.lastContacted],
      ["Notes", candidate.item.notes],
    ]
  }

  return [
    ["Company", candidate.item.companyName],
    ["Status", candidate.item.status],
    ["Email", candidate.item.email],
    ["Phone", candidate.item.phone],
    ["Notes", candidate.item.notes],
  ]
}

function isSelected({
  candidate,
  selectedGymSet,
  selectedContactSet,
}: {
  candidate: AudienceCandidate
  selectedGymSet: Set<string>
  selectedContactSet: Set<string>
}) {
  return candidate.type === "gym"
    ? selectedGymSet.has(candidate.item.id)
    : selectedContactSet.has(candidate.item.id)
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
