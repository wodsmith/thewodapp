import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { EventDetailsContent } from "@/components/event-details-content"
import { RegistrationSidebar } from "@/components/registration-sidebar"
import { Card, CardContent } from "@/components/ui/card"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/")({
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
		divisions,
		sponsors,
		userDivision,
		maxSpots,
	} = parentRoute.useLoaderData()

	const isRegistered = !!userRegistration
	const isTeamRegistration = (userDivision?.teamSize ?? 1) > 1

	return (
		<div className="grid gap-8 lg:grid-cols-[1fr_320px]">
			{/* Main Content */}
			<EventDetailsContent
				competition={competition}
				divisions={divisions.length > 0 ? divisions : undefined}
				sponsors={sponsors}
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
					maxSpots={maxSpots}
					userDivision={userDivision?.label}
					registrationId={userRegistration?.id}
					isTeamRegistration={isTeamRegistration}
					isCaptain={userRegistration?.userId === session?.userId}
					isVolunteer={isVolunteer}
				/>
			</aside>
		</div>
	)
}
