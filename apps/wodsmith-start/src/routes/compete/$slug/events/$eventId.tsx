import { createFileRoute, notFound } from "@tanstack/react-router"
import {
	Calendar,
	Clock,
	Dumbbell,
	ExternalLink,
	Link,
	Target,
	Timer,
	Trophy,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPublicCompetitionDivisionsFn } from "@/server-fns/competition-divisions-fns"
import { getCompetitionBySlugFn } from "@/server-fns/competition-fns"
import {
	getPublicEventDetailsFn,
	getWorkoutDivisionDescriptionsFn,
} from "@/server-fns/competition-workouts-fns"

export const Route = createFileRoute("/compete/$slug/events/$eventId")({
	component: EventDetailsPage,
	loader: async ({ params }) => {
		const { slug, eventId } = params

		// Fetch competition by slug first
		const { competition } = await getCompetitionBySlugFn({
			data: { slug },
		})

		if (!competition) {
			throw notFound()
		}

		// Fetch event details in parallel with divisions
		const [eventResult, divisionsResult] = await Promise.all([
			getPublicEventDetailsFn({ data: { eventId } }),
			getPublicCompetitionDivisionsFn({
				data: { competitionId: competition.id },
			}),
		])

		if (!eventResult.event) {
			throw notFound()
		}

		// Fetch division descriptions if there are divisions
		const divisions = divisionsResult.divisions ?? []
		let divisionDescriptions: Array<{
			divisionId: string
			divisionLabel: string
			description: string | null
			position: number
		}> = []

		if (divisions.length > 0) {
			const descResult = await getWorkoutDivisionDescriptionsFn({
				data: {
					workoutId: eventResult.event.workoutId,
					divisionIds: divisions.map((d) => d.id),
				},
			})
			divisionDescriptions = descResult.descriptions
		}

		return {
			competition,
			event: eventResult.event,
			resources: eventResult.resources,
			heatTimes: eventResult.heatTimes,
			totalEvents: eventResult.totalEvents,
			divisionDescriptions,
		}
	},
})

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60)
	const s = seconds % 60
	return `${m}:${s.toString().padStart(2, "0")}`
}

function getSchemeLabel(scheme: string, timeCap?: number | null): string {
	if (scheme === "time" || scheme === "time-with-cap") {
		return timeCap ? "For Time (Capped)" : "For Time"
	}
	if (scheme === "amrap") return "AMRAP"
	if (scheme === "emom") return "EMOM"
	if (scheme === "load") return "For Load"
	return scheme.replace(/-/g, " ").toUpperCase()
}

function formatHeatTime(date: Date, timezone?: string | null): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		timeZone: timezone ?? undefined,
	}).format(new Date(date))
}

function formatEventDate(
	startDate: string | null,
	endDate: string | null,
): string | null {
	if (!startDate) return null

	const start = new Date(startDate)
	const formatOptions: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	}

	if (!endDate || start.toDateString() === new Date(endDate).toDateString()) {
		return new Intl.DateTimeFormat("en-US", formatOptions).format(start)
	}

	const end = new Date(endDate)
	const startStr = new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(start)
	const endStr = new Intl.DateTimeFormat("en-US", formatOptions).format(end)

	return `${startStr} - ${endStr}`
}

function getResourceIcon(url: string | null) {
	if (!url) return <Link className="h-4 w-4" />
	return <Link className="h-4 w-4" />
}

