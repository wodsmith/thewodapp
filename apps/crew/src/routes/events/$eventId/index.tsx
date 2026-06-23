// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Staffing Page Gap Report]]
// @lat: [[crew#Day Of Operations Board]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import {
  calculateSetupProgress,
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
      <div className="grid gap-4 md:grid-cols-4">
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

      <div className="grid gap-4 md:grid-cols-2">
        <WorkflowCard
          title="Setup"
          description={`${setupProgress.percent}% complete`}
          to="/events/$eventId/setup"
          eventId={eventId}
          action="Open setup"
        />
        <WorkflowCard
          title="Imports"
          description="Bring in volunteer lists and heat schedules."
          to="/events/$eventId/imports"
          eventId={eventId}
          action="Open imports"
        />
        <WorkflowCard
          title="Staffing Plan"
          description="Review coverage gaps and role-level staffing needs."
          to="/events/$eventId/staffing"
          eventId={eventId}
          action="Open staffing"
        />
        <WorkflowCard
          title="Assignments"
          description={`${shiftSummary.assignedSlots}/${shiftSummary.capacity} shift slots assigned.`}
          to="/events/$eventId/shifts"
          eventId={eventId}
          action="Open assignments"
        />
        <WorkflowCard
          title="Confirmations"
          description={`${shiftSummary.confirmationSummary.confirmed}/${shiftSummary.assignedSlots} assigned volunteers confirmed.`}
          to="/events/$eventId/shifts"
          eventId={eventId}
          action="Open confirmations"
        />
        <WorkflowCard
          title="Event Day"
          description="Run day-of staffing, coverage, and replacement workflows."
          to="/events/$eventId/day-of"
          eventId={eventId}
          action="Open event day"
        />
        <WorkflowCard
          title="Print Packet"
          description="Prepare the event-day staffing export packet."
          to="/events/$eventId/exports"
          eventId={eventId}
          action="Open exports"
        />
      </div>

      {parsedSettings.parseError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Setup settings need attention before the checklist can be edited.
        </p>
      ) : null}
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

function WorkflowCard({
  title,
  description,
  to,
  eventId,
  action,
}: {
  title: string
  description: string
  to:
    | "/events/$eventId/setup"
    | "/events/$eventId/imports"
    | "/events/$eventId/staffing"
    | "/events/$eventId/shifts"
    | "/events/$eventId/day-of"
    | "/events/$eventId/exports"
  eventId: string
  action: string
}) {
  return (
    <section className="rounded-md border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Link
          to={to}
          params={{ eventId }}
          className="w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {action}
        </Link>
      </div>
    </section>
  )
}
