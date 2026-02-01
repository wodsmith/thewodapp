/**
 * Judges Schedule Page
 *
 * A printable page showing all heats with their assigned judges.
 * Only accessible to judges and organizers.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
	checkCanManageCompetitionFn,
	checkIsVolunteerFn,
} from "@/server-fns/competition-detail-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import { getJudgesScheduleDataFn } from "@/server-fns/judge-scheduling-fns"
import { JudgesScheduleContent } from "./-components/judges-schedule-content"

export const Route = createFileRoute("/compete/$slug/judges-schedule")({
	loader: async ({ params, context }) => {
		const { slug } = params

		// Check for session - redirect to sign-in if not authenticated
		const session = context.session ?? null
		if (!session) {
			throw redirect({
				to: "/sign-in",
				search: { redirect: `/compete/${slug}/judges-schedule` },
			})
		}

		// Fetch competition by slug
		const { competition } = await getCompetitionBySlugFn({ data: { slug } })

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Check if user is an organizer or volunteer (judge)
		const [canManageResult, isVolunteerResult] = await Promise.all([
			checkCanManageCompetitionFn({
				data: {
					organizingTeamId: competition.organizingTeamId,
					userId: session.userId,
				},
			}),
			checkIsVolunteerFn({
				data: {
					competitionTeamId: competition.competitionTeamId,
					userId: session.userId,
				},
			}),
		])

		const canManage = canManageResult.canManage
		const isVolunteer = isVolunteerResult.isVolunteer

		// Only allow organizers and volunteers to access this page
		if (!canManage && !isVolunteer) {
			throw redirect({
				to: "/compete/$slug",
				params: { slug },
			})
		}

		// Fetch judges schedule data
		const { events } = await getJudgesScheduleDataFn({
			data: {
				competitionId: competition.id,
				organizingTeamId: competition.organizingTeamId,
				competitionTeamId: competition.competitionTeamId,
			},
		})

		return {
			competition,
			events,
			canManage,
			isVolunteer,
		}
	},
	component: JudgesSchedulePage,
	head: ({ loaderData }) => {
		const competition = loaderData?.competition
		if (!competition) {
			return {
				meta: [{ title: "Competition Not Found" }],
			}
		}
		return {
			meta: [
				{ title: `Judges Schedule - ${competition.name}` },
				{
					name: "description",
					content: `View the judges schedule for ${competition.name}`,
				},
			],
		}
	},
})

function JudgesSchedulePage() {
	const { competition, events } = Route.useLoaderData()
	const { slug } = Route.useParams()

	const handlePrint = () => {
		window.print()
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Header - hidden when printing */}
			<div className="border-b print:hidden">
				<div className="container mx-auto flex items-center justify-between px-4 py-4">
					<Button variant="ghost" size="sm" asChild>
						<Link to="/compete/$slug/schedule" params={{ slug }}>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Schedule
						</Link>
					</Button>

					<Button onClick={handlePrint}>
						<Printer className="mr-2 h-4 w-4" />
						Print Schedule
					</Button>
				</div>
			</div>

			{/* Main content */}
			<div className="mx-auto max-w-7xl py-8 px-4 print:py-0 print:px-0 print:mx-0 print:max-w-none">
				<JudgesScheduleContent
					competitionName={competition.name}
					events={events}
					timezone={competition.timezone ?? "America/Denver"}
				/>
			</div>
		</div>
	)
}
