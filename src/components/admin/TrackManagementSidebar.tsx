"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getTeamTracks } from "@/server/programming-tracks"
import {
	BarChart3,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Plus,
	Settings,
	TrendingUp,
	Users,
} from "lucide-react"
import React, { useState, useEffect, useCallback } from "react"

interface Track {
	id: string
	name: string
	description: string | null
	isActive: boolean
	totalWeeks: number
	currentWeek?: number
	participantCount?: number
	completionRate?: number
	createdAt: Date
}

interface TrackManagementSidebarProps {
	teamId: string
	isCollapsed?: boolean
	onToggleCollapsed?: () => void
	onTrackSelected?: (trackId: string) => void
	className?: string
}

export default function TrackManagementSidebar({
	teamId,
	isCollapsed = false,
	onToggleCollapsed,
	onTrackSelected,
	className = "",
}: TrackManagementSidebarProps) {
	const [tracks, setTracks] = useState<Track[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

	// Development logging
	const logAction = useCallback(
		(action: string, data: Record<string, unknown>) => {
			if (process.env.NODE_ENV === "development") {
				console.log(`[TrackManagementSidebar] ${action}`, data)
			}
		},
		[],
	)

	// Fetch team tracks
	useEffect(() => {
		const fetchTracks = async () => {
			try {
				setLoading(true)
				logAction("Fetching team tracks", { teamId })

				const teamTracks = await getTeamTracks(teamId)

				// Transform and enhance track data
				const enhancedTracks: Track[] = teamTracks.map((track) => ({
					id: track.id,
					name: track.name,
					description: track.description,
					isActive: track.isPublic === 1, // Use isPublic as a proxy for active status
					totalWeeks: 12, // Default to 12 weeks since this field doesn't exist in schema
					currentWeek: Math.floor(Math.random() * 12) + 1, // Mock current week
					participantCount: Math.floor(Math.random() * 50) + 5, // Mock participant count
					completionRate: Math.floor(Math.random() * 40) + 60, // Mock completion rate 60-100%
					createdAt: track.createdAt,
				}))

				setTracks(enhancedTracks)
				logAction("Fetched team tracks", { count: enhancedTracks.length })
			} catch (error) {
				console.error("[TrackManagementSidebar] Error fetching tracks:", error)
				logAction("Error fetching tracks", {
					error: error instanceof Error ? error.message : "Unknown error",
				})
			} finally {
				setLoading(false)
			}
		}

		fetchTracks()
	}, [teamId, logAction])

	const handleTrackSelect = (trackId: string) => {
		setSelectedTrackId(trackId)
		onTrackSelected?.(trackId)
		logAction("Track selected", { trackId, teamId })
	}

	const handleCreateNewTrack = () => {
		logAction("Creating new track", { teamId })
		// TODO: Implement create new track modal
	}

	const handleManageTrack = (trackId: string) => {
		logAction("Managing track", { trackId, teamId })
		// TODO: Implement track management modal
	}

	if (loading) {
		return (
			<div
				className={`bg-white border-r border-gray-200 ${
					isCollapsed ? "w-12" : "w-80"
				} ${className}`}
			>
				<div className="p-4">
					<div className="animate-pulse">
						<div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
						<div className="h-4 bg-gray-200 rounded w-1/2" />
					</div>
				</div>
			</div>
		)
	}

	return (
		<div
			className={`bg-white border-r border-gray-200 transition-all duration-300 ${
				isCollapsed ? "w-12" : "w-80"
			} ${className}`}
		>
			{/* Header */}
			<div className="border-b border-gray-200 p-4 flex items-center justify-between">
				{!isCollapsed && (
					<div>
						<h2 className="text-lg font-semibold text-gray-900">Tracks</h2>
						<p className="text-sm text-gray-500">
							{tracks.length} active tracks
						</p>
					</div>
				)}
				<Button
					variant="ghost"
					size="sm"
					onClick={onToggleCollapsed}
					className="p-1 h-8 w-8"
					aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
				>
					{isCollapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<ChevronLeft className="h-4 w-4" />
					)}
				</Button>
			</div>

			{!isCollapsed && (
				<>
					{/* Quick Actions */}
					<div className="p-4 border-b border-gray-200">
						<Button onClick={handleCreateNewTrack} className="w-full" size="sm">
							<Plus className="h-4 w-4 mr-2" />
							New Track
						</Button>
					</div>

					{/* Track List */}
					<div className="flex-1 overflow-y-auto">
						<div className="p-4 space-y-4">
							{tracks.length === 0 ? (
								<div className="text-center py-8">
									<BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
									<p className="text-gray-500 text-sm">No tracks found</p>
									<Button
										variant="outline"
										size="sm"
										onClick={handleCreateNewTrack}
										className="mt-2"
									>
										Create your first track
									</Button>
								</div>
							) : (
								tracks.map((track) => (
									<Card
										key={track.id}
										className={`cursor-pointer transition-all hover:shadow-md ${
											selectedTrackId === track.id ? "ring-2 ring-blue-500" : ""
										}`}
										onClick={() => handleTrackSelect(track.id)}
									>
										<CardHeader className="pb-2">
											<div className="flex items-center justify-between">
												<CardTitle className="text-sm font-medium truncate">
													{track.name}
												</CardTitle>
												<Badge
													variant={track.isActive ? "default" : "secondary"}
												>
													{track.isActive ? "Active" : "Inactive"}
												</Badge>
											</div>
											{track.description && (
												<p className="text-xs text-gray-600 line-clamp-2">
													{track.description}
												</p>
											)}
										</CardHeader>
										<CardContent className="pt-0">
											{/* Progress */}{" "}
											<div className="space-y-2">
												<div className="flex items-center justify-between text-xs text-gray-600">
													<span>
														Week {track.currentWeek} of {track.totalWeeks}
													</span>
													<span>
														{Math.round(
															((track.currentWeek || 1) / track.totalWeeks) *
																100,
														)}
														%
													</span>
												</div>
												<div className="h-2 bg-gray-200 rounded-full overflow-hidden">
													<div
														className="h-full bg-blue-600 transition-all duration-300"
														style={{
															width: `${
																((track.currentWeek || 1) / track.totalWeeks) *
																100
															}%`,
														}}
													/>
												</div>
											</div>
											<Separator className="my-3" />
											{/* Stats */}
											<div className="flex items-center justify-between text-xs text-gray-600">
												<div className="flex items-center">
													<Users className="h-3 w-3 mr-1" />
													<span>{track.participantCount}</span>
												</div>
												<div className="flex items-center">
													<TrendingUp className="h-3 w-3 mr-1" />
													<span>{track.completionRate}%</span>
												</div>
											</div>
											{/* Actions */}
											<div className="flex mt-3 space-x-2">
												<Button
													variant="outline"
													size="sm"
													className="flex-1 text-xs"
													onClick={(e) => {
														e.stopPropagation()
														handleManageTrack(track.id)
													}}
												>
													<Settings className="h-3 w-3 mr-1" />
													Manage
												</Button>
												<Button
													variant="outline"
													size="sm"
													className="flex-1 text-xs"
													onClick={(e) => {
														e.stopPropagation()
														// TODO: View track analytics
														logAction("View track analytics", {
															trackId: track.id,
															teamId,
														})
													}}
												>
													<BarChart3 className="h-3 w-3 mr-1" />
													Stats
												</Button>
											</div>
										</CardContent>
									</Card>
								))
							)}
						</div>
					</div>
				</>
			)}

			{/* Collapsed State Icons */}
			{isCollapsed && (
				<div className="p-2 space-y-2">
					<Button
						variant="ghost"
						size="sm"
						className="w-full p-2 h-10"
						onClick={handleCreateNewTrack}
						title="New Track"
					>
						<Plus className="h-4 w-4" />
					</Button>
					{tracks.slice(0, 3).map((track) => (
						<Button
							key={track.id}
							variant="ghost"
							size="sm"
							className="w-full p-2 h-10"
							onClick={() => handleTrackSelect(track.id)}
							title={track.name}
						>
							<BarChart3 className="h-4 w-4" />
						</Button>
					))}
				</div>
			)}
		</div>
	)
}
