import { Calendar, MapPin, Users } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"
import { getCompetitionScheduleSummary } from "@/server/competition-schedule"

interface ScheduleContentProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
}

export async function ScheduleContent({ competition }: ScheduleContentProps) {
	const schedule = await getCompetitionScheduleSummary(competition.id)

	if (schedule.length === 0) {
		return (
			<div className="container mx-auto px-4 py-8">
				<div className="max-w-4xl">
					<h2 className="text-2xl font-bold mb-6">Schedule</h2>

					<Alert variant="default" className="border-dashed">
						<Calendar className="h-4 w-4" />
						<AlertTitle>Schedule not yet published</AlertTitle>
						<AlertDescription>
							The heat schedule will be available closer to the event. Check
							back soon or follow the event organizer for updates.
						</AlertDescription>
					</Alert>
				</div>
			</div>
		)
	}

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleDateString(undefined, {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		})
	}

	const formatTime = (date: Date) => {
		return new Date(date).toLocaleTimeString(undefined, {
			hour: "numeric",
			minute: "2-digit",
		})
	}

	return (
		<div className="container mx-auto px-4 py-8">
			<div className="max-w-4xl">
				<h2 className="text-2xl font-bold mb-6">Schedule</h2>

				<div className="space-y-8">
					{schedule.map(({ date, heats }) => (
						<div key={date}>
							<h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
								<Calendar className="h-5 w-5" />
								{formatDate(date)}
							</h3>

							<div className="space-y-3">
								{heats.map((heat) => (
									<Card key={heat.id}>
										<CardContent className="py-4">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-4">
													<div className="text-lg font-mono font-medium">
														{formatTime(heat.startTime)}
													</div>
													<div>
														<div className="font-medium">
															Event {heat.trackOrder}: {heat.workoutName}
														</div>
														<div className="text-sm text-muted-foreground flex items-center gap-3">
															<span className="flex items-center gap-1">
																Heat {heat.heatNumber}
															</span>
															<span className="flex items-center gap-1">
																<MapPin className="h-3 w-3" />
																{heat.floor}
															</span>
															<span className="flex items-center gap-1">
																<Users className="h-3 w-3" />
																{heat.athleteCount}
															</span>
														</div>
													</div>
												</div>
												<Badge variant="secondary">{heat.divisionLabel}</Badge>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
