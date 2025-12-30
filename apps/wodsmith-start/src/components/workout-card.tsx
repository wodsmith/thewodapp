"use client"

import { Link } from "@tanstack/react-router"
import { Dumbbell, GitFork, Tag as TagIcon, Target } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { DivisionDescription } from "@/server-fns/competition-workouts-fns"

// Source workout info for remix tracking
type SourceWorkoutInfo = {
	id: string
	name: string
} | null

interface WorkoutCardProps {
	trackOrder: number
	name: string
	scheme: string
	description: string | null
	scoreType: string | null
	roundsToScore: number | null
	pointsMultiplier: number | null
	notes: string | null
	movements?: Array<{ id: string; name: string }>
	tags?: Array<{ id: string; name: string }>
	divisionDescriptions: DivisionDescription[]
	sponsorName?: string
	sponsorLogoUrl?: string | null
	// Remix tracking
	sourceWorkoutId?: string | null
	sourceWorkout?: SourceWorkoutInfo
}

export function WorkoutCard({
	trackOrder,
	name,
	scheme,
	description,
	scoreType,
	roundsToScore,
	pointsMultiplier,
	sourceWorkoutId,
	sourceWorkout,
	notes,
	movements,
	tags,
	divisionDescriptions,
	sponsorName,
	sponsorLogoUrl: _sponsorLogoUrl,
}: WorkoutCardProps) {
	// Sort divisions by position and filter to only those with custom descriptions
	const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)
	const divisionsWithDescriptions = sortedDivisions.filter(
		(d) => d.description && d.description.trim() !== "",
	)
	const hasDivisionDescriptions = divisionsWithDescriptions.length > 0

	// Find RX division (position 0 is typically RX/hardest)
	const rxDivision = sortedDivisions.find((d) => d.position === 0)
	const rxDescription = rxDivision?.description

	// Default tab: first division with a description, or "default" if none
	const getDefaultTab = () => {
		const firstDivision = divisionsWithDescriptions[0]
		if (firstDivision) {
			return firstDivision.divisionId
		}
		return "default"
	}
	const [selectedTab, setSelectedTab] = useState(getDefaultTab)

	// Get the description to display based on selected tab
	const getDisplayDescription = () => {
		if (selectedTab === "default") {
			// Show RX description if available, otherwise fall back to base description
			return rxDescription || description
		}
		const divisionDesc = divisionDescriptions.find(
			(d) => d.divisionId === selectedTab,
		)
		return divisionDesc?.description || description
	}

	// Default display: RX description if available, otherwise base description
	const displayDescription = hasDivisionDescriptions
		? getDisplayDescription()
		: rxDescription || description

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
							{trackOrder}
						</div>
						<div>
							<CardTitle className="text-xl">{name}</CardTitle>
							{scheme && (
								<CardDescription className="mt-1">{scheme}</CardDescription>
							)}
							{/* Remix indicator */}
							{(sourceWorkoutId || sourceWorkout) && (
								<div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
									<GitFork className="h-3 w-3" />
									{sourceWorkout ? (
										<Link
											to="/workouts/$workoutId"
											params={{ workoutId: sourceWorkout.id }}
											className="hover:underline"
											onClick={(e) => e.stopPropagation()}
										>
											Remixed from {sourceWorkout.name}
										</Link>
									) : (
										<span>Remixed</span>
									)}
								</div>
							)}
						</div>
					</div>
					<div className="flex items-center gap-2">
						{sponsorName && (
							<span className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-3 py-1 rounded-full font-medium">
								Presented by {sponsorName}
							</span>
						)}
						{pointsMultiplier && pointsMultiplier !== 100 && (
							<span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
								{pointsMultiplier / 100}x points
							</span>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{/* Division selector tabs - only show if there are multiple division descriptions */}
				{divisionsWithDescriptions.length > 1 && (
					<Tabs
						value={selectedTab}
						onValueChange={setSelectedTab}
						className="mb-4"
					>
						<TabsList className="w-fit justify-start flex-wrap h-auto gap-1">
							{divisionsWithDescriptions.map((division) => (
								<TabsTrigger
									key={division.divisionId}
									value={division.divisionId}
									className="text-xs"
								>
									{division.divisionLabel}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				)}

				{displayDescription ? (
					<p className="text-muted-foreground whitespace-pre-wrap">
						{displayDescription}
					</p>
				) : (
					<p className="text-muted-foreground italic">
						Workout details will be released soon.
					</p>
				)}

				{/* Movements */}
				{movements && movements.length > 0 && (
					<div className="mt-4">
						<h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
							<Dumbbell className="h-4 w-4" />
							Movements
						</h4>
						<div className="flex flex-wrap gap-2">
							{movements.map((movement) => (
								<Badge key={movement.id} variant="outline">
									{movement.name}
								</Badge>
							))}
						</div>
					</div>
				)}

				{/* Tags */}
				{tags && tags.length > 0 && (
					<div className="mt-4">
						<h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
							<TagIcon className="h-4 w-4" />
							Tags
						</h4>
						<div className="flex flex-wrap gap-2">
							{tags.map((tag) => (
								<Badge key={tag.id} variant="secondary">
									{tag.name}
								</Badge>
							))}
						</div>
					</div>
				)}

				{notes && (
					<div className="mt-4 pt-4 border-t">
						<p className="text-sm text-muted-foreground">
							<strong>Notes:</strong> {notes}
						</p>
					</div>
				)}

				<div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
					<div className="flex items-center gap-1">
						<Target className="h-4 w-4" />
						<span className="capitalize">{scoreType || "Time"}</span>
					</div>
					{roundsToScore && (
						<div>
							<strong>Rounds to Score:</strong> {roundsToScore}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	)
}
