/**
 * EventSubmissionWindowCard
 *
 * Displays submission window times for an event in an online competition.
 * Shows when submissions open/close and links to the submission windows management page.
 */

import { Link } from "@tanstack/react-router"
import { Calendar, Clock, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EventSubmissionWindowCardProps {
	competitionId: string
	eventName: string
	submissionOpensAt: string | null
	submissionClosesAt: string | null
	timezone: string
}

/**
 * Format datetime for display in the given timezone
 */
function formatDateTime(isoString: string | null, timezone: string): string {
	if (!isoString) return "Not set"
	try {
		return new Date(isoString).toLocaleString("en-US", {
			timeZone: timezone,
			weekday: "short",
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
 * Determine submission window status
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

export function EventSubmissionWindowCard({
	competitionId,
	eventName,
	submissionOpensAt,
	submissionClosesAt,
	timezone,
}: EventSubmissionWindowCardProps) {
	const status = getWindowStatus(submissionOpensAt, submissionClosesAt)

	const statusConfig = {
		"not-configured": {
			label: "Not Configured",
			variant: "outline" as const,
		},
		upcoming: {
			label: "Upcoming",
			variant: "secondary" as const,
		},
		open: {
			label: "Open",
			variant: "default" as const,
		},
		closed: {
			label: "Closed",
			variant: "outline" as const,
		},
	}

	const { label, variant } = statusConfig[status]

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="flex items-center gap-2 text-lg">
						<Clock className="h-5 w-5" />
						Submission Window
					</CardTitle>
					<Badge variant={variant}>{label}</Badge>
				</div>
				<p className="text-sm text-muted-foreground mt-1">
					When athletes can submit scores for {eventName}
				</p>
			</CardHeader>
			<CardContent className="space-y-4">
				{status === "not-configured" ? (
					<div className="flex flex-col items-center gap-4 py-4">
						<p className="text-sm text-muted-foreground text-center">
							No submission window configured for this event.
						</p>
						<Button asChild variant="outline" size="sm">
							<Link
								to="/compete/organizer/$competitionId/submission-windows"
								params={{ competitionId }}
							>
								<Calendar className="h-4 w-4 mr-2" />
								Configure Submission Windows
							</Link>
						</Button>
					</div>
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-md border p-3">
								<p className="text-xs font-medium text-muted-foreground mb-1">
									Opens
								</p>
								<p className="font-medium">
									{formatDateTime(submissionOpensAt, timezone)}
								</p>
							</div>
							<div className="rounded-md border p-3">
								<p className="text-xs font-medium text-muted-foreground mb-1">
									Closes
								</p>
								<p className="font-medium">
									{formatDateTime(submissionClosesAt, timezone)}
								</p>
							</div>
						</div>

						<Button asChild variant="outline" size="sm" className="w-full">
							<Link
								to="/compete/organizer/$competitionId/submission-windows"
								params={{ competitionId }}
							>
								<ExternalLink className="h-4 w-4 mr-2" />
								Manage Submission Windows
							</Link>
						</Button>
					</>
				)}

				<p className="text-xs text-muted-foreground">Timezone: {timezone}</p>
			</CardContent>
		</Card>
	)
}
