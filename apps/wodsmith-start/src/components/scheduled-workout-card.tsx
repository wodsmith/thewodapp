import { Link } from "@tanstack/react-router"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface ScheduledWorkoutWithResult {
	id: string
	scheduledDate: Date
	workout: {
		id: string
		name: string
		description: string | null
		scheme: string
	} | null
	result: {
		scoreValue: number | null
		displayScore: string
		scalingLabel: string | null
		asRx: boolean
		recordedAt: Date
	} | null
}

interface ScheduledWorkoutCardProps {
	workoutData: ScheduledWorkoutWithResult
	classTimes?: string
	teamNotes?: string
	scalingGuidance?: string
}

export function ScheduledWorkoutCard({
	workoutData,
	classTimes,
	teamNotes,
	scalingGuidance,
}: ScheduledWorkoutCardProps) {
	const { workout, result } = workoutData

	if (!workout) {
		return null
	}

	return (
		<Card className="border-2 border-black dark:border-dark-border bg-background/10 dark:bg-white/10">
			<CardContent className="p-6">
				<div className="flex flex-col w-full h-full items-start">
					<div className="flex-1 text-left w-full">
						<Link to="/workouts/$workoutId" params={{ workoutId: workout.id }}>
							<h4 className="font-bold hover:underline text-left text-2xl mb-3 leading-tight">
								{workout.name}
							</h4>
						</Link>

						{classTimes && (
							<div className="flex items-center gap-2 text-muted-foreground mb-4 text-base">
								<svg
									className="h-4 w-4"
									fill="none"
									viewBox="0 0 24 24"
									strokeWidth={1.5}
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
									/>
								</svg>
								<span>{classTimes}</span>
							</div>
						)}

						{workout.scheme && (
							<div className="mb-4 flex justify-start">
								<Badge variant="default" className="px-3 py-2">
									<p className="font-bold text-sm uppercase tracking-wide">
										{workout.scheme}
									</p>
								</Badge>
							</div>
						)}

						{workout.description && (
							<p className="text-muted-foreground mb-3 text-left text-base whitespace-pre-wrap line-clamp-[12]">
								{workout.description}
							</p>
						)}

						{teamNotes && (
							<div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20 pl-4 py-3 mb-4">
								<p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1 text-left">
									Team Notes
								</p>
								<p className="text-base text-left">{teamNotes}</p>
							</div>
						)}

						{scalingGuidance && (
							<div className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20 pl-4 py-3 mb-4">
								<p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1 text-left">
									Scaling Options
								</p>
								<p className="text-base text-left">{scalingGuidance}</p>
							</div>
						)}
					</div>

					<div className="w-full mt-6 pt-4 border-t border-black/10 dark:border-white/10 flex flex-col items-start">
						{result ? (
							<div className="space-y-3 w-full">
								<div className="bg-green-50 dark:bg-green-950/20 border-2 border-green-500 p-4 w-full">
									<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
										<div className="text-left">
											<p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">
												Result Logged
											</p>
											<p className="text-lg font-bold">
												{result.displayScore || "Completed"}
											</p>
											{result.asRx && (
												<Badge variant="rx" className="mt-1">
													RX
												</Badge>
											)}
											{!result.asRx && result.scalingLabel && (
												<Badge variant="scaled" className="mt-1">
													{result.scalingLabel}
												</Badge>
											)}
										</div>
									</div>
								</div>
								<Button
									asChild
									variant="default"
									size="default"
									className="w-full sm:w-auto sm:self-start"
								>
									<Link to="/log/new" search={{ workoutId: workout.id }}>
										Log Another Result
									</Link>
								</Button>
							</div>
						) : (
							<Button
								asChild
								variant="default"
								size="default"
								className="w-full sm:w-auto"
							>
								<Link to="/log/new" search={{ workoutId: workout.id }}>
									Log Result
								</Link>
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}
