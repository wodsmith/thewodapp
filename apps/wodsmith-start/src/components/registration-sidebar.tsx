import { Link } from "@tanstack/react-router"
import {
	AlertTriangle,
	Calendar,
	CheckCircle2,
	Clock,
	Mail,
	MapPin,
	Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Competition, CompetitionGroup } from "@/db/schemas/competitions"
import type { Team } from "@/db/schemas/teams"
import { formatDateStringFull, isSameDateString } from "@/utils/date-utils"
import {
	getEndOfDayInTimezone,
	hasDateStartedInTimezone,
	DEFAULT_TIMEZONE,
} from "@/utils/timezone-utils"

/**
 * Calculate time remaining until deadline and return urgency level
 * Accepts YYYY-MM-DD string, Date, or number (timestamp)
 * For YYYY-MM-DD strings, uses the competition's timezone to determine end of day
 */
function getDeadlineUrgency(
	deadline: string | Date | number,
	timezone: string = DEFAULT_TIMEZONE,
): {
	daysRemaining: number
	hoursRemaining: number
	urgencyLevel: "critical" | "urgent" | "normal" | "none"
	message: string
} {
	const now = new Date()
	// Handle YYYY-MM-DD strings by parsing to end of day in competition's timezone
	let deadlineDate: Date
	if (typeof deadline === "string") {
		const endOfDay = getEndOfDayInTimezone(deadline, timezone)
		if (!endOfDay) {
			// Invalid date string
			return {
				daysRemaining: 0,
				hoursRemaining: 0,
				urgencyLevel: "none",
				message: "",
			}
		}
		deadlineDate = endOfDay
	} else if (typeof deadline === "number") {
		deadlineDate = new Date(deadline)
	} else {
		deadlineDate = deadline
	}
	const diffMs = deadlineDate.getTime() - now.getTime()

	if (diffMs <= 0) {
		return {
			daysRemaining: 0,
			hoursRemaining: 0,
			urgencyLevel: "none",
			message: "Registration closed",
		}
	}

	const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60))
	const daysRemaining = Math.floor(hoursRemaining / 24)

	if (hoursRemaining <= 24) {
		const hours = hoursRemaining
		return {
			daysRemaining,
			hoursRemaining,
			urgencyLevel: "critical",
			message:
				hours <= 1 ? "Less than 1 hour left!" : `Only ${hours} hours left!`,
		}
	}

	if (daysRemaining <= 3) {
		return {
			daysRemaining,
			hoursRemaining,
			urgencyLevel: "urgent",
			message:
				daysRemaining === 1
					? "Last day to register!"
					: `Only ${daysRemaining} days left!`,
		}
	}

	if (daysRemaining <= 7) {
		return {
			daysRemaining,
			hoursRemaining,
			urgencyLevel: "normal",
			message: `${daysRemaining} days left to register`,
		}
	}

	return {
		daysRemaining,
		hoursRemaining,
		urgencyLevel: "none",
		message: "",
	}
}

interface RegistrationSidebarProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	isRegistered: boolean
	registrationOpen: boolean
	registrationCount: number
	maxSpots?: number
	userDivision?: string | null
	registrationId?: string | null
	isTeamRegistration?: boolean
	isCaptain?: boolean
	isVolunteer?: boolean
}

