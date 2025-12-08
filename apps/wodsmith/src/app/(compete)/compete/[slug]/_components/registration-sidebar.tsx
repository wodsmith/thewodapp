import {
	Calendar,
	CheckCircle2,
	Clock,
	DollarSign,
	Mail,
	MapPin,
	Users,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"

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
	priceRange?: { min: number; max: number } | null
	divisionCount?: number
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

function formatPrice(cents: number): string {
	if (cents === 0) return "Free"
	return `$${(cents / 100).toFixed(0)}`
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
	priceRange,
	divisionCount,
}: RegistrationSidebarProps) {
	const regClosesAt = competition.registrationClosesAt

	return (
		<div className="space-y-4">
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
										<Link
											href={`/compete/${competition.slug}/teams/${registrationId}`}
										>
											<Users className="mr-2 h-4 w-4" />
											{isTeamRegistration
												? isCaptain
													? "Manage Team"
													: "View Team"
												: "View Registration"}
										</Link>
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

			{/* Quick Facts Card */}
			<Card>
				<CardContent className="p-4">
					<div className="grid grid-cols-2 gap-4">
						{/* Date */}
						<div className="space-y-1">
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<Calendar className="h-3.5 w-3.5" />
								<span className="text-xs uppercase tracking-wide">When</span>
							</div>
							<p className="text-sm font-medium">
								{formatDateShort(competition.startDate)}
								{competition.startDate !== competition.endDate && (
									<>
										<br />
										{formatDateShort(competition.endDate)}
									</>
								)}
							</p>
						</div>

						{/* Location */}
						<div className="space-y-1">
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<MapPin className="h-3.5 w-3.5" />
								<span className="text-xs uppercase tracking-wide">Where</span>
							</div>
							<p className="text-sm font-medium">
								{competition.organizingTeam?.name || "TBA"}
							</p>
						</div>

						{/* Price */}
						{priceRange && (
							<div className="space-y-1">
								<div className="flex items-center gap-1.5 text-muted-foreground">
									<DollarSign className="h-3.5 w-3.5" />
									<span className="text-xs uppercase tracking-wide">Entry</span>
								</div>
								<p className="text-sm font-medium">
									{priceRange.min === priceRange.max
										? formatPrice(priceRange.min)
										: `${formatPrice(priceRange.min)} - ${formatPrice(priceRange.max)}`}
								</p>
							</div>
						)}

						{/* Athletes */}
						<div className="space-y-1">
							<div className="flex items-center gap-1.5 text-muted-foreground">
								<Users className="h-3.5 w-3.5" />
								<span className="text-xs uppercase tracking-wide">Athletes</span>
							</div>
							<p className="text-sm font-medium">
								{registrationCount}
								{maxSpots && (
									<span className="text-muted-foreground">/{maxSpots}</span>
								)}
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Contact Card */}
			{competition.organizingTeam && (
				<Card>
					<CardContent className="p-4">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
									Organized by
								</p>
								<p className="font-medium text-sm">
									{competition.organizingTeam.name}
								</p>
							</div>
							<Button variant="outline" size="sm" className="h-8 shrink-0">
								<Mail className="mr-1.5 h-3.5 w-3.5" />
								Contact
							</Button>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	)
}
