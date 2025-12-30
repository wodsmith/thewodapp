import { Link } from "@tanstack/react-router"
import {
	BarChart3,
	CheckCircle,
	Clock,
	Dumbbell,
	GitFork,
	Pencil,
	Repeat,
} from "lucide-react"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ListItem } from "@/components/ui/list-item"
import type { Workout } from "@/db/schemas/workouts"
import { cn } from "@/utils/cn"

// Result type matching the TodayScore interface from server-fns
type ResultSummary = {
	scoreId: string
	scoreValue: number | null
	displayScore: string
	scalingLabel: string | null
	asRx: boolean
	recordedAt: Date
} | null

// Source workout info for remix tracking
type SourceWorkoutInfo = {
	id: string
	name: string
} | null

// Minimal workout type for display purposes
type WorkoutDisplay = Pick<
	Workout,
	"id" | "name" | "description" | "scheme" | "scope"
> & {
	timeCap?: number | null
	movements?: Array<{ id: string; name: string }>
	tags?: Array<{ id: string; name: string }>
	sourceWorkoutId?: string | null
	sourceWorkout?: SourceWorkoutInfo
}

const SCHEME_CONFIG: Record<
	Workout["scheme"],
	{ icon: typeof Clock; label: string }
> = {
	time: { icon: Clock, label: "Time" },
	"time-with-cap": { icon: Clock, label: "Time with Cap" },
	emom: { icon: Clock, label: "EMOM" },
	"rounds-reps": { icon: Repeat, label: "Rounds/Reps" },
	load: { icon: Dumbbell, label: "Load" },
	reps: { icon: BarChart3, label: "Reps" },
	calories: { icon: BarChart3, label: "Calories" },
	meters: { icon: BarChart3, label: "Meters" },
	feet: { icon: BarChart3, label: "Feet" },
	points: { icon: BarChart3, label: "Points" },
	"pass-fail": { icon: CheckCircle, label: "Pass/Fail" },
}

function SchemeIcon({
	scheme,
	className,
}: {
	scheme: Workout["scheme"]
	className?: string
}): ReactElement {
	const Icon = SCHEME_CONFIG[scheme].icon
	return <Icon className={cn("size-5", className)} />
}

interface WorkoutRowCardProps {
	workout: WorkoutDisplay
	result?: ResultSummary
}

export default function WorkoutRowCard({
	workout,
	result,
}: WorkoutRowCardProps) {
	return (
		<ListItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start">
			<ListItem.Content className="flex-1 min-w-0 w-full">
				<div className="flex items-center gap-2">
					<SchemeIcon scheme={workout.scheme} />
					<HoverCard openDelay={200} closeDelay={100}>
						<HoverCardTrigger asChild>
							<Link
								to="/workouts/$workoutId"
								params={{ workoutId: workout.id }}
							>
								<p className="font-semibold underline-offset-4 hover:underline text-left text-balance max-w-[300px]">
									{workout.name}
								</p>
							</Link>
						</HoverCardTrigger>
						<HoverCardContent
							className="w-80 max-h-80 overflow-y-auto"
							align="start"
						>
							<div className="space-y-3">
								<div>
									<h4 className="font-semibold">{workout.name}</h4>
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="outline" className="text-xs">
											{SCHEME_CONFIG[workout.scheme].label}
										</Badge>
										{workout.timeCap && (
											<span className="text-xs text-muted-foreground">
												{workout.timeCap} min cap
											</span>
										)}
									</div>
								</div>

								{workout.description && (
									<div>
										<p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
											{workout.description}
										</p>
									</div>
								)}

								{workout.movements && workout.movements.length > 0 && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Movements
										</p>
										<div className="flex flex-wrap gap-1">
											{workout.movements.map((movement) => (
												<Badge
													key={movement.id}
													variant="secondary"
													className="text-xs"
												>
													{movement.name}
												</Badge>
											))}
										</div>
									</div>
								)}

								{result && (
									<div className="border-t pt-2">
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Today's Score
										</p>
										<div className="flex items-center gap-2">
											<span className="font-semibold text-sm">
												{result.displayScore}
											</span>
											{result.scalingLabel ? (
												<Badge
													variant={result.asRx ? "default" : "secondary"}
													className="text-xs"
												>
													{result.scalingLabel}
												</Badge>
											) : (
												<Badge
													variant={result.asRx ? "default" : "secondary"}
													className="text-xs"
												>
													{result.asRx ? "Rx" : "Scaled"}
												</Badge>
											)}
										</div>
									</div>
								)}
							</div>
						</HoverCardContent>
					</HoverCard>
					{/* Remix indicator */}
					{(workout.sourceWorkoutId || workout.sourceWorkout) && (
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<GitFork className="h-3 w-3" />
							{workout.sourceWorkout ? (
								<Link
									to="/workouts/$workoutId"
									params={{ workoutId: workout.sourceWorkout.id }}
									className="hover:underline"
								>
									Remixed from {workout.sourceWorkout.name}
								</Link>
							) : (
								<span>Remixed</span>
							)}
						</div>
					)}
				</div>
				{/* Movements and Tags badges */}
				{((workout.movements && workout.movements.length > 0) ||
					(workout.tags && workout.tags.length > 0)) && (
					<div className="flex flex-wrap gap-1.5 mt-2">
						{/* Movements badges - show first 3 with +N more */}
						{workout.movements && workout.movements.length > 0 && (
							<>
								{workout.movements.slice(0, 3).map((movement) => (
									<Badge
										key={movement.id}
										variant="outline"
										className="text-xs"
									>
										{movement.name}
									</Badge>
								))}
								{workout.movements.length > 3 && (
									<Badge variant="outline" className="text-xs">
										+{workout.movements.length - 3} more
									</Badge>
								)}
							</>
						)}
						{/* Tags badges */}
						{workout.tags?.map((tag) => (
							<Badge key={tag.id} variant="secondary" className="text-xs">
								{tag.name}
							</Badge>
						))}
					</div>
				)}
			</ListItem.Content>

			<ListItem.Actions className="w-full sm:w-auto">
				<div className="flex flex-col gap-2 items-end w-full">
					{/* Today's result display */}
					{result && (
						<div className="flex items-center gap-2 text-sm">
							<span className="font-semibold">{result.displayScore}</span>
							{/* Display custom scaling label if available */}
							{result.scalingLabel ? (
								<Badge variant={result.asRx ? "default" : "secondary"}>
									{result.scalingLabel}
									{result.asRx ? " (Rx)" : " (Scaled)"}
								</Badge>
							) : result.asRx !== undefined ? (
								<Badge variant={result.asRx ? "default" : "secondary"}>
									{result.asRx ? "Rx" : "Scaled"}
								</Badge>
							) : null}
						</div>
					)}

					<div className="flex items-center gap-2 w-full sm:w-auto">
						<Badge variant="secondary">
							{SCHEME_CONFIG[workout.scheme].label}
						</Badge>
						{/* Edit button when result exists */}
						{result && (
							<Button asChild size="sm" variant="outline">
								<Link to="/log/$id/edit" params={{ id: result.scoreId }}>
									<Pencil className="h-4 w-4 mr-1" />
									Edit
								</Link>
							</Button>
						)}
						<Button
							asChild
							size="sm"
							variant="secondary"
							className="flex-1 sm:flex-initial"
						>
							<Link to="/log/new" search={{ workoutId: workout.id }}>
								{result ? "Log Another" : "Log Result"}
							</Link>
						</Button>
					</div>
				</div>
			</ListItem.Actions>
		</ListItem>
	)
}
