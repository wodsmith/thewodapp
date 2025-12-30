import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Dumbbell, Loader2, Minus, Plus, Users } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import {
	getProgrammingTrackByIdFn,
	getTrackSubscribedTeamsFn,
	getTrackWorkoutsFn,
	type ProgrammingTrackWithOwner,
	subscribeToTrackFn,
	type TrackWorkoutWithDetails,
	unsubscribeFromTrackFn,
} from "@/server-fns/programming-fns"

interface UserTeam {
	id: string
	name: string
}

interface SubscribedTeam {
	teamId: string
	teamName: string
	subscribedAt: Date
}

interface LoaderData {
	track: ProgrammingTrackWithOwner | null
	trackWorkouts: TrackWorkoutWithDetails[]
	subscribedTeams: SubscribedTeam[]
	userTeams: UserTeam[]
}

export const Route = createFileRoute("/_protected/programming/$trackId/")({
	component: PublicTrackDetailPage,
	loader: async ({ params, context }): Promise<LoaderData> => {
		const session = context.session
		const userTeams = (session?.teams || []) as UserTeam[]
		const userTeamIds = userTeams.map((t) => t.id)

		// Fetch track, workouts, and subscribed teams in parallel
		const [trackResult, workoutsResult, subscribedTeamsResult] =
			await Promise.all([
				getProgrammingTrackByIdFn({ data: { trackId: params.trackId } }),
				getTrackWorkoutsFn({ data: { trackId: params.trackId } }),
				userTeamIds.length > 0
					? getTrackSubscribedTeamsFn({
							data: { trackId: params.trackId, userTeamIds },
						})
					: Promise.resolve({ teams: [] as SubscribedTeam[] }),
			])

		return {
			track: trackResult.track,
			trackWorkouts: workoutsResult.workouts,
			subscribedTeams: subscribedTeamsResult.teams,
			userTeams,
		}
	},
})

