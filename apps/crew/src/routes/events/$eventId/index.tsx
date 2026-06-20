// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Staffing Page Gap Report]]
// @lat: [[crew#Day Of Operations Board]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { formatCrewValue, getSafeHttpUrl } from "@/lib/crew-event-display"
import {
  calculateSetupProgress,
  crewSetupChecklistItems,
  parseCrewSettings,
} from "@/lib/crew-event-setup"
import { getCrewEventRosterShiftSummaryFn } from "@/server-fns/crew-roster-shift-fns"

export const Route = createFileRoute("/events/$eventId/")({
  loader: async ({ params }) =>
    await getCrewEventRosterShiftSummaryFn({
      data: { eventId: params.eventId },
    }),
  component: EventOverviewPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventOverviewPage() {
  const { eventId } = parentRoute.useParams()
  const { event } = parentRoute.useLoaderData()
  const { rosterSummary, shiftSummary } = Route.useLoaderData()
  const parsedSettings = parseCrewSettings(event.settings.settings)
  const setupProgress = calculateSetupProgress(parsedSettings.setup)

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-7">
        <StatusPanel
          label="Lifecycle"
          value={formatCrewValue(event.settings.lifecycle)}
        />
        <StatusPanel
          label="Concierge"
          value={formatCrewValue(event.settings.conciergeStatus)}
        />
        <StatusPanel
          label="Plan"
          value={formatCrewValue(event.settings.crewPlan)}
        />
        <StatusPanel
          label="Setup"
          value={`${setupProgress.completed}/${setupProgress.total}`}
        />
        <StatusPanel label="Roster" value={rosterSummary.total.toString()} />
        <StatusPanel
          label="Shift slots"
          value={`${shiftSummary.assignedSlots}/${shiftSummary.capacity}`}
        />
        <StatusPanel
          label="Confirmed"
          value={`${shiftSummary.confirmationSummary.confirmed}/${shiftSummary.assignedSlots}`}
        />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Pilot readiness</h2>
            <p className="text-sm text-muted-foreground">
              Check event setup, imports, schedule, roster, shifts, judge
              publishing, and assignment confirmations before handoff.
            </p>
          </div>
          <Link
            to="/events/$eventId/readiness"
            params={{ eventId }}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open checklist
          </Link>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Staffing report</h2>
            <p className="text-sm text-muted-foreground">
              Review coverage, judge lane gaps, conflicts, availability
              warnings, and confirmation gaps.
            </p>
          </div>
          <Link
            to="/events/$eventId/staffing"
            params={{ eventId }}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open staffing
          </Link>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Day-of operations</h2>
            <p className="text-sm text-muted-foreground">
              Scan current blocks, response queues, no-shows, replacements, and
              judge lane coverage.
            </p>
          </div>
          <Link
            to="/events/$eventId/day-of"
            params={{ eventId }}
            className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open day-of
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Concierge dashboard</h2>
              <p className="text-sm text-muted-foreground">
                Operator view for source data, setup progress, and handoff
                notes.
              </p>
            </div>
            <Link
              to="/events/$eventId/setup"
              params={{ eventId }}
              className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Edit setup
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">Setup progress</span>
              <span className="text-muted-foreground">
                {setupProgress.percent}%
              </span>
            </div>
            <ProgressBar value={setupProgress.percent} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {crewSetupChecklistItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm"
              >
                <span
                  className={
                    parsedSettings.setup.checklist[item.key]
                      ? "size-2 rounded-full bg-emerald-500"
                      : "size-2 rounded-full bg-muted-foreground/35"
                  }
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <aside className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Competition
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <Fact label="ID" value={event.competition.id} mono />
            <Fact label="Slug" value={event.competition.slug} />
            <Fact
              label="Team"
              value={event.competition.organizingTeamId}
              mono
            />
            <Fact label="Status" value={event.competition.status} />
          </dl>
        </aside>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Source</h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <Fact
              label="Platform"
              value={event.settings.sourcePlatform ?? "Not set"}
            />
            <Fact
              label="Source event URL"
              value={event.settings.sourceEventUrl ?? "Not set"}
              link={event.settings.sourceEventUrl}
            />
            <Fact
              label="External registration URL"
              value={event.settings.externalRegistrationUrl ?? "Not set"}
              link={event.settings.externalRegistrationUrl}
            />
            <Fact
              label="Acquisition source"
              value={event.settings.acquisitionSource ?? "Not set"}
            />
          </dl>
        </section>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Operator notes</h2>
          <dl className="mt-4 grid gap-4 text-sm">
            <Fact
              label="Desired go-live date"
              value={parsedSettings.setup.desiredGoLiveDate || "Not set"}
            />
            <Fact
              label="Staffing lead"
              value={parsedSettings.setup.staffingLead || "Not set"}
            />
            <Fact
              label="Volunteer target"
              value={parsedSettings.setup.volunteerTarget || "Not set"}
            />
            <Fact
              label="Source contact"
              value={
                [
                  parsedSettings.setup.sourceContactName,
                  parsedSettings.setup.sourceContactEmail,
                ]
                  .filter(Boolean)
                  .join(" | ") || "Not set"
              }
            />
          </dl>
          {parsedSettings.parseError ? (
            <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Settings JSON could not be parsed. Saving setup will preserve the
              previous text under legacySettingsText.
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Internal notes</h2>
        <div className="mt-4 grid gap-4 text-sm lg:grid-cols-2">
          <NoteBlock
            label="Assumptions"
            value={
              parsedSettings.setup.assumptions || "No assumptions recorded."
            }
          />
          <NoteBlock
            label="Notes"
            value={parsedSettings.setup.internalNotes || "No notes recorded."}
          />
        </div>
      </section>
    </section>
  )
}

interface StatusPanelProps {
  label: string
  value: string
}

function StatusPanel({ label, value }: StatusPanelProps) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

interface FactProps {
  label: string
  value: string
  link?: string | null
  mono?: boolean
}

function Fact({ label, value, link, mono = false }: FactProps) {
  const className = mono ? "break-all font-mono" : "break-words font-medium"
  const safeLink = getSafeHttpUrl(link)

  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>
        {safeLink ? (
          <a
            href={safeLink}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

interface NoteBlockProps {
  label: string
  value: string
}

function NoteBlock({ label, value }: NoteBlockProps) {
  return (
    <div className="rounded-md border bg-background p-3">
      <h3 className="font-medium">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{value}</p>
    </div>
  )
}

interface ProgressBarProps {
  value: number
}

function ProgressBar({ value }: ProgressBarProps) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
