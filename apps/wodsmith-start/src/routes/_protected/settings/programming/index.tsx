import { createFileRoute, useRouter } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { ProgrammingTrackCreateDialog } from "@/components/programming-track-create-dialog"
import { ProgrammingTrackRow } from "@/components/programming-track-row"
import { Button } from "@/components/ui/button"
import {
	getTeamProgrammingTracksFn,
	type TeamProgrammingTrack,
} from "@/server-fns/programming-fns"

export const Route = createFileRoute("/_protected/settings/programming/")({
	component: ProgrammingTracksPage,
	loader: async ({ context }) => {
		// Get teamId from session
		const session = context.session
		const teamId = session?.teams?.[0]?.id

		if (!teamId) {
			return {
				tracks: [] as TeamProgrammingTrack[],
				teamId: null,
			}
		}

		// Fetch programming tracks for the team
		const { tracks } = await getTeamProgrammingTracksFn({ data: { teamId } })

		return {
			tracks,
			teamId,
		}
	},
})

function ProgrammingTracksPage() {
	const { tracks, teamId } = Route.useLoaderData()
	const router = useRouter()

	const handleTrackCreated = () => {
		router.invalidate()
	}

	if (!teamId) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<p className="text-muted-foreground text-lg">
						No team found. Please join or create a team.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div className="flex-1 min-w-0">
					<h1 className="text-4xl font-bold">PROGRAMMING TRACKS</h1>
					<p className="text-muted-foreground mt-2">
						Manage and organize your team's training programs
					</p>
				</div>
				<ProgrammingTrackCreateDialog
					teamId={teamId}
					onSuccess={handleTrackCreated}
					trigger={
						<Button>
							<Plus className="h-5 w-5 mr-2" />
							Create Track
						</Button>
					}
				/>
			</div>

			{/* Tracks List */}
			{tracks.length === 0 ? (
				<div className="text-center py-16 border-2 border-dashed border-muted rounded-lg bg-muted/50">
					<p className="text-muted-foreground mb-6 text-lg">
						No programming tracks found.
					</p>
					<ProgrammingTrackCreateDialog
						teamId={teamId}
						onSuccess={handleTrackCreated}
						trigger={
							<Button>
								<Plus className="h-5 w-5 mr-2" />
								Create your first track
							</Button>
						}
					/>
				</div>
			) : (
				<ul className="space-y-2">
					{tracks.map((track) => (
						<ProgrammingTrackRow key={track.id} track={track} teamId={teamId} />
					))}
				</ul>
			)}
		</div>
	)
}
