"use client"

import {
	ArrowPathIcon,
	BoltIcon,
	ChartBarIcon,
	ClockIcon,
	FireIcon,
} from "@heroicons/react/24/outline"
import Link from "next/link"
import type * as React from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card"
import { ListItem } from "~/components/ui/list-item"
import { cn } from "~/lib/utils"
import type { Movement, Tag, Workout } from "~/types"

// Helper function to remove empty lines from markdown text
function removeEmptyLines(text: string): string {
	return text
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.join("\n")
}

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

type ResultSummary = {
	id: string
	date: Date
	wodScore: string | null
	scale: string | null
	scalingLevelLabel?: string
	scalingLevelPosition?: number
	asRx?: boolean
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
	result?: ResultSummary | null
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
		<ListItem className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start">
			<ListItem.Content className="flex-1 min-w-0 w-full">
				<Link href={`/workouts/${workout.id}`}>
					<div className="space-y-2">
						<div className="flex items-center gap-2">
							<SchemeIcon scheme={workout.scheme} />
							<HoverCard>
								<HoverCardTrigger asChild>
									<p className="font-semibold underline-offset-4 hover:underline text-left text-balance max-w-[300px]">
										{workout.name}
									</p>
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
												<span className="text-sm font-medium text-orange-800 dark:text-orange-200">
													This is a remix
												</span>
											</div>
											<p className="text-sm text-orange-700 dark:text-orange-300">
												Based on{" "}
												<Link
													href={`/workouts/${workout.sourceWorkout.id}`}
													className="font-semibold underline hover:no-underline"
													onClick={(e: React.MouseEvent) => e.stopPropagation()}
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
										{workout.description
											? removeEmptyLines(workout.description)
											: "No description available."}
									</p>
								</HoverCardContent>
							</HoverCard>
						</div>
						{workout.description && (
							<div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap text-left">
								{removeEmptyLines(workout.description)}
							</div>
						)}
					</div>
				</Link>
			</ListItem.Content>

			<div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-shrink-0 w-full sm:w-auto">
				<div className="hidden md:flex items-center gap-2 flex-nowrap flex-shrink-0">
					{(() => {
						const allTags = [
							...displayMovements
								.filter((movement) => movement !== undefined)
								.map((movement) => ({
									id: movement.id,
									name: movement.name,
									type: "movement" as const,
								})),
							...displayTags.map((tag) => ({
								id: tag.id,
								name: tag.name,
								type: "tag" as const,
							})),
						]
						const visibleTags = allTags.slice(0, 3)
						const remainingCount = allTags.length - 3

						return (
							<>
								{visibleTags.map((tag) =>
									tag.type === "movement" ? (
										<Link
											href={`/movements/${tag.id}`}
											key={tag.id}
											className="flex-shrink-0"
										>
											<Badge variant="secondary" clickable>
												{tag.name}
											</Badge>
										</Link>
									) : (
										<Badge
											key={tag.id}
											variant="outline"
											className="flex-shrink-0"
										>
											{tag.name}
										</Badge>
									),
								)}
								{remainingCount > 0 && (
									<HoverCard>
										<HoverCardTrigger asChild>
											<Badge
												variant="outline"
												className="cursor-default text-muted-foreground flex-shrink-0"
											>
												+{remainingCount}
											</Badge>
										</HoverCardTrigger>
										<HoverCardContent className="w-auto p-2">
											<div className="flex flex-wrap gap-1 max-w-xs">
												{allTags.slice(3).map((tag) =>
													tag.type === "movement" ? (
														<Link href={`/movements/${tag.id}`} key={tag.id}>
															<Badge variant="secondary" clickable>
																{tag.name}
															</Badge>
														</Link>
													) : (
														<Badge key={tag.id} variant="outline">
															{tag.name}
														</Badge>
													),
												)}
											</div>
										</HoverCardContent>
									</HoverCard>
								)}
							</>
						)
					})()}
				</div>

				<ListItem.Actions className="w-full sm:w-auto">
					<div className="flex flex-col gap-2 items-end w-full">
						{displayResult && (
							<div className="flex items-center gap-2 text-sm">
								<span className="font-semibold">{displayResult.wodScore}</span>
								{/* Display custom scaling label if available, otherwise fall back to legacy scale */}
								{displayResult.scalingLevelLabel ? (
									<Badge variant={displayResult.asRx ? "default" : "secondary"}>
										{displayResult.scalingLevelLabel}
										{displayResult.asRx ? " (Rx)" : " (Scaled)"}
									</Badge>
								) : displayResult.scale ? (
									(() => {
										const badgeVariant: "rx" | "rx+" | "scaled" | "secondary" =
											displayResult.scale === "rx" ||
											displayResult.scale === "rx+" ||
											displayResult.scale === "scaled"
												? (displayResult.scale as "rx" | "rx+" | "scaled")
												: "secondary"
										return (
											<Badge variant={badgeVariant}>
												{displayResult.scale.toUpperCase()}
											</Badge>
										)
									})()
								) : null}
							</div>
						)}
						<div className="flex items-center gap-2 w-full sm:w-auto">
							{workout.sourceWorkout && (
								<Badge
									variant="secondary"
									className="bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-200 dark:border-orange-700"
								>
									Remix
								</Badge>
							)}
							<Button
								asChild
								size="sm"
								variant="secondary"
								className="flex-1 sm:flex-initial"
							>
								<Link
									href={{
										pathname: "/log/new",
										query: {
											workoutId: workout.id,
											redirectUrl: "/workouts",
										},
									}}
								>
									{displayResult ? "Log Another" : "Log Result"}
								</Link>
							</Button>
						</div>
					</div>
				</ListItem.Actions>
			</div>
		</ListItem>
	)
}
