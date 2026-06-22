// @lat: [[crew#Regional Judge Discovery Pilot]]
import { createFileRoute, getRouteApi, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LockKeyhole, MapPin, Search, Send, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { VOLUNTEER_ROLE_LABELS } from "@/db/schemas/volunteers"
import type { CrewRegionalJudgeDiscoveryCandidate } from "@/lib/crew/regional-judge-discovery"
import {
  getCrewRegionalJudgeDiscoveryPageFn,
  requestCrewRegionalJudgeIntroFn,
} from "@/server-fns/crew-discovery-fns"

export const Route = createFileRoute("/events/$eventId/discovery/judges")({
  loader: async ({ params }) =>
    await getCrewRegionalJudgeDiscoveryPageFn({
      data: { eventId: params.eventId },
    }),
  component: RegionalJudgeDiscoveryPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function RegionalJudgeDiscoveryPage() {
  const { eventId } = parentRoute.useParams()
  const { viewModel } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Pilot gate"
          value={viewModel.gate.enabled ? "Enabled" : "Disabled"}
        />
        <Metric
          label="Candidates"
          value={viewModel.summary.candidateCount.toString()}
        />
        <Metric
          label="Pending intros"
          value={viewModel.summary.pendingIntroRequestCount.toString()}
        />
        <Metric
          label="Credentials"
          value={viewModel.summary.safeCredentialCount.toString()}
        />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Regional judge discovery
            </div>
            <h2 className="text-xl font-semibold">
              Opt-in, blind intro requests
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Candidate cards show consented regional facts only. Contact
              details remain hidden.
            </p>
          </div>
          <div className="rounded-md border bg-background p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <LockKeyhole className="size-4 text-muted-foreground" />
              Contact reveal deferred
            </div>
            <p className="mt-2 text-muted-foreground">
              Intro requests create audit records without email, phone, SMS, or
              acceptance delivery.
            </p>
          </div>
        </div>
      </section>

      {!viewModel.gate.enabled ? (
        <DisabledPanel notices={viewModel.notices} />
      ) : viewModel.candidates.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {viewModel.candidates.map((candidate) => (
            <CandidateCard
              candidate={candidate}
              eventId={eventId}
              key={candidate.candidateId}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function CandidateCard({
  candidate,
  eventId,
}: {
  candidate: CrewRegionalJudgeDiscoveryCandidate
  eventId: string
}) {
  const router = useRouter()
  const requestIntro = useServerFn(requestCrewRegionalJudgeIntroFn)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const primaryRole = candidate.roleTypes[0] ?? "judge"

  async function handleRequestIntro() {
    setIsSubmitting(true)
    try {
      const result = await requestIntro({
        data: {
          eventId,
          candidateId: candidate.candidateId,
          requestedRoleType:
            primaryRole === "head_judge" ? primaryRole : "judge",
        },
      })
      toast.success(
        result.request.outcome === "existing"
          ? "Intro request already pending."
          : "Intro request recorded.",
      )
      await router.invalidate().catch(() => undefined)
    } catch {
      toast.error("Intro request could not be recorded. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{candidate.displayLabel}</h3>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" aria-hidden="true" />
            <span>{candidate.regionLabel}</span>
          </div>
        </div>
        <StatusPill
          label={candidate.introRequest ? "Requested" : "Available"}
          tone={candidate.introRequest ? "muted" : "ready"}
        />
      </div>

      <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
        <Fact
          label="Roles"
          value={candidate.roleTypes.map(formatRoleType).join(", ")}
        />
        <Fact label="Availability" value={candidate.availabilitySummary} />
        <Fact
          label="Prior events"
          value={candidate.factualHistory.priorEventCount.toString()}
        />
        <Fact
          label="Confirmed"
          value={candidate.factualHistory.confirmedCount.toString()}
        />
        <Fact
          label="Completed"
          value={candidate.factualHistory.completedCount.toString()}
        />
        <Fact
          label="Last activity"
          value={formatDate(candidate.factualHistory.lastActivityAt)}
        />
      </dl>

      <div className="mt-5 space-y-2">
        <h4 className="text-sm font-medium">Credentials</h4>
        {candidate.credentialSummary.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {candidate.credentialSummary.map((credential) => (
              <span
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground"
                key={`${credential.credentialType}:${credential.credentialLabel}:${credential.status}`}
              >
                {credential.credentialLabel} ·{" "}
                {formatCredentialStatus(credential.status)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No consented credential facts shared.
          </p>
        )}
      </div>

      <Button
        className="mt-5"
        disabled={Boolean(candidate.introRequest) || isSubmitting}
        onClick={handleRequestIntro}
        type="button"
      >
        <Send className="size-4" aria-hidden="true" />
        {candidate.introRequest
          ? "Intro request pending"
          : isSubmitting
            ? "Recording..."
            : "Request intro"}
      </Button>
    </article>
  )
}

function DisabledPanel({ notices }: { notices: string[] }) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Pilot disabled</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function EmptyState() {
  return (
    <section className="rounded-md border bg-card p-8 text-center shadow-sm">
      <Search className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">No eligible regional judges</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        No adult, opted-in judges with consented regional facts are available
        for blind intro requests.
      </p>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: "ready" | "muted"
}) {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium ${
        tone === "ready"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : "border-muted bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  )
}

function formatRoleType(roleType: string) {
  return (
    VOLUNTEER_ROLE_LABELS[roleType as keyof typeof VOLUNTEER_ROLE_LABELS] ??
    roleType
  )
}

function formatCredentialStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function formatDate(value: string | null) {
  if (!value) return "Not shared"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not shared"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}
