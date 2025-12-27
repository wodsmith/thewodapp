import {createFileRoute, getRouteApi} from '@tanstack/react-router'
import {EventDetailsContent} from '@/components/event-details-content'
import {RegistrationSidebar} from '@/components/registration-sidebar'
import {Card, CardContent} from '@/components/ui/card'

const parentRoute = getRouteApi('/compete/$slug')

export const Route = createFileRoute('/compete/$slug/')({
  component: CompetitionOverviewPage,
})

function CompetitionOverviewPage() {
  const {
    competition,
    registrationCount,
    userRegistration,
    isVolunteer,
    registrationStatus,
    session,
  } = parentRoute.useLoaderData()

  const isRegistered = !!userRegistration

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* Main Content */}
      <EventDetailsContent
        competition={competition}
        divisions={undefined} // TODO: Will be fetched in a future task
        sponsors={undefined} // TODO: Will be fetched in a future task
        workoutsContent={
          <section>
            <Card className="border-dashed">
              <CardContent className="py-6 text-center">
                <p className="text-muted-foreground">
                  Workouts will be announced by the event organizer.
                </p>
              </CardContent>
            </Card>
          </section>
        }
        scheduleContent={
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground">
                Schedule information coming soon.
              </p>
            </CardContent>
          </Card>
        }
      />

      {/* Sidebar */}
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <RegistrationSidebar
          competition={competition}
          isRegistered={isRegistered}
          registrationOpen={registrationStatus.registrationOpen}
          registrationCount={registrationCount}
          maxSpots={undefined} // TODO: Will be fetched when divisions are implemented
          userDivision={undefined} // TODO: Will be fetched when divisions are implemented
          registrationId={userRegistration?.id}
          isTeamRegistration={false} // TODO: Determine from division when implemented
          isCaptain={userRegistration?.userId === session?.userId}
          isVolunteer={isVolunteer}
        />
      </aside>
    </div>
  )
}
