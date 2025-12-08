import { Calendar, Clock, MapPin, Settings, Share2, Users } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Competition, CompetitionGroup, Team } from "@/db/schema"
import { formatUTCDateRange } from "@/utils/date-utils"

interface CompetitionHeroProps {
	competition: Competition & {
		organizingTeam: Team | null
		group: CompetitionGroup | null
	}
	registrationCount: number
	canManage?: boolean
	registrationOpen?: boolean
	registrationClosed?: boolean
	registrationNotYetOpen?: boolean
	registrationClosesAt?: Date | number | null
	maxCapacity?: number | null
}

function getDaysUntil(date: Date | number): number {
	const target = typeof date === "number" ? new Date(date) : date
	const now = new Date()
	const diff = target.getTime() - now.getTime()
	return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function CompetitionHero({
	competition,
	registrationCount,
	canManage = false,
	registrationOpen = false,
	registrationClosed = false,
	registrationNotYetOpen = false,
	registrationClosesAt,
	maxCapacity,
}: CompetitionHeroProps) {
	const daysUntilClose = registrationClosesAt
		? getDaysUntil(registrationClosesAt)
		: null
	const showUrgency =
		registrationOpen && daysUntilClose !== null && daysUntilClose <= 14
	const spotsRemaining = maxCapacity
		? maxCapacity - registrationCount
		: null
	const showSpotsWarning =
		spotsRemaining !== null && spotsRemaining <= 50 && spotsRemaining > 0
	// Use competition profile image, fall back to organizing team avatar
	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="relative text-white overflow-hidden">
			{/* Banner Image or Gradient Background */}
			{competition.bannerImageUrl ? (
				<>
					<Image
						src={competition.bannerImageUrl}
						alt=""
						fill
						className="object-cover"
						unoptimized
						priority
					/>
					{/* Overlay for text readability */}
					<div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40" />
				</>
			) : (
				<div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
			)}

			<div className="container relative mx-auto px-4 py-8 md:py-12">
				<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
					{/* Event Logo */}
					<div className="hidden md:flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-slate-700/50 border border-slate-600 overflow-hidden backdrop-blur-sm">
						{profileImage ? (
							<Image
								src={profileImage}
								alt={competition.name}
								width={144}
								height={144}
								className="h-full w-full object-cover"
								unoptimized
							/>
						) : (
							<span className="text-4xl font-bold text-slate-400">
								{competition.name.charAt(0)}
							</span>
						)}
					</div>

					{/* Event Details */}
					<div className="flex-1 space-y-4">
						<div className="flex items-start justify-between gap-4">
							<div className="space-y-1">
								{competition.group && (
									<p className="text-sm text-teal-400">
										{competition.group.name}
									</p>
								)}
								<h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
									{competition.name}
								</h1>
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-slate-300">
									<span className="flex items-center gap-1.5">
										<Calendar className="h-4 w-4" />
										{formatUTCDateRange(
											competition.startDate,
											competition.endDate,
										)}
									</span>
									<span className="flex items-center gap-1.5">
										<MapPin className="h-4 w-4" />
										{competition.organizingTeam?.name || "Location TBA"}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2 shrink-0">
								{canManage && (
									<Link href={`/compete/organizer/${competition.id}`}>
										<Button
											variant="secondary"
											size="sm"
											className="bg-teal-600 text-white hover:bg-teal-500"
										>
											<Settings className="h-4 w-4 mr-1" />
											Manage
										</Button>
									</Link>
								)}
								<Button
									variant="ghost"
									size="icon"
									className="text-slate-400 hover:text-white hover:bg-slate-700"
								>
									<Share2 className="h-5 w-5" />
									<span className="sr-only">Share</span>
								</Button>
							</div>
						</div>

						{/* Quick Stats & Urgency Indicators */}
						<div className="flex flex-wrap gap-2">
							<Badge
								variant="secondary"
								className="bg-slate-700/50 text-slate-200 hover:bg-slate-700"
							>
								<Users className="mr-1 h-3 w-3" />
								{registrationCount} Athletes
							</Badge>
							{registrationClosed && (
								<Badge
									variant="secondary"
									className="bg-red-900/50 text-red-200 border border-red-700/50"
								>
									Registration Closed
								</Badge>
							)}
							{registrationNotYetOpen && (
								<Badge
									variant="secondary"
									className="bg-blue-900/50 text-blue-200 border border-blue-700/50"
								>
									Registration Opening Soon
								</Badge>
							)}
							{showUrgency && daysUntilClose !== null && (
								<Badge
									variant="secondary"
									className="bg-amber-900/50 text-amber-200 border border-amber-700/50"
								>
									<Clock className="mr-1 h-3 w-3" />
									{daysUntilClose} day{daysUntilClose === 1 ? "" : "s"} left to
									register
								</Badge>
							)}
							{showSpotsWarning && spotsRemaining !== null && (
								<Badge
									variant="secondary"
									className="bg-orange-900/50 text-orange-200 border border-orange-700/50"
								>
									Only {spotsRemaining} spots left!
								</Badge>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