function PublicTrackDetailPage() {
	const { track, trackWorkouts, subscribedTeams, userTeams } =
		Route.useLoaderData() as LoaderData
	const router = useRouter()
	const [loadingTeamId, setLoadingTeamId] = useState<string | null>(null)

	const subscribeToTrack = useServerFn(subscribeToTrackFn)
	const unsubscribeFromTrack = useServerFn(unsubscribeFromTrackFn)

	// Check if a specific team is subscribed
	const isTeamSubscribed = (teamId: string) => {
		return subscribedTeams.some((sub: SubscribedTeam) => sub.teamId === teamId)
	}

	// Check if track is owned by a team
	const isOwnedByTeam = (teamId: string) => {
		return track?.ownerTeamId === teamId
	}

	// Handle subscribe/unsubscribe toggle
	const handleToggleSubscription = async (teamId: string) => {
		if (!track) return

		const isCurrentlySubscribed = isTeamSubscribed(teamId)
		setLoadingTeamId(teamId)

		try {
			if (isCurrentlySubscribed) {
				await unsubscribeFromTrack({ data: { trackId: track.id, teamId } })
				toast.success("Unsubscribed from programming track")
			} else {
				await subscribeToTrack({ data: { trackId: track.id, teamId } })
				toast.success("Subscribed to programming track")
			}
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: `Failed to ${isCurrentlySubscribed ? "unsubscribe" : "subscribe"}`,
			)
		} finally {
			setLoadingTeamId(null)
		}
	}

	const getTypeColor = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "bg-green-500 text-white"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "bg-blue-500 text-white"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "bg-purple-500 text-white"
			default:
				return "bg-gray-500 text-white"
		}
	}

	const getTypeLabel = (type: string) => {
		switch (type) {
			case PROGRAMMING_TRACK_TYPE.SELF_PROGRAMMED:
				return "Self-programmed"
			case PROGRAMMING_TRACK_TYPE.TEAM_OWNED:
				return "Team-owned"
			case PROGRAMMING_TRACK_TYPE.OFFICIAL_3RD_PARTY:
				return "3rd Party"
			default:
				return type
		}
	}

	if (!track) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<h1 className="text-2xl font-bold mb-4">Track Not Found</h1>
					<p className="text-muted-foreground mb-6">
						The programming track you're looking for doesn't exist or has been
						removed.
					</p>
					<Button asChild>
						<Link to="/programming">Back to Browse</Link>
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Back button */}
			<div className="mb-6 flex items-center gap-3">
				<Button variant="outline" size="icon" asChild>
					<Link to="/programming">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
			</div>

			{/* Track Header */}
			<div className="mb-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-3 flex-wrap mb-2">
							<h1 className="text-3xl font-bold">{track.name}</h1>
							<Badge className={getTypeColor(track.type)}>
								{getTypeLabel(track.type)}
							</Badge>
							{track.isPublic === 1 && (
								<Badge className="bg-orange-500 text-white">
									<Users className="h-3 w-3 mr-1" />
									Public
								</Badge>
							)}
							{track.scalingGroupId && (
								<Badge className="bg-purple-500 text-white">
									<Dumbbell className="h-3 w-3 mr-1" />
									Scaling
								</Badge>
							)}
						</div>
						{track.ownerTeam && (
							<p className="text-muted-foreground mb-4">
								Created by{" "}
								<span className="font-medium">{track.ownerTeam.name}</span>
							</p>
						)}
						{track.description && (
							<p className="text-muted-foreground max-w-2xl">
								{track.description}
							</p>
						)}
					</div>
				</div>
			</div>

			{/* Subscription Section */}
			{userTeams.length > 0 && (
				<Card className="mb-8">
					<CardHeader>
						<CardTitle className="text-lg">Subscription</CardTitle>
						<CardDescription>
							{userTeams.length === 1
								? "Subscribe to add this track to your team's library"
								: "Select which teams should subscribe to this track"}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{userTeams.map((team: UserTeam) => {
								const isOwned = isOwnedByTeam(team.id)
								const isSubscribed = isTeamSubscribed(team.id)
								const isLoading = loadingTeamId === team.id

								return (
									<div
										key={team.id}
										className="flex items-center justify-between p-3 border rounded-lg"
									>
										<div>
											<p className="font-medium">{team.name}</p>
											{isOwned && (
												<p className="text-sm text-muted-foreground">
													Owner of this track
												</p>
											)}
										</div>
										{isOwned ? (
											<Badge variant="secondary">Owner</Badge>
										) : (
											<Button
												variant={isSubscribed ? "outline" : "default"}
												size="sm"
												onClick={() => handleToggleSubscription(team.id)}
												disabled={isLoading}
											>
												{isLoading ? (
													<>
														<Loader2 className="h-4 w-4 mr-1 animate-spin" />
														{isSubscribed
															? "Unsubscribing..."
															: "Subscribing..."}
													</>
												) : isSubscribed ? (
													<>
														<Minus className="h-4 w-4 mr-1" />
														Unsubscribe
													</>
												) : (
													<>
														<Plus className="h-4 w-4 mr-1" />
														Subscribe
													</>
												)}
											</Button>
										)}
									</div>
								)
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Track Workouts Section */}
			<div>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-lg font-semibold font-mono">TRACK WORKOUTS</h2>
					<p className="text-sm text-muted-foreground font-mono">
						{trackWorkouts.length} workout(s)
					</p>
				</div>

				{trackWorkouts.length === 0 ? (
					<div className="text-center py-12 border-2 border-dashed border-muted rounded-lg bg-muted/50">
						<p className="text-muted-foreground">
							No workouts have been added to this track yet.
						</p>
					</div>
				) : (
					<div className="space-y-2">
						{trackWorkouts.map((tw: TrackWorkoutWithDetails) => (
							<Card key={tw.id} className="hover:bg-muted/50 transition-colors">
								<CardContent className="py-4">
									<div className="flex items-center gap-4">
										<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-sm">
											{tw.trackOrder}
										</div>
										<div className="flex-1 min-w-0">
											<p className="font-medium truncate">{tw.workout.name}</p>
											{tw.workout.description && (
												<p className="text-sm text-muted-foreground line-clamp-1">
													{tw.workout.description}
												</p>
											)}
										</div>
										<Badge variant="secondary">{tw.workout.scheme}</Badge>
									</div>
									{tw.notes && (
										<p className="mt-2 ml-12 text-sm text-muted-foreground italic">
											{tw.notes}
										</p>
									)}
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
