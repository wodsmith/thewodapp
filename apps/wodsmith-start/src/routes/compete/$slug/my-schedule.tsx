import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { ArrowLeft, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { canInputScoresFn } from "@/server-fns/volunteer-fns"
import {
	getVolunteerMembershipFn,
	getVolunteerScheduleDataFn,
} from "@/server-fns/volunteer-schedule-fns"
import { ScheduleView } from "./-components/schedule-view"

export const Route = createFileRoute("/compete/$slug/my-schedule")({
	loader: async ({ params, context }) => {
		const { slug } = params

		// Check for session - redirect to sign-in if not authenticated
		const session = context.session ?? null
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/my-schedule` },
			})
		}

		// Fetch competition by slug
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Check if competition has team
		if (!competition.competitionTeamId) {
			return {
				competition,
				membership: null,
				events: [],
				volunteerMetadata: null,
				hasTeam: false,
				hasScoreAccess: false,
			}
		}

		// Get user's membership in the competition team
		const { membership, volunteerMetadata } = await getVolunteerMembershipFn({
			data: {
				competitionTeamId: competition.competitionTeamId,
				userId: session.userId,
			},
		})

		if (!membership) {
			return {
				competition,
				membership: null,
				events: [],
				volunteerMetadata: null,
				hasTeam: true,
				hasScoreAccess: false,
			}
		}

		// Get enriched rotations for the volunteer's schedule
		const [{ events }, hasScoreAccess] = await Promise.all([
			getVolunteerScheduleDataFn({
				data: {
					membershipId: membership.id,
					competitionId: competition.id,
				},
			}),
			canInputScoresFn({
				data: {
					userId: session.userId,
					competitionTeamId: competition.competitionTeamId,
				},
			}),
		])

		return {
			competition,
			membership,
			events,
			volunteerMetadata,
			hasTeam: true,
			hasScoreAccess,
		}
	},
	component: MySchedulePage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `My Schedule - ${competition.name}` },
				{
					name: "description",
					content: `View your judging assignments for ${competition.name}`,
				},
			],
		}
	},
})

function MySchedulePage() {
	const {
		competition,
		membership,
		events,
		volunteerMetadata,
		hasTeam,
		hasScoreAccess,
	} = Route.useLoaderData()
	const { slug } = Route.useParams()

	return (
		<div className="min-h-screen bg-background">
			<div className="border-b">
				<div className="container mx-auto flex items-center justify-between px-4 py-4">
					<Button variant="ghost" size="sm" asChild>
						<Link to="/compete/$slug" params={{ slug }}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Competition
						</Link>
					</Button>

					{hasScoreAccess && (
						<Button asChild>
							<Link to="/compete/$slug/scores" params={{ slug }}>
								<ClipboardList className="mr-2 h-4 w-4" />
								Enter Scores
							</Link>
						</Button>
					)}
				</div>
			</div>

			<div className="mx-auto max-w-4xl py-8 px-4">
				{/* No team error state */}
				{!hasTeam && (
					<div className="bg-destructive/10 rounded-lg border border-destructive/20 p-6">
						<h1 className="text-2xl font-bold mb-2">Schedule Not Available</h1>
						<p>The schedule is not available for this competition.</p>
					</div>
				)}

				{/* Not registered error state */}
				{hasTeam && !membership && (
					<div className="bg-muted rounded-lg border p-6">
						<h1 className="text-2xl font-bold mb-2">Not Registered</h1>
						<p>
							You must be registered for this competition to view your judging
							schedule.
						</p>
					</div>
				)}

				{/* Schedule view when membership exists */}
				{hasTeam && membership && (
					<ScheduleView
						events={events}
						competitionName={competition.name}
						volunteerMetadata={volunteerMetadata}
						membershipId={membership.id}
						competitionSlug={slug}
						competitionStartDate={competition.startDate}
						competitionEndDate={competition.endDate}
					/>
				)}
			</div>
		</div>
	)
}
