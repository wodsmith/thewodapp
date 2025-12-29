import { Link } from "@tanstack/react-router"
import {
	BarChart3,
	CheckCircle,
	Clock,
	Dumbbell,
	Info,
	Repeat,
} from "lucide-react"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ListItem } from "@/components/ui/list-item"
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover"
import type { Workout } from "@/db/schemas/workouts"
import { cn } from "@/utils/cn"

// Minimal workout type for display purposes
type WorkoutDisplay = Pick<
	Workout,
	"id" | "name" | "description" | "scheme" | "scope"
>

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
}

export default function WorkoutRowCard({ workout }: WorkoutRowCardProps) {
	return (
		<ListItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start">
			<ListItem.Content className="flex-1 min-w-0 w-full">
				<div className="flex items-center gap-2">
					<SchemeIcon scheme={workout.scheme} />
					<Link to="/workouts/$workoutId" params={{ workoutId: workout.id }}>
						<p className="font-semibold underline-offset-4 hover:underline text-left text-balance max-w-[300px]">
							{workout.name}
						</p>
					</Link>
					{workout.description && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-6 w-6 text-muted-foreground hover:text-foreground"
								>
									<Info className="h-4 w-4" />
									<span className="sr-only">View description</span>
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-80 max-h-64 overflow-y-auto"
								align="start"
							>
								<div className="space-y-2">
									<h4 className="font-semibold">{workout.name}</h4>
									<p className="text-sm text-muted-foreground whitespace-pre-wrap">
										{workout.description}
									</p>
								</div>
							</PopoverContent>
						</Popover>
					)}
				</div>
			</ListItem.Content>

			<ListItem.Actions className="w-full sm:w-auto">
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<Badge variant="secondary">
						{SCHEME_CONFIG[workout.scheme].label}
					</Badge>
					<Button
						asChild
						size="sm"
						variant="secondary"
						className="flex-1 sm:flex-initial"
					>
						<Link to="/log/new" search={{ workoutId: workout.id }}>
							Log Result
						</Link>
					</Button>
				</div>
			</ListItem.Actions>
		</ListItem>
	)
}
