import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router"
import { ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompetitionTabs } from "@/components/competition-tabs"
import { PublicSubmissionWindows } from "@/components/public-submission-windows"
import { SchedulePageContent } from "@/components/schedule-page-content"
import { getPublicCompetitionEventsFn } from "@/server-fns/competition-event-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getHeatsForCompetitionFn } from "@/server-fns/competition-heats-fns"
import { getPublishedCompetitionWorkoutsFn } from "@/server-fns/competition-workouts-fns"

const parentRoute = getRouteApi("/compete/$slug")

export const Route = createFileRoute("/compete/$slug/schedule")({
	component: CompetitionSchedulePage,
	loader: async ({ params }) => {
		// Fetch competition by slug to get the ID
		const { competition } = await getCompetitionBySlugFn({
			data: { slug: params.slug },
		})

		if (!competition) {
			return {
				heats: [],
				events: [],
				submissionWindows: [],
				competitionStarted: false,
				isOnline: false,
				timezone: "America/Denver",
			}
		}

		const isOnline = competition.competitionType === "online"

		// For online competitions, fetch submission windows instead of heats
		if (isOnline) {
			const [eventsResult, submissionResult] = await Promise.all([
				getPublishedCompetitionWorkoutsFn({
					data: { competitionId: competition.id },
				}),
				getPublicCompetitionEventsFn({
					data: { competitionId: competition.id },
				}),
			])

			return {
				heats: [],
				events: eventsResult.workouts,
				submissionWindows: submissionResult.events,
				competitionStarted: submissionResult.competitionStarted,
				isOnline: true,
				timezone: competition.timezone ?? "America/Denver",
			}
		}

		// For in-person competitions, fetch heats as usual
		const [heatsResult, eventsResult] = await Promise.all([
			getHeatsForCompetitionFn({ data: { competitionId: competition.id } }),
			getPublishedCompetitionWorkoutsFn({
				data: { competitionId: competition.id },
			}),
		])

		return {
			heats: heatsResult.heats,
			events: eventsResult.workouts,
			submissionWindows: [],
			competitionStarted: false,
			isOnline: false,
			timezone: competition.timezone ?? "America/Denver",
		}
	},
})

function CompetitionSchedulePage() {
	const {
		heats,
		events,
		submissionWindows,
		competitionStarted,
		isOnline,
		timezone,
	} = Route.useLoaderData()
	const { competition, session, canManage, isVolunteer } =
		parentRoute.useLoaderData()

	// Show judges schedule link for organizers and volunteers
	const showJudgesScheduleLink = canManage || isVolunteer

	// For online competitions, show submission windows
	if (isOnline) {
		return (
			<PublicSubmissionWindows
				events={events}
				submissionWindows={submissionWindows}
				competitionStarted={competitionStarted}
				timezone={timezone}
			/>
		)
	}

	// For in-person competitions, show heat schedule
	return (
		<div className="space-y-4">
			<div className="sticky top-4 z-10 flex items-center gap-2">
				<div className="flex-1">
					<CompetitionTabs slug={competition.slug} />
				</div>
				{showJudgesScheduleLink && (
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/compete/$slug/judges-schedule"
							params={{ slug: competition.slug }}
						>
							<ClipboardList className="mr-2 h-4 w-4" />
							<span className="hidden sm:inline">Judges Schedule</span>
							<span className="sm:hidden">Judges</span>
						</Link>
					</Button>
				)}
			</div>
			<div className="rounded-2xl border border-black/10 bg-black/5 p-4 sm:p-6 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
				<SchedulePageContent
					events={events}
					heats={heats}
					currentUserId={session?.userId}
					timezone={timezone}
				/>
			</div>
		</div>
	)
}
