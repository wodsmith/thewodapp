"use client"

import { Link } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ChevronDown, ChevronUp, Copy, GitFork, Loader2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
	getRemixedWorkoutsFn,
	type RemixedWorkout,
	type SourceWorkout,
} from "@/server-fns/workout-remix-fns"

interface WorkoutRemixInfoProps {
	workoutId: string
	teamId: string | undefined
	sourceWorkout: SourceWorkout | null
	remixCount: number
}

/**
 * Component that displays remix information for a workout:
 * - Shows "Remixed from [Original]" link if this workout is a remix
 * - Shows remix count with expandable list of remixes
 * - Provides "Remix this workout" button that navigates to the create form
 */
export function WorkoutRemixInfo({
	workoutId,
	teamId,
	sourceWorkout,
	remixCount,
}: WorkoutRemixInfoProps) {
	const [isRemixListOpen, setIsRemixListOpen] = useState(false)
	const [remixes, setRemixes] = useState<RemixedWorkout[]>([])
	const [isLoadingRemixes, setIsLoadingRemixes] = useState(false)

	// Use server functions with useServerFn hook for client-side calls
	const getRemixes = useServerFn(getRemixedWorkoutsFn)

	const handleToggleRemixList = async () => {
		if (!isRemixListOpen && remixes.length === 0 && remixCount > 0) {
			// Load remixes when opening for the first time
			setIsLoadingRemixes(true)
			try {
				const result = await getRemixes({
					data: { sourceWorkoutId: workoutId },
				})
				setRemixes(result.remixes)
			} catch (error) {
				console.error("Failed to load remixes:", error)
			} finally {
				setIsLoadingRemixes(false)
			}
		}
		setIsRemixListOpen(!isRemixListOpen)
	}

	return (
		<div className="border-2 border-border rounded-lg p-6">
			<div className="flex items-center gap-2 mb-4">
				<GitFork className="h-5 w-5" />
				<h2 className="text-lg font-semibold">REMIX INFO</h2>
			</div>

			<div className="space-y-4">
				{/* Source Workout Link (if this is a remix) */}
				{sourceWorkout && (
					<div className="flex items-center gap-2 text-sm">
						<Copy className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">Remixed from</span>
						<Link
							to="/workouts/$workoutId"
							params={{ workoutId: sourceWorkout.id }}
							className="font-medium text-primary hover:underline"
						>
							{sourceWorkout.name}
						</Link>
						{sourceWorkout.teamName && (
							<Badge variant="secondary" className="text-xs">
								{sourceWorkout.teamName}
							</Badge>
						)}
					</div>
				)}

				{/* Remix Count and List */}
				{remixCount > 0 && (
					<Collapsible
						open={isRemixListOpen}
						onOpenChange={handleToggleRemixList}
					>
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								className="flex items-center gap-2 p-0 h-auto hover:bg-transparent"
								onClick={handleToggleRemixList}
							>
								<GitFork className="h-4 w-4 text-muted-foreground" />
								<span className="text-sm">
									{remixCount} {remixCount === 1 ? "remix" : "remixes"}
								</span>
								{isRemixListOpen ? (
									<ChevronUp className="h-4 w-4" />
								) : (
									<ChevronDown className="h-4 w-4" />
								)}
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2">
							{isLoadingRemixes ? (
								<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
									<Loader2 className="h-4 w-4 animate-spin" />
									Loading remixes...
								</div>
							) : (
								<div className="space-y-2 pl-6">
									{remixes.map((remix) => (
										<div
											key={remix.id}
											className="flex items-center gap-2 text-sm"
										>
											<Link
												to="/workouts/$workoutId"
												params={{ workoutId: remix.id }}
												className="font-medium text-primary hover:underline"
											>
												{remix.name}
											</Link>
											<Badge variant="secondary" className="text-xs">
												{remix.teamName}
											</Badge>
											<Badge variant="outline" className="text-xs">
												{remix.scope}
											</Badge>
										</div>
									))}
								</div>
							)}
						</CollapsibleContent>
					</Collapsible>
				)}

				{/* No remixes message */}
				{remixCount === 0 && !sourceWorkout && (
					<p className="text-sm text-muted-foreground">
						This workout has not been remixed yet.
					</p>
				)}

				{/* Remix Button - navigates to create form with pre-filled data */}
				{teamId && (
					<Button variant="outline" className="w-full sm:w-auto" asChild>
						<Link to="/workouts/new" search={{ remixFrom: workoutId }}>
							<GitFork className="h-4 w-4 mr-2" />
							Remix this workout
						</Link>
					</Button>
				)}
			</div>
		</div>
	)
}
