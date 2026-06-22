// @lat: [[crew#Pilot Readiness Checklist]]
// @lat: [[crew#Staffing Page Gap Report]]
// @lat: [[crew#Day Of Operations Board]]
// @lat: [[crew#Pilot Exports]]
// @lat: [[crew#Billing Page And Upgrade CTA]]
// @lat: [[crew#Full WODsmith Conversion Assistant]]
// @lat: [[crew#Regional Judge Discovery Pilot]]
import {createFileRoute, Link, notFound, Outlet} from '@tanstack/react-router'
import {getCrewEventNavItems} from '@/lib/crew/navigation'
import {getCrewEventFn} from '@/server-fns/crew-event-settings-fns'
import {resolveCrewViewer} from '@/utils/crew-access'

export const Route = createFileRoute('/events/$eventId')({
  loader: async ({params}) => {
    const result = await getCrewEventFn({data: {eventId: params.eventId}})
    if (!result.event) {
      throw notFound()
    }
    return {event: result.event}
  },
  component: EventShell,
})

function EventShell() {
  const {eventId} = Route.useParams()
  const {event} = Route.useLoaderData()
  const viewer = resolveCrewViewer()
  const navItems = getCrewEventNavItems({viewerRole: viewer.role})

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 border-b pb-6 md:flex-row md:items-end">
        <div>
          {viewer.isWodsmithOperator && (
            <p className="font-mono text-sm text-muted-foreground">{eventId}</p>
          )}
          <h1 className="text-3xl font-semibold">{event.competition.name}</h1>
          <p className="text-muted-foreground">
            {event.competition.startDate} to {event.competition.endDate}
          </p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              params={{eventId}}
              activeOptions={item.key === 'home' ? {exact: true} : undefined}
              activeProps={{className: 'bg-muted text-foreground'}}
              className="rounded-md border px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <Outlet />
    </main>
  )
}