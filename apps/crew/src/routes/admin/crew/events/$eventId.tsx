// @lat: [[crew#Crew Admin Shell]]
import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router"
import type { ReactNode } from "react"
import {
  CrewEventSidebarShell,
  getCrewAdminEventSidebarNavigation,
} from "@/components/crew-event-sidebar"
import { formatCrewValue, getSafeHttpUrl } from "@/lib/crew-event-display"
import {
  type CrewAdminEventDetailView,
  getCrewAdminEventDetailFn,
} from "@/server-fns/crew-admin-event-fns"

export const Route = createFileRoute("/admin/crew/events/$eventId")({
  loader: async ({ params }) =>
    await getCrewAdminEventDetailFn({ data: { eventId: params.eventId } }),
  component: CrewAdminEventShell,
})

function CrewAdminEventShell() {
  const { eventId } = Route.useParams()
  const { view } = Route.useLoaderData()
  const navigation = getCrewAdminEventSidebarNavigation(eventId)
  const isOverview = useRouterState({
    select: (state) =>
      state.location.pathname.replace(/\/$/, "") ===
      `/admin/crew/events/${eventId}`,
  })

  return (
    <CrewEventSidebarShell
      variant="admin"
      event={{
        id: view.event.id,
        name: view.event.name,
        startDate: view.event.startDate,
        endDate: view.event.endDate,
      }}
      navigation={navigation}
      eyebrow="WODsmith Admin"
    >
      {isOverview ? <CrewAdminEventOverview view={view} /> : <Outlet />}
    </CrewEventSidebarShell>
  )
}

function CrewAdminEventOverview({ view }: { view: CrewAdminEventDetailView }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Metric
          label="Lifecycle"
          value={formatCrewValue(view.event.lifecycle)}
        />
        <Metric
          label="Concierge"
          value={formatCrewValue(view.event.conciergeStatus)}
        />
        <Metric label="Plan" value={formatCrewValue(view.event.crewPlan)} />
        <Metric label="Payment" value={view.billing.stateLabel} />
        <Metric
          label="Setup"
          value={`${view.setup.completed}/${view.setup.total}`}
        />
        <Metric label="Roster" value={view.diagnostics.roster} />
        <Metric label="Assignments" value={view.diagnostics.shiftCoverage} />
        <Metric label="Confirmed" value={view.diagnostics.confirmations} />
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Next admin action</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {view.readiness.nextAction}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Readiness diagnostics</h3>
              <p className="text-sm text-muted-foreground">
                Source counts and readiness details stay in the operator shell.
              </p>
            </div>
            <Link
              to="/admin/crew/events/$eventId/readiness"
              params={{ eventId: view.event.id }}
              className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open readiness
            </Link>
          </div>

          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Setup checks" value={view.diagnostics.setupChecks} />
            <Fact
              label="Venues and lanes"
              value={view.diagnostics.venuesAndLanes}
            />
            <Fact
              label="Workouts and heats"
              value={view.diagnostics.workoutsAndHeats}
            />
            <Fact label="Imports" value={view.diagnostics.imports} />
            <Fact label="Roster" value={view.diagnostics.roster} />
            <Fact
              label="Shift coverage"
              value={view.diagnostics.shiftCoverage}
            />
            <Fact
              label="Confirmations"
              value={view.diagnostics.confirmations}
            />
            <Fact
              label="Judge versions"
              value={view.diagnostics.judgeVersions}
            />
          </dl>
        </div>

        <aside className="rounded-md border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Raw IDs
          </h3>
          <dl className="mt-4 space-y-4 text-sm">
            <Fact label="Competition" value={view.event.id} mono />
            <Fact label="Slug" value={view.event.slug} />
            <Fact
              label="Organizer team"
              value={view.event.organizingTeamId}
              mono
            />
            <Fact
              label="Event team"
              value={view.event.competitionTeamId ?? "Not set"}
              mono
            />
          </dl>
        </aside>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Setup and source</h3>
          <dl className="mt-4 grid gap-4 text-sm">
            <Fact
              label="Source platform"
              value={view.source.platform ?? "Not set"}
            />
            <Fact
              label="Source event URL"
              value={view.source.eventUrl ?? "Not set"}
              link={view.source.eventUrl}
            />
            <Fact
              label="External registration URL"
              value={view.source.externalRegistrationUrl ?? "Not set"}
              link={view.source.externalRegistrationUrl}
            />
            <Fact
              label="Acquisition source"
              value={view.source.acquisitionSource ?? "Not set"}
            />
            <Fact
              label="Desired go-live date"
              value={view.setup.desiredGoLiveDate ?? "Not set"}
            />
            <Fact
              label="Source contact"
              value={view.setup.sourceContact ?? "Not set"}
            />
          </dl>
        </section>

        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Billing and conversion</h3>
              <p className="text-sm text-muted-foreground">
                Event-level Crew billing state and full-platform handoff.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/crew/events/$eventId/billing"
                params={{ eventId: view.event.id }}
                className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Billing
              </Link>
              <Link
                to="/admin/crew/events/$eventId/convert"
                params={{ eventId: view.event.id }}
                className="rounded-md border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Conversion
              </Link>
            </div>
          </div>
          <dl className="mt-4 grid gap-4 text-sm">
            <Fact label="Billing plan" value={view.billing.planLabel} />
            <Fact label="Billing source" value={view.billing.sourceLabel} />
            <Fact label="Amount" value={view.billing.amountLabel} />
            <Fact
              label="Upgrade credit"
              value={view.billing.upgradeCreditLabel}
            />
            <Fact
              label="Stripe Payment Link"
              value={view.billing.paymentLinkId ?? "Not recorded"}
              mono
            />
            <Fact
              label="Stripe Checkout Session"
              value={view.billing.checkoutSessionId ?? "Not recorded"}
              mono
            />
          </dl>
        </section>
      </div>

      <section className="rounded-md border bg-card p-5 shadow-sm">
        <h3 className="text-lg font-semibold">Operator notes</h3>
        <div className="mt-4 grid gap-4 text-sm lg:grid-cols-2">
          <NoteBlock
            label="Assumptions"
            value={view.operatorNotes.assumptions}
          />
          <NoteBlock
            label="Internal notes"
            value={view.operatorNotes.internalNotes}
          />
        </div>
      </section>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-lg font-semibold">{value}</p>
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
  value: ReactNode
  link?: string | null
  mono?: boolean
}) {
  const safeLink = typeof value === "string" ? getSafeHttpUrl(link) : null

  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`break-words font-medium ${mono ? "break-all font-mono text-xs" : ""}`}
      >
        {safeLink && typeof value === "string" ? (
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

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <h4 className="font-medium">{label}</h4>
      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{value}</p>
    </div>
  )
}
