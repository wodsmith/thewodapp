import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@/components/ui/hover-card"
import { ListItem } from "@/components/ui/list-item"
import { cn } from "@/lib/utils"
import type { Movement, Tag, Workout, WorkoutResult } from "@/types"
import {
	ArrowPathIcon,
	BoltIcon,
	ChartBarIcon,
	ClockIcon,
	FireIcon,
} from "@heroicons/react/24/outline"
import Link from "next/link"
import type * as React from "react"

const SCHEME_MAP: Record<Workout["scheme"], React.ElementType> = {
	time: ClockIcon,
	points: FireIcon,
	"time-with-cap": ClockIcon,
	"pass-fail": BoltIcon,
	"rounds-reps": ArrowPathIcon,
	reps: ChartBarIcon,
	emom: ClockIcon,
	load: FireIcon,
	calories: FireIcon,
	meters: ChartBarIcon,
	feet: ChartBarIcon,
}

const SCHEME_TO_LABEL: Record<Workout["scheme"], string> = {
	time: "Time",
	points: "Points",
	"time-with-cap": "Time with Cap",
	"pass-fail": "Pass/Fail",
	"rounds-reps": "Rounds/Reps",
	reps: "Reps",
	emom: "EMOM",
	load: "Load",
	calories: "Calories",
	meters: "Meters",
	feet: "Feet",
}

function SchemeIcon({
	scheme,
	className,
}: {
	scheme: Workout["scheme"]
	className?: string
}) {
	const Icon = SCHEME_MAP[scheme]
	return (
		<HoverCard>
			<HoverCardTrigger asChild>
				<Icon className={cn("size-5", className)} />
			</HoverCardTrigger>
			<HoverCardContent className="w-full">
				<p>{SCHEME_TO_LABEL[scheme]}</p>
			</HoverCardContent>
		</HoverCard>
	)
}

interface WorkoutRowCardProps {
	workout: Workout
	movements?: Pick<Movement, "id" | "name">[]
	tags?: Pick<Tag, "id" | "name">[]
	result?: WorkoutResult
}

export default function WorkoutRowCard({
	workout,
	movements,
	tags,
	result,
}: WorkoutRowCardProps) {
	const displayMovements = movements ?? []
	const displayTags = tags ?? []
	const displayResult = result ?? null

	return (
		<ListItem>
			<ListItem.Content>
				<Link href={`/workouts/${workout.id}`}>
					<div className="flex items-center gap-2">
						<SchemeIcon scheme={workout.scheme} />
						<HoverCard>
							<HoverCardTrigger asChild>
								<p className="font-semibold underline-offset-4 hover:underline">
									{workout.name}
								</p>
							</HoverCardTrigger>
							<HoverCardContent className="w-full">
								<div className="flex items-center gap-1 mb-1">
									<SchemeIcon scheme={workout.scheme} className="size-4" />{" "}
									<span className="text-sm">
										{SCHEME_TO_LABEL[workout.scheme]}
									</span>
								</div>
								<p className="whitespace-pre-wrap text-sm">
									{workout.description || "No description available."}
								</p>
							</HoverCardContent>
						</HoverCard>
					</div>
				</Link>
			</ListItem.Content>

			<div className="flex items-center gap-4">
				<ListItem.Meta>
					{displayMovements.map(
						(movement) =>
							movement && (
								<Link href={`/movements/${movement.id}`} key={movement.id}>
									<Badge variant="secondary" clickable>
										{movement.name}
									</Badge>
								</Link>
							),
					)}
					{displayTags.map((tag) => (
						<Badge key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}
				</ListItem.Meta>

				<ListItem.Actions>
					{displayResult && (
						<div className="flex items-center gap-2 text-sm">
							<span className="font-semibold">{displayResult.wodScore}</span>
							{displayResult.scale && (
								<Badge variant={displayResult.scale}>
									{displayResult.scale.toUpperCase()}
								</Badge>
							)}
						</div>
					)}
					<Button asChild size="sm" variant="secondary">
						<Link
							href={{
								pathname: "/log/new",
								query: {
									workoutId: workout.id,
									redirectUrl: "/workouts",
								},
							}}
						>
							Log Result
						</Link>
					</Button>
				</ListItem.Actions>
			</div>
		</ListItem>
	)
}
