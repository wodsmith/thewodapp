"use client"

import { Link } from "@tanstack/react-router"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { Plus, Calendar, Users } from "lucide-react"

// TODO: Migrate full component from apps/wodsmith/src/app/(admin)/admin/teams/[teamId]/programming/_components/programming-track-dashboard.tsx
// This is a stub component that displays programming tracks
// Full component includes: create/edit/delete dialogs, track navigation

interface ProgrammingTrack {
	id: string
	name: string
	description: string | null
	type: string
	isPublic: number
	ownerTeamId: string
	scalingGroupId: string | null
	createdAt: Date
	updatedAt: Date
}

interface ScalingGroup {
	id: string
	title: string
}

interface ProgrammingTrackDashboardProps {
	teamId: string
	initialTracks: ProgrammingTrack[]
	scalingGroups?: Record<string, ScalingGroup>
}

export function ProgrammingTrackDashboard({
	teamId,
	initialTracks,
	scalingGroups = {},
}: ProgrammingTrackDashboardProps) {
	return (
		<div className="space-y-8">
			<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
				<div className="flex-1 min-w-0">
					<h2 className="text-2xl font-bold font-mono tracking-tight">
						Your Programming
					</h2>
					<p className="text-muted-foreground mt-1 font-mono">
						Manage and organize your team's training programs
					</p>
				</div>
				<div className="shrink-0">
					<Button disabled className="border-4 border-primary transition-all font-mono w-full sm:w-auto">
						<Plus className="h-4 w-4 mr-2" />
						Create Track
					</Button>
				</div>
			</div>

			{initialTracks.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
						<h3 className="text-lg font-semibold font-mono mb-2">No Programming Tracks</h3>
						<p className="text-muted-foreground font-mono max-w-md mx-auto">
							Create your first programming track to start organizing workouts into
							structured training programs.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{initialTracks.map((track) => {
						const scalingGroup = track.scalingGroupId
							? scalingGroups[track.scalingGroupId]
							: null

						return (
							<Link
								key={track.id}
								to="/admin/teams/$teamId/programming/$trackId"
								params={{ teamId, trackId: track.id }}
								className="block"
							>
								<Card className="hover:border-primary transition-colors cursor-pointer h-full">
									<CardHeader>
										<div className="flex items-start justify-between">
											<CardTitle className="font-mono">{track.name}</CardTitle>
											<div className="flex gap-1">
												{track.isPublic === 1 && (
													<Badge variant="secondary" className="font-mono text-xs">
														<Users className="h-3 w-3 mr-1" />
														Public
													</Badge>
												)}
												<Badge variant="outline" className="font-mono text-xs">
													{track.type}
												</Badge>
											</div>
										</div>
										{track.description && (
											<CardDescription className="font-mono">
												{track.description}
											</CardDescription>
										)}
									</CardHeader>
									<CardContent>
										{scalingGroup && (
											<div className="text-sm text-muted-foreground font-mono">
												Scaling: {scalingGroup.title}
											</div>
										)}
									</CardContent>
								</Card>
							</Link>
						)
					})}
				</div>
			)}

			{/* Debug info */}
			<details className="text-xs text-muted-foreground">
				<summary>Debug: Data Summary</summary>
				<pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
					{JSON.stringify(
						{
							teamId,
							tracksCount: initialTracks.length,
							scalingGroupsCount: Object.keys(scalingGroups).length,
						},
						null,
						2
					)}
				</pre>
			</details>
		</div>
	)
}
