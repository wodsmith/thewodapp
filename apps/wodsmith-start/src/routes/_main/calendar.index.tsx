import { createFileRoute } from '@tanstack/react-router'
import { getSessionFromCookie } from '@/utils/auth'

export const Route = createFileRoute('/_main/calendar/')({
	loader: async () => {
		const session = await getSessionFromCookie()

		if (!session?.teams?.[0]?.id) {
			throw new Error('Not authenticated or no team')
		}

		return {
			teamId: session.teams[0].id,
			teamName: session.teams[0].name || '',
		}
	},
	component: CalendarPage,
})

function CalendarPage() {
	const { teamName } = Route.useLoaderData()

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
				<p className="text-muted-foreground text-lg">
					View scheduled workouts for {teamName}
				</p>
			</div>

			{/* Calendar component placeholder */}
			<div className="border rounded-lg p-8 text-center">
				<p className="text-muted-foreground">Calendar component coming soon</p>
			</div>
		</div>
	)
}
