/**
 * Admin Teams Programming Page
 * Port of apps/wodsmith/src/app/(admin)/admin/teams/programming/page.tsx
 */

import {
	createFileRoute,
	Link,
	redirect,
	useRouter,
} from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { ProgrammingTrackCreateDialog } from "@/components/programming-track-create-dialog"
import { ProgrammingTrackRow } from "@/components/programming-track-row"
import { ProgrammingTracksClient } from "@/components/programming-tracks-client"
import { Button } from "@/components/ui/button"
import {
	getPublicTracksWithSubscriptionsFn,
	getTeamProgrammingTracksFn,
	type TeamProgrammingTrack,
} from "@/server-fns/programming-fns"

export const Route = createFileRoute("/_protected/admin/teams/programming/")({
	component: AdminProgrammingPage,
	beforeLoad: async ({ context }) => {
		if (!context.hasWorkoutTracking) {
			throw redirect({ to: "/compete" })
		}
	},
	loader: async ({ context }) => {
		const session = context.session
		const teamId = session?.teams?.[0]?.id

		if (!teamId) {
			return {
				tracks: [] as TeamProgrammingTrack[],
				allTracks: [],
				teamId: null,
				teamName: null,
			}
		}

		// Fetch programming tracks for the team
		const { tracks } = await getTeamProgrammingTracksFn({ data: { teamId } })

		// Fetch public tracks with subscriptions for this team
		const { tracks: allTracks } = await getPublicTracksWithSubscriptionsFn({
			data: { userTeamIds: [teamId] },
		})

		const team = session?.teams?.find((t) => t.id === teamId)

		return {
			tracks,
			allTracks,
			teamId,
			teamName: team?.name ?? "Team",
		}
	},
})

function AdminProgrammingPage() {
	const { tracks, allTracks, teamId, teamName } = Route.useLoaderData()
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
		<>
			{/* Breadcrumb */}
			<div className="px-4 sm:px-5 py-4 border-b">
				<nav className="flex items-center gap-2 text-sm font-mono">
					<Link
						to="/admin"
						className="text-muted-foreground hover:text-foreground"
					>
						Admin
					</Link>
					<span className="text-muted-foreground">/</span>
					<Link
						to="/admin/teams"
						className="text-muted-foreground hover:text-foreground"
					>
						{teamName}
					</Link>
					<span className="text-muted-foreground">/</span>
					<span className="text-foreground">Programming</span>
				</nav>
			</div>

			<div className="px-4 sm:px-5 pb-12">
				<div className="flex justify-between items-start mb-8 mt-6">
					<div className="min-w-0 flex-1">
						<h1 className="text-2xl sm:text-3xl font-bold mb-2 font-mono tracking-tight">
							Programming Track Management
						</h1>
						<p className="text-muted-foreground font-mono text-sm sm:text-base">
							Manage programming tracks for {teamName}
						</p>
					</div>
				</div>

				{/* Your Programming Section */}
				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6 mb-12">
					<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
						<div className="flex-1 min-w-0">
							<h2 className="text-2xl font-bold font-mono tracking-tight">
								Your Programming
							</h2>
							<p className="text-muted-foreground mt-1 font-mono">
								Manage and organize your team's training programs
							</p>
						</div>
						<div className="shrink-0">
							<ProgrammingTrackCreateDialog
								teamId={teamId}
								onSuccess={handleTrackCreated}
								trigger={
									<Button className="border-4 border-primary transition-all font-mono w-full sm:w-auto">
										<Plus className="h-4 w-4 mr-2" />
										Create Track
									</Button>
								}
							/>
						</div>
					</div>

					{tracks.length === 0 ? (
						<div className="text-center py-16 border-4 border-dashed border-primary bg-surface rounded-none">
							<p className="text-muted-foreground mb-6 font-mono text-lg">
								No programming tracks found.
							</p>
							<ProgrammingTrackCreateDialog
								teamId={teamId}
								onSuccess={handleTrackCreated}
								trigger={
									<Button className="border-4 border-primary transition-all font-mono">
										<Plus className="h-4 w-4 mr-2" />
										Create your first track
									</Button>
								}
							/>
						</div>
					) : (
						<ul className="space-y-2">
							{tracks.map((track) => (
								<ProgrammingTrackRow
									key={track.id}
									track={track}
									teamId={teamId}
									linkPrefix="/admin/teams/programming"
								/>
							))}
						</ul>
					)}
				</div>

				{/* Explore Programming Section */}
				<div className="bg-card border-4 border-primary rounded-none p-4 sm:p-6">
					<h2 className="text-2xl font-bold mb-2 font-mono tracking-tight">
						Explore Programming
					</h2>
					<p className="text-muted-foreground font-mono text-sm sm:text-base mb-6">
						Subscribe to public programming tracks created by other teams
					</p>
					<ProgrammingTracksClient
						allTracks={allTracks}
						teamId={teamId}
						teamName={teamName}
						hasManagePermission={true}
					/>
				</div>
			</div>
		</>
	)
}
