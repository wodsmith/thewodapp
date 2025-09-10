"use client"

import {
	ArrowPathIcon,
	BoltIcon,
	ChartBarIcon,
	ClockIcon,
	FireIcon,
	ArrowRightIcon,
} from "@heroicons/react/24/outline"
import Link from "next/link"
import type * as React from "react"
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

const SCHEME_CONFIG: Record<
	Workout["scheme"],
	{ icon: React.ElementType; label: string }
> = {
	time: { icon: ClockIcon, label: "Time" },
	points: { icon: FireIcon, label: "Points" },
	"time-with-cap": { icon: ClockIcon, label: "Time with Cap" },
	"pass-fail": { icon: BoltIcon, label: "Pass/Fail" },
	"rounds-reps": { icon: ArrowPathIcon, label: "Rounds/Reps" },
	reps: { icon: ChartBarIcon, label: "Reps" },
	emom: { icon: ClockIcon, label: "EMOM" },
	load: { icon: FireIcon, label: "Load" },
	calories: { icon: FireIcon, label: "Calories" },
	meters: { icon: ChartBarIcon, label: "Meters" },
	feet: { icon: ChartBarIcon, label: "Feet" },
}

function SchemeIcon({
	scheme,
	className,
}: {
	scheme: Workout["scheme"]
	className?: string
}) {
	const Icon = SCHEME_CONFIG[scheme].icon
	return (
		<HoverCard>
			<HoverCardTrigger asChild>
				<Icon className={cn("size-5", className)} />
			</HoverCardTrigger>
			<HoverCardContent className="w-full">
				<p>{SCHEME_CONFIG[scheme].label}</p>
			</HoverCardContent>
		</HoverCard>
	)
}

interface WorkoutRowCardProps {
	workout: Workout & {
		sourceWorkout?: {
			id: string
			name: string
			teamName?: string
		} | null
		remixCount?: number
	}
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
								<div className="flex items-center gap-2">
									<p className="font-semibold underline-offset-4 hover:underline">
										{workout.name}
									</p>
									{workout.sourceWorkout && (
										<Badge
											variant="secondary"
											className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700"
										>
											<ArrowRightIcon className="w-3 h-3 mr-1" />
											Remix
										</Badge>
									)}
								</div>
							</HoverCardTrigger>
							<HoverCardContent className="w-full">
								<div className="flex items-center gap-1 mb-1">
									<SchemeIcon scheme={workout.scheme} className="size-4" />{" "}
									<span className="text-sm">
										{SCHEME_CONFIG[workout.scheme].label}
									</span>
								</div>
								{workout.sourceWorkout && (
									<div className="mb-2 p-2 bg-orange-50 rounded-md border border-orange-200 dark:bg-orange-950 dark:border-orange-700">
										<div className="flex items-center gap-1 mb-1">
											<ArrowRightIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
											<span className="text-sm font-medium text-orange-800 dark:text-orange-200">
												This is a remix
											</span>
										</div>
										<p className="text-sm text-orange-700 dark:text-orange-300">
											Based on{" "}
											<Link
												href={`/workouts/${workout.sourceWorkout.id}`}
												className="font-semibold underline hover:no-underline"
												onClick={(e) => e.stopPropagation()}
											>
												"{workout.sourceWorkout.name}"
											</Link>
											{workout.sourceWorkout.teamName && (
												<span> by {workout.sourceWorkout.teamName}</span>
											)}
										</p>
									</div>
								)}
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
					{displayMovements
						.filter((movement) => movement !== undefined)
						.map((movement) => (
							<Link href={`/movements/${movement.id}`} key={movement.id}>
								<Badge variant="secondary" clickable>
									{movement.name}
								</Badge>
							</Link>
						))}

					{displayTags.map((tag) => (
						<Badge key={tag.id} variant="outline">
							{tag.name}
						</Badge>
					))}

					{/* Remix count indicator for original workouts */}
					{workout.remixCount && workout.remixCount > 0 && (
						<Badge
							variant="outline"
							className="text-xs text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-600"
							title={`${workout.remixCount} remix${workout.remixCount === 1 ? "" : "es"} of this workout`}
						>
							{workout.remixCount} remix{workout.remixCount === 1 ? "" : "es"}
						</Badge>
					)}
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
