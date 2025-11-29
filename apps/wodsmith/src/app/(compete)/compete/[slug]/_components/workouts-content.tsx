import { Dumbbell, Tag as TagIcon, Target } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"
import { getCompetitionWorkouts } from "@/server/competition-workouts"

interface WorkoutsContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
}

export async function WorkoutsContent({ competition }: WorkoutsContentProps) {
	const events = await getCompetitionWorkouts(competition.id)

	if (events.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl">
					<h2 className="text-2xl font-bold mb-6">Workouts</h2>

					<Alert variant="default" className="border-dashed">
						<Dumbbell className="h-4 w-4" />
						<AlertTitle>Workouts not yet released</AlertTitle>
						<AlertDescription>
							Competition workouts will be announced closer to the event.
							Check back soon or follow the event organizer for updates.
						</AlertDescription>
					</Alert>
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<h2 className="text-2xl font-bold mb-6">
					Workouts
					<span className="text-muted-foreground font-normal text-lg ml-2">
						({events.length} event{events.length !== 1 ? "s" : ""})
					</span>
				</h2>

				<div className="space-y-4">
					{events.map((event) => (
						<Card key={event.id}>
							<CardHeader className="pb-3">
								<div className="flex items-start justify-between">
									<div className="flex items-center gap-3">
										<div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
											{event.trackOrder}
										</div>
										<div>
											<CardTitle className="text-xl">{event.workout.name}</CardTitle>
											{event.workout.scheme && (
												<CardDescription className="mt-1">
													{event.workout.scheme}
												</CardDescription>
											)}
										</div>
									</div>
									{event.pointsMultiplier && event.pointsMultiplier !== 100 && (
										<span className="text-sm bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">
											{event.pointsMultiplier / 100}x points
										</span>
									)}
								</div>
							</CardHeader>
							<CardContent>
								{event.workout.description ? (
									<p className="text-muted-foreground whitespace-pre-wrap">
										{event.workout.description}
									</p>
								) : (
									<p className="text-muted-foreground italic">
										Workout details will be released soon.
									</p>
								)}

								{/* Movements */}
								{event.workout.movements && event.workout.movements.length > 0 && (
									<div className="mt-4">
										<h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
											<Dumbbell className="h-4 w-4" />
											Movements
										</h4>
										<div className="flex flex-wrap gap-2">
											{event.workout.movements.map((movement) => (
												<Badge key={movement.id} variant="outline">
													{movement.name}
												</Badge>
											))}
										</div>
									</div>
								)}

								{/* Tags */}
								{event.workout.tags && event.workout.tags.length > 0 && (
									<div className="mt-4">
										<h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
											<TagIcon className="h-4 w-4" />
											Tags
										</h4>
										<div className="flex flex-wrap gap-2">
											{event.workout.tags.map((tag) => (
												<Badge key={tag.id} variant="secondary">
													{tag.name}
												</Badge>
											))}
										</div>
									</div>
								)}

								{event.notes && (
									<div className="mt-4 pt-4 border-t">
										<p className="text-sm text-muted-foreground">
											<strong>Notes:</strong> {event.notes}
										</p>
									</div>
								)}

								<div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
									<div className="flex items-center gap-1">
										<Target className="h-4 w-4" />
										<span className="capitalize">{event.workout.scoreType || "Time"}</span>
									</div>
									{event.workout.roundsToScore && (
										<div>
											<strong>Rounds to Score:</strong> {event.workout.roundsToScore}
										</div>
									)}
									{event.workout.repsPerRound && (
										<div>
											<strong>Reps/Round:</strong> {event.workout.repsPerRound}
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		</div>
	)
}