function formatDateShort(date: string | Date | number): string {
	// Handle YYYY-MM-DD strings using utility
	if (typeof date === "string") {
		return formatDateStringFull(date) || date
	}
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

function formatDeadlineDate(date: string | Date | number): string {
	return formatDateShort(date)
}

export function RegistrationSidebar({
	competition,
	isRegistered,
	registrationOpen,
	registrationCount,
	maxSpots: _maxSpots, // Reserved for future "X spots left" feature
	userDivision,
	registrationId,
	isTeamRegistration,
	isCaptain,
	isVolunteer = false,
}: RegistrationSidebarProps) {
	const regClosesAt = competition.registrationClosesAt
	const regOpensAt = competition.registrationOpensAt
	const competitionTimezone = competition.timezone || DEFAULT_TIMEZONE

	// Calculate urgency for deadline (using competition's timezone)
	const urgency = regClosesAt
		? getDeadlineUrgency(regClosesAt, competitionTimezone)
		: null

	// Check if registration hasn't opened yet (using competition's timezone)
	const registrationNotYetOpen =
		regOpensAt && !hasDateStartedInTimezone(regOpensAt, competitionTimezone)

	return (
		<div className="space-y-4">
			{/* Volunteer Dashboard Button */}
			{isVolunteer && (
				<Card className="border-2 border-blue-500/20 bg-white/5 backdrop-blur-md">
					<CardContent className="p-4">
						<Button asChild variant="default" size="sm" className="w-full">
							<a href={`/compete/${competition.slug}/my-schedule`}>
								<Calendar className="mr-2 h-4 w-4" />
								My Volunteer Schedule
							</a>
						</Button>
					</CardContent>
				</Card>
			)}

			{/* Registration CTA Card */}
			{!isRegistered && registrationOpen && (
				<Card
					className={`backdrop-blur-md ${
						urgency?.urgencyLevel === "critical"
							? "border-2 border-red-500/50 bg-red-500/10"
							: urgency?.urgencyLevel === "urgent"
								? "border-2 border-amber-500/50 bg-amber-500/10"
								: "border-2 border-orange-500/20 bg-white/5"
					}`}
				>
					<CardContent className="p-4 space-y-3">
						{/* Urgency Message */}
						{urgency && urgency.urgencyLevel !== "none" && (
							<div
								className={`flex items-center gap-2 ${
									urgency.urgencyLevel === "critical"
										? "text-red-600"
										: urgency.urgencyLevel === "urgent"
											? "text-amber-600"
											: "text-muted-foreground"
								}`}
							>
								{urgency.urgencyLevel === "critical" ? (
									<AlertTriangle className="h-4 w-4" />
								) : (
									<Clock className="h-4 w-4" />
								)}
								<span className="text-sm font-semibold">{urgency.message}</span>
							</div>
						)}

						{/* Register Button */}
						<Button asChild size="lg" className="w-full">
							<Link
								to="/compete/$slug/register"
								params={{ slug: competition.slug }}
							>
								Register Now
							</Link>
						</Button>

						{/* Deadline info (if not already shown in urgency) */}
						{regClosesAt && urgency?.urgencyLevel === "none" && (
							<p className="text-xs text-muted-foreground text-center">
								Registration closes {formatDeadlineDate(regClosesAt)}
							</p>
						)}

						{/* Social proof */}
						{registrationCount > 0 && (
							<p className="text-xs text-muted-foreground text-center">
								{registrationCount} athlete{registrationCount !== 1 ? "s" : ""}{" "}
								registered
							</p>
						)}
					</CardContent>
				</Card>
			)}

			{/* Registration Not Yet Open */}
			{!isRegistered &&
				!registrationOpen &&
				registrationNotYetOpen &&
				regOpensAt && (
					<Card className="border-white/10 bg-white/5 backdrop-blur-md">
						<CardContent className="p-4 space-y-2">
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="h-4 w-4" />
								<span className="text-sm font-medium">
									Registration opens soon
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Opens {formatDeadlineDate(regOpensAt)}
							</p>
						</CardContent>
					</Card>
				)}

			{/* Registration Closed */}
			{!isRegistered &&
				!registrationOpen &&
				!registrationNotYetOpen &&
				regClosesAt && (
					<Card className="border-white/10 bg-white/5 backdrop-blur-md">
						<CardContent className="p-4">
							<div className="flex items-center gap-2 text-muted-foreground">
								<Clock className="h-4 w-4" />
								<span className="text-sm font-medium">Registration closed</span>
							</div>
						</CardContent>
					</Card>
				)}

			{/* Already Registered Card */}
			{isRegistered && (
				<Card className="border-2 border-green-500/20 bg-white/5 backdrop-blur-md">
					<CardContent className="p-4">
						<div className="space-y-3">
							<div className="flex items-center gap-2 text-green-600">
								<CheckCircle2 className="h-5 w-5" />
								<span className="font-semibold">You're Registered!</span>
							</div>
							{userDivision && (
								<p className="text-sm text-muted-foreground">
									Division: <span className="font-medium">{userDivision}</span>
								</p>
							)}
							{registrationId && (
								<Button asChild variant="outline" size="sm" className="w-full">
									<a
										href={`/compete/${competition.slug}/teams/${registrationId}`}
									>
										<Users className="mr-2 h-4 w-4" />
										{isTeamRegistration
											? isCaptain
												? "Manage Team"
												: "View Team"
											: "View Registration"}
									</a>
								</Button>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Date & Location Card */}
			<Card className="border-white/10 bg-white/5 backdrop-blur-md">
				<CardContent className="p-4 space-y-3">
					<div className="flex items-start gap-3">
						<Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
						<div>
							<p className="font-medium">
								{formatDateShort(competition.startDate)}
								{!isSameDateString(
									competition.startDate,
									competition.endDate,
								) && <> - {formatDateShort(competition.endDate)}</>}
							</p>
						</div>
					</div>
					<div className="flex items-start gap-3">
						<MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
						<div>
							<p className="font-medium">
								{competition.organizingTeam?.name || "Location TBA"}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Contact Card */}
			{competition.organizingTeam && (
				<Card className="border-white/10 bg-white/5 backdrop-blur-md">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium">Contact</CardTitle>
					</CardHeader>
					<CardContent className="pt-0">
						<p className="font-medium text-sm">
							{competition.organizingTeam.name}
						</p>
						<div className="mt-2 flex gap-2">
							<Button variant="outline" size="sm" className="h-8" disabled>
								<Mail className="mr-1 h-3 w-3" />
								Email
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