function EventDetailsPage() {
	const {
		competition,
		event,
		resources,
		heatTimes,
		totalEvents,
		divisionDescriptions,
	} = Route.useLoaderData()

	const workout = event.workout
	const formattedTimeCap = workout.timeCap ? formatTime(workout.timeCap) : null
	const schemeLabel = getSchemeLabel(workout.scheme, workout.timeCap)

	// Get RX description (position 0 is typically the hardest/RX)
	const sortedDivisions = [...divisionDescriptions].sort(
		(a, b) => a.position - b.position,
	)
	const rxDivision = sortedDivisions.find((d) => d.position === 0)
	const displayDescription =
		rxDivision?.description || workout.description || null

	// Only show divisions that have descriptions
	const divisionsWithDescriptions = sortedDivisions.filter((d) => d.description)

	const eventDate = formatEventDate(competition.startDate, competition.endDate)

	return (
		<div className="space-y-6">
			{/* Event Title with Context */}
			<div className="space-y-2">
				<div className="flex items-center gap-3">
					<Badge variant="outline" className="text-xs font-medium">
						Event {event.trackOrder} of {totalEvents}
					</Badge>
					{event.sponsorName && (
						<span className="text-xs text-muted-foreground">
							Presented by{" "}
							<span className="font-medium">{event.sponsorName}</span>
						</span>
					)}
				</div>
				<h1 className="text-3xl font-bold tracking-tight">{workout.name}</h1>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				{/* Main Content - Event Details */}
				<div className="lg:col-span-2 space-y-6">
					{/* Event Description */}
					<div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
						{displayDescription || "Details coming soon."}
					</div>

					{/* Division Variations */}
					{divisionsWithDescriptions.length > 1 && (
						<div className="space-y-6">
							<h3 className="text-lg font-semibold">Division Variations</h3>
							{divisionsWithDescriptions.map((div) => (
								<div key={div.divisionId}>
									<h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
										{div.divisionLabel}
										{div.position === 0 && (
											<Badge variant="secondary" className="text-xs">
												RX
											</Badge>
										)}
									</h4>
									<div className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
										{div.description}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Event Resources Card */}
					{resources.length > 0 && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">Event Resources</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{resources.map(
									(resource: {
										id: string
										title: string
										description: string | null
										url: string | null
									}) => (
										<a
											key={resource.id}
											href={resource.url ?? "#"}
											target="_blank"
											rel="noopener noreferrer"
											className={cn(
												"flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors group",
												!resource.url && "pointer-events-none",
											)}
										>
											<div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
												{getResourceIcon(resource.url)}
											</div>
											<div className="flex-1 min-w-0">
												<p className="font-medium text-sm group-hover:text-primary transition-colors">
													{resource.title}
												</p>
												{resource.description && (
													<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
														{resource.description}
													</p>
												)}
											</div>
											{resource.url && (
												<ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
											)}
										</a>
									),
								)}
							</CardContent>
						</Card>
					)}

					{/* Event Info Card */}
					<Card>
						<CardContent className="pt-6 space-y-4">
							{/* Workout Type */}
							<div className="flex items-start gap-3">
								<Target className="h-4 w-4 text-muted-foreground mt-0.5" />
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider">
										Format
									</p>
									<p className="font-medium text-sm">{schemeLabel}</p>
								</div>
							</div>

							{/* Time Cap */}
							{formattedTimeCap && (
								<div className="flex items-start gap-3">
									<Timer className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											Time Cap
										</p>
										<p className="font-medium text-sm">{formattedTimeCap}</p>
									</div>
								</div>
							)}

							{/* Movements */}
							{workout.movements && workout.movements.length > 0 && (
								<div className="flex items-start gap-3">
									<Dumbbell className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											Movements
										</p>
										<p className="font-medium text-sm">
											{workout.movements
												.map((m: { id: string; name: string }) => m.name)
												.join(", ")}
										</p>
									</div>
								</div>
							)}

							{eventDate && (
								<div className="flex items-start gap-3">
									<Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											Date
										</p>
										<p className="font-medium text-sm">{eventDate}</p>
									</div>
								</div>
							)}
							{event.pointsMultiplier && event.pointsMultiplier !== 100 && (
								<div className="flex items-start gap-3">
									<Trophy className="h-4 w-4 text-muted-foreground mt-0.5" />
									<div>
										<p className="text-xs text-muted-foreground uppercase tracking-wider">
											Points Multiplier
										</p>
										<p className="font-medium text-sm">
											{event.pointsMultiplier / 100}x
										</p>
									</div>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Schedule Card */}
					{heatTimes && (
						<Card>
							<CardHeader className="pb-3">
								<CardTitle className="text-lg">Schedule</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
										<div>
											<p className="text-xs text-muted-foreground uppercase tracking-wider">
												First Heat Starts
											</p>
											<p className="font-medium text-sm">
												{formatHeatTime(
													heatTimes.firstHeatStartTime,
													competition.timezone,
												)}
											</p>
										</div>
									</div>
									{heatTimes.firstHeatStartTime.getTime() !==
										heatTimes.lastHeatEndTime.getTime() && (
										<div className="flex items-start gap-3">
											<Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
											<div>
												<p className="text-xs text-muted-foreground uppercase tracking-wider">
													Last Heat Ends
												</p>
												<p className="font-medium text-sm">
													{formatHeatTime(
														heatTimes.lastHeatEndTime,
														competition.timezone,
													)}
												</p>
											</div>
										</div>
									)}
								</div>
								<Separator />
								<p className="text-xs text-muted-foreground">
									Timezone: {competition.timezone}
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	)
}
