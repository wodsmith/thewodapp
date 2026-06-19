import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import {
  calculateSetupProgress,
  crewSetupChecklistItems,
  parseCrewSettings,
} from "@/lib/crew-event-setup"

export const Route = createFileRoute("/events/$eventId/")({
  component: EventOverviewPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventOverviewPage() {
  const { eventId } = parentRoute.useParams()
  const { event } = parentRoute.useLoaderData()
  const parsedSettings = parseCrewSettings(event.settings.settings)
  const setupProgress = calculateSetupProgress(parsedSettings.setup)

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatusPanel
          label="Lifecycle"
          value={formatValue(event.settings.lifecycle)}
        />
        <StatusPanel
          label="Concierge"
          value={formatValue(event.settings.conciergeStatus)}
        />
        <StatusPanel
          label="Plan"
          value={formatValue(event.settings.crewPlan)}
        />
        <StatusPanel
          label="Setup"
          value={`${setupProgress.completed}/${setupProgress.total}`}
        />
      </div>

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

function StatusPanel({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function Fact({
  label,
  value,
  link,
  mono = false,
}: {
  label: string
  value: string
  link?: string | null
  mono?: boolean
}) {
  const className = mono ? "break-all font-mono" : "break-words font-medium"

  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className}>
        {link ? (
          <a
            href={link}
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

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <h3 className="font-medium">{label}</h3>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{value}</p>
    </div>
  )
}

function formatValue(value: string) {
  return value.replaceAll("_", " ")
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}
