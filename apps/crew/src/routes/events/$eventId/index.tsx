// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Staffing Page Gap Report]]
// @lat: [[crew#Day Of Operations Board]]
// @lat: [[crew#Organizer Home Next Action]]
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import type { CrewOrganizerHomeView } from "@/server/crew-organizer-home.server"
import { getCrewOrganizerHomeFn } from "@/server-fns/crew-organizer-home-fns"

export const Route = createFileRoute("/events/$eventId/")({
  loader: async ({ params }) =>
    await getCrewOrganizerHomeFn({
      data: { eventId: params.eventId },
    }),
  component: EventOverviewPage,
})

const parentRoute = getRouteApi("/events/$eventId")

function EventOverviewPage() {
  const { eventId } = parentRoute.useParams()
  const { view } = Route.useLoaderData()

  return (
    <section className="space-y-6">
      <section className="rounded-md border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-muted-foreground">
              Next step
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              {view.nextAction.title}
            </h2>
            <p className="mt-2 text-muted-foreground">
              {view.nextAction.description}
            </p>
          </div>
          <ActionLink
            action={view.nextAction}
            eventId={eventId}
            variant="primary"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Current snapshot</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {view.supportingFacts.map((fact) => (
            <StatusPanel
              key={fact.label}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </div>
      </section>

      {view.secondaryActions.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Also useful</h2>
          <div className="flex flex-wrap gap-2">
            {view.secondaryActions.map((action) => (
              <ActionLink key={action.key} action={action} eventId={eventId} />
            ))}
          </div>
        </section>
      ) : null}

      {view.setupParseError ? (
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
    <section className="rounded-md border bg-background p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </section>
  )
}

function ActionLink({
  action,
  eventId,
  variant = "secondary",
}: {
  action: CrewOrganizerHomeView["nextAction"]
  eventId: string
  variant?: "primary" | "secondary"
}) {
  const to = toEventRoute(action.ctaTo)
  const search = toEventRouteSearch(action.ctaTo)

  return (
    <Link
      to={to}
      params={{ eventId }}
      search={search}
      className={
        variant === "primary"
          ? "w-fit rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          : "w-fit rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      }
    >
      {action.ctaLabel}
    </Link>
  )
}

function toEventRoute(ctaTo: CrewOrganizerHomeView["nextAction"]["ctaTo"]) {
  switch (ctaTo) {
    case "/setup":
      return "/events/$eventId/setup"
    case "/imports?tab=volunteers":
    case "/imports?tab=heat_schedule":
      return "/events/$eventId/imports"
    case "/staffing":
      return "/events/$eventId/staffing"
    case "/assignments":
      return "/events/$eventId/assignments"
    case "/messages":
      return "/events/$eventId/messages"
    case "/day-of":
      return "/events/$eventId/day-of"
    case "/exports":
      return "/events/$eventId/exports"
  }
}

function toEventRouteSearch(
  ctaTo: CrewOrganizerHomeView["nextAction"]["ctaTo"],
) {
  switch (ctaTo) {
    case "/imports?tab=volunteers":
      return { tab: "volunteers" }
    case "/imports?tab=heat_schedule":
      return { tab: "heat_schedule" }
    default:
      return undefined
  }
}
