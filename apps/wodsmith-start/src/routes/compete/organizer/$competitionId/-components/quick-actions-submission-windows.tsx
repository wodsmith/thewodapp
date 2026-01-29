/**
 * QuickActionsSubmissionWindows
 *
 * Shows submission window status for each event in online competitions.
 * Displays when submissions open/close and provides a link to manage windows.
 */

import { Link } from "@tanstack/react-router"
import { Calendar, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card"
import type { CompetitionWorkout } from "@/server-fns/competition-workouts-fns"

interface CompetitionEvent {
	id: string
	trackWorkoutId: string
	submissionOpensAt: string | null
	submissionClosesAt: string | null
}

interface QuickActionsSubmissionWindowsProps {
	competitionId: string
	events: CompetitionWorkout[]
	competitionEvents: CompetitionEvent[]
	timezone: string
}

/**
 * Format datetime for display
 */
function formatDateTime(isoString: string | null, timezone: string): string {
	if (!isoString) return "Not set"
	try {
		return new Date(isoString).toLocaleString("en-US", {
			timeZone: timezone,
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})
	} catch {
		return new Date(isoString).toLocaleString()
	}
}

/**
 * Get window status for display
 */
function getWindowStatus(
	opensAt: string | null,
	closesAt: string | null,
): "not-configured" | "upcoming" | "open" | "closed" {
	if (!opensAt || !closesAt) return "not-configured"

	const now = new Date()
	const opens = new Date(opensAt)
	const closes = new Date(closesAt)

	if (now < opens) return "upcoming"
	if (now >= opens && now <= closes) return "open"
	return "closed"
}

export function QuickActionsSubmissionWindows({
	competitionId,
	events,
	competitionEvents,
	timezone,
}: QuickActionsSubmissionWindowsProps) {
	// Map trackWorkoutId to competition event for quick lookup
	const eventMap = new Map(
		competitionEvents.map((ce) => [ce.trackWorkoutId, ce]),
	)

	// Count configured events
	const configuredCount = events.filter((e) => {
		const ce = eventMap.get(e.id)
		return ce?.submissionOpensAt && ce?.submissionClosesAt
	}).length

	const openCount = events.filter((e) => {
		const ce = eventMap.get(e.id)
		return (
			getWindowStatus(
				ce?.submissionOpensAt ?? null,
				ce?.submissionClosesAt ?? null,
			) === "open"
		)
	}).length

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-muted-foreground" />
						<div>
							<CardTitle className="text-base">Submission Windows</CardTitle>
							<CardDescription>
								When athletes can submit their scores
							</CardDescription>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{openCount > 0 && (
							<Badge variant="default" className="text-xs">
								{openCount} open
							</Badge>
						)}
						<Badge variant="secondary" className="text-xs">
							{configuredCount}/{events.length} configured
						</Badge>
					</div>
				</div>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="space-y-2">
					{events.map((event) => {
						const ce = eventMap.get(event.id)
						const status = getWindowStatus(
							ce?.submissionOpensAt ?? null,
							ce?.submissionClosesAt ?? null,
						)

						const statusConfig = {
							"not-configured": {
								label: "Not set",
								className: "text-muted-foreground",
							},
							upcoming: { label: "Upcoming", className: "text-yellow-600" },
							open: { label: "Open", className: "text-green-600" },
							closed: { label: "Closed", className: "text-muted-foreground" },
						}

						const { label, className } = statusConfig[status]

						return (
							<div
								key={event.id}
								className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
										{event.trackOrder}
									</span>
									<span className="text-sm truncate">{event.workout.name}</span>
								</div>
								<div className="flex items-center gap-2 text-xs shrink-0">
									{status !== "not-configured" && ce ? (
										<span className="text-muted-foreground hidden sm:inline">
											{formatDateTime(ce.submissionOpensAt, timezone)} -{" "}
											{formatDateTime(ce.submissionClosesAt, timezone)}
										</span>
									) : null}
									<Badge variant="outline" className={`text-xs ${className}`}>
										{label}
									</Badge>
								</div>
							</div>
						)
					})}
				</div>

				<Button asChild variant="outline" size="sm" className="w-full">
					<Link
						to="/compete/organizer/$competitionId/submission-windows"
						params={{ competitionId }}
					>
						<Calendar className="h-4 w-4 mr-2" />
						Manage Submission Windows
					</Link>
				</Button>
			</CardContent>
		</Card>
	)
}
