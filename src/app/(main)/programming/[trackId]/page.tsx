import "server-only"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { getSessionFromCookie } from "@/utils/auth"
import { getProgrammingTrackById } from "@/server/programming"

interface ProgrammingTrackPageProps {
	params: Promise<{
		trackId: string
	}>
}

export default async function ProgrammingTrackPage({
	params,
}: ProgrammingTrackPageProps) {
	const { trackId } = await params
	const session = await getSessionFromCookie()

	if (!session?.teams?.[0]?.id) {
		notFound()
	}

	const track = await getProgrammingTrackById(trackId)

	if (!track) {
		notFound()
	}

	return (
		<div className="container mx-auto py-8">
			<div className="mb-8">
				<div className="flex items-start justify-between mb-4">
					<h1 className="text-3xl font-bold tracking-tight">{track.name}</h1>
					<Badge variant="secondary" className="ml-2">
						{track.type.replace(/_/g, " ")}
					</Badge>
				</div>

				{track.description && (
					<p className="text-muted-foreground text-lg">{track.description}</p>
				)}

				{track.ownerTeam && (
					<div className="mt-4">
						<span className="text-sm text-muted-foreground">
							Created by <strong>{track.ownerTeam.name}</strong>
						</span>
					</div>
				)}
			</div>

			{/* Placeholder for workout listings - will be implemented in task-5 */}
			<div className="border-2 border-dashed border-muted rounded-lg p-8">
				<div className="text-center text-muted-foreground">
					<p className="text-lg font-medium mb-2">
						Workout listings coming soon
					</p>
					<p className="text-sm">
						This section will display all workouts in this programming track
						with pagination.
					</p>
				</div>
			</div>
		</div>
	)
}
