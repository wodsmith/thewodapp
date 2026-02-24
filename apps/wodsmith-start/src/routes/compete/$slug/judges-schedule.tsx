/**
 * Judges Schedule Page
 *
 * A printable page showing all heats with their assigned judges.
 * Accessible to anyone with the direct link (security through obscurity).
 * The navigation link to this page is only shown to judges and organizers.
 */

import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getJudgesScheduleDataFn } from "@/server-fns/judge-scheduling-fns"
import { JudgesScheduleContent } from "./-components/judges-schedule-content"

export const Route = createFileRoute("/compete/$slug/judges-schedule")({
	loader: async ({ parentMatchPromise }) => {
		// Get competition from parent
		const parentMatch = await parentMatchPromise
		const competition = parentMatch.loaderData?.competition

		if (!competition) {
			throw new Error("Competition not found")
		}

		// Fetch judges schedule data (no auth required - accessible via direct link)
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
