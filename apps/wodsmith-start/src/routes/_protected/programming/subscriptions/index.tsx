import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import {
	ArrowLeft,
	ArrowRight,
	Loader2,
	Minus,
	Search,
	Users,
} from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PROGRAMMING_TRACK_TYPE } from "@/db/schemas/programming"
import {
	getTeamProgrammingTracksFn,
	type TeamProgrammingTrack,
	unsubscribeFromTrackFn,
} from "@/server-fns/programming-fns"

interface UserTeam {
	id: string
	name: string
}

interface TeamSubscription {
	team: UserTeam
	tracks: TeamProgrammingTrack[]
}

interface LoaderData {
	teamSubscriptions: TeamSubscription[]
	userTeams: UserTeam[]
}

export const Route = createFileRoute("/_protected/programming/subscriptions/")({
	component: SubscriptionsPage,
	loader: async ({ context }): Promise<LoaderData> => {
		const session = context.session
		const userTeams = (session?.teams || []) as UserTeam[]

		if (userTeams.length === 0) {
			return {
				teamSubscriptions: [],
				userTeams: [],
			}
		}

		// Fetch tracks for each team
		const subscriptionsPerTeam = await Promise.all(
			userTeams.map(async (team: UserTeam) => {
				const { tracks } = await getTeamProgrammingTracksFn({
					data: { teamId: team.id },
				})
				return {
					team,
					tracks,
				}
			}),
		)

		return {
			teamSubscriptions: subscriptionsPerTeam,
			userTeams,
		}
	},
})

function SubscriptionsPage() {
	const { teamSubscriptions, userTeams } = Route.useLoaderData() as LoaderData
	const router = useRouter()
	const [searchQuery, setSearchQuery] = useState("")
	const [unsubscribingKey, setUnsubscribingKey] = useState<string | null>(null)

	const unsubscribeFromTrack = useServerFn(unsubscribeFromTrackFn)

	// Handle unsubscribe with optimistic update
	const handleUnsubscribe = async (
		teamId: string,
		trackId: string,
		trackName: string,
	) => {
		const key = `${teamId}-${trackId}`
		setUnsubscribingKey(key)

		try {
			await unsubscribeFromTrack({ data: { teamId, trackId } })
			toast.success(`Unsubscribed from "${trackName}"`)
			router.invalidate()
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to unsubscribe",
			)
		} finally {
			setUnsubscribingKey(null)
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

	// Filter tracks by search query
	const filteredSubscriptions = useMemo(() => {
		if (!searchQuery.trim()) {
			return teamSubscriptions
		}
		const query = searchQuery.toLowerCase()
		return teamSubscriptions.map((sub: TeamSubscription) => ({
			...sub,
			tracks: sub.tracks.filter(
				(track: TeamProgrammingTrack) =>
					track.name.toLowerCase().includes(query) ||
					track.description?.toLowerCase().includes(query) ||
					track.ownerTeam?.name?.toLowerCase().includes(query),
			),
		}))
	}, [teamSubscriptions, searchQuery])

	// Count total subscriptions
	const totalSubscriptions = teamSubscriptions.reduce(
		(sum: number, sub: TeamSubscription) => sum + sub.tracks.length,
		0,
	)

	if (userTeams.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="text-center py-12">
					<p className="text-muted-foreground text-lg">
						No team found. Please join or create a team to manage programming
						subscriptions.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			{/* Header */}
			<div className="mb-6 flex items-center gap-3">
				<Button variant="outline" size="icon" asChild>
					<Link to="/programming">
						<ArrowLeft className="h-5 w-5" />
					</Link>
				</Button>
				<div className="flex-1">
					<h1 className="text-4xl font-bold">MY SUBSCRIPTIONS</h1>
					<p className="text-muted-foreground mt-2">
						Manage your team's programming track subscriptions
					</p>
				</div>
			</div>

			{/* Search */}
			<div className="mb-6">
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search subscriptions..."
						className="pl-10"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>

			{/* Subscriptions */}
			{totalSubscriptions === 0 ? (
				<div className="text-center py-16 border-2 border-dashed border-muted rounded-lg bg-muted/50">
					<p className="text-muted-foreground mb-6 text-lg">
						You haven't subscribed to any programming tracks yet.
					</p>
					<Button asChild>
						<Link to="/programming">
							<Search className="h-5 w-5 mr-2" />
							Browse Programming Tracks
						</Link>
					</Button>
				</div>
			) : (
				<div className="space-y-8">
					{filteredSubscriptions.map(
						({
							team,
							tracks,
						}: {
							team: UserTeam
							tracks: TeamProgrammingTrack[]
						}) => (
							<div key={team.id}>
								{/* Team Header (only show if multiple teams) */}
								{userTeams.length > 1 && (
									<div className="mb-4 flex items-center gap-2">
										<Users className="h-5 w-5 text-muted-foreground" />
										<h2 className="text-xl font-semibold">{team.name}</h2>
										<Badge variant="secondary">{tracks.length} tracks</Badge>
									</div>
								)}

								{/* Tracks List */}
								{tracks.length === 0 ? (
									<Card>
										<CardContent className="py-8 text-center">
											<p className="text-muted-foreground">
												{searchQuery.trim()
													? "No subscriptions match your search."
													: "No subscriptions for this team."}
											</p>
										</CardContent>
									</Card>
								) : (
									<div className="space-y-2">
										{tracks.map((track: TeamProgrammingTrack) => {
											const isOwner = track.ownerTeamId === team.id
											const key = `${team.id}-${track.id}`
											const isUnsubscribing = unsubscribingKey === key

											return (
												<Card
													key={track.id}
													className="hover:bg-muted/50 transition-colors"
												>
													<CardContent className="py-4">
														<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
															<div className="flex-1 min-w-0">
																<div className="flex items-center gap-2 flex-wrap mb-1">
																	<Link
																		to="/programming/$trackId"
																		params={{ trackId: track.id }}
																		className="font-medium hover:underline underline-offset-4"
																	>
																		{track.name}
																	</Link>
																	<Badge className={getTypeColor(track.type)}>
																		{getTypeLabel(track.type)}
																	</Badge>
																	{isOwner && (
																		<Badge variant="secondary">Owner</Badge>
																	)}
																</div>
																{track.ownerTeam && !isOwner && (
																	<p className="text-sm text-muted-foreground">
																		by {track.ownerTeam.name}
																	</p>
																)}
																{track.description && (
																	<p className="text-sm text-muted-foreground line-clamp-1 mt-1">
																		{track.description}
																	</p>
																)}
															</div>
															<div className="flex items-center gap-2">
																<Button variant="outline" size="sm" asChild>
																	<Link
																		to="/programming/$trackId"
																		params={{ trackId: track.id }}
																	>
																		View
																		<ArrowRight className="h-4 w-4 ml-1" />
																	</Link>
																</Button>
																{!isOwner && (
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleUnsubscribe(
																				team.id,
																				track.id,
																				track.name,
																			)
																		}
																		disabled={isUnsubscribing}
																		className="text-destructive hover:text-destructive hover:bg-destructive/10"
																	>
																		{isUnsubscribing ? (
																			<>
																				<Loader2 className="h-4 w-4 mr-1 animate-spin" />
																				Removing...
																			</>
																		) : (
																			<>
																				<Minus className="h-4 w-4 mr-1" />
																				Unsubscribe
																			</>
																		)}
																	</Button>
																)}
															</div>
														</div>
													</CardContent>
												</Card>
											)
										})}
									</div>
								)}
							</div>
						),
					)}
				</div>
			)}
		</div>
	)
}
