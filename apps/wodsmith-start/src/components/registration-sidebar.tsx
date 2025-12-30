import {
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

function formatDateShort(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

function formatDeadlineDate(date: Date | number): string {
	const d = typeof date === "number" ? new Date(date) : date
	return d.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})
}

export function RegistrationSidebar({
	competition,
	isRegistered,
	registrationOpen,
	registrationCount,
	maxSpots,
	userDivision,
	registrationId,
	isTeamRegistration,
	isCaptain,
	isVolunteer = false,
}: RegistrationSidebarProps) {
	const regClosesAt = competition.registrationClosesAt

	return (
		<div className="space-y-4">
			{/* Volunteer Dashboard Button */}
			{isVolunteer && (
				<Card className="border-2 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
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

			{/* Registration Status Card */}
			{(isRegistered || (registrationOpen && regClosesAt)) && (
				<Card className="border-2 border-teal-500/20 bg-gradient-to-br from-teal-500/5 to-transparent">
					<CardContent className="p-4">
						{isRegistered ? (
							<div className="space-y-3">
								<div className="flex items-center gap-2 text-green-600">
									<CheckCircle2 className="h-5 w-5" />
									<span className="font-semibold">You're Registered!</span>
								</div>
								{userDivision && (
									<p className="text-sm text-muted-foreground">
										Division:{" "}
										<span className="font-medium">{userDivision}</span>
									</p>
								)}
								{registrationId && (
									<Button
										asChild
										variant="outline"
										size="sm"
										className="w-full"
									>
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
						) : (
							<div className="space-y-2">
								{regClosesAt && (
									<div className="flex items-center gap-1 text-amber-600">
										<Clock className="h-4 w-4" />
										<span className="text-sm font-medium">
											Register by {formatDeadlineDate(regClosesAt)}
										</span>
									</div>
								)}
								{maxSpots && (
									<p className="text-sm text-muted-foreground">
										{registrationCount}/{maxSpots} spots filled
									</p>
								)}
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{/* Date & Location Card */}
			<Card>
				<CardContent className="p-4 space-y-3">
					<div className="flex items-start gap-3">
						<Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
						<div>
							<p className="font-medium">
								{formatDateShort(competition.startDate)}
								{competition.startDate !== competition.endDate && (
									<> - {formatDateShort(competition.endDate)}</>
								)}
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

			{/* Spectator Info - Stub */}
			<Card className="border-dashed">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Spectators
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-xs text-muted-foreground italic">
						Spectator ticket info coming soon
					</p>
				</CardContent>
			</Card>

			{/* Refund Policy - Stub */}
			<Card className="border-dashed">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-medium text-muted-foreground">
						Refund Policy
					</CardTitle>
				</CardHeader>
				<CardContent className="pt-0">
					<p className="text-xs text-muted-foreground italic">
						Refund policy coming soon
					</p>
				</CardContent>
			</Card>

			{/* Contact Card */}
			{competition.organizingTeam && (
				<Card>
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
