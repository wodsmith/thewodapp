"use client"

import { Link } from "@tanstack/react-router"
import {
	Calendar,
	ClipboardList,
	Globe,
	MapPin,
	Settings,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { CompetitionWithOrganizingTeam } from "@/server-fns/competition-fns"
import { formatLocationBadge } from "@/utils/address"
import { formatUTCDateRange } from "@/utils/date-utils"

interface CompetitionHeroProps {
	competition: CompetitionWithOrganizingTeam
	canManage?: boolean
	isVolunteer?: boolean
}

export function CompetitionHero({
	competition,
	canManage = false,
	isVolunteer = false,
}: CompetitionHeroProps) {
	// Show judges schedule link for organizers and volunteers
	const showJudgesScheduleLink = canManage || isVolunteer
	// Use competition profile image, fall back to organizing team avatar
	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	const hasBanner = !!competition.bannerImageUrl

	// Format location badge using address from competition
	const locationBadge = formatLocationBadge(
		competition.address,
		competition.competitionType,
		competition.organizingTeam?.name,
	)
	const LocationIcon = locationBadge.icon === "globe" ? Globe : MapPin

	return (
		<div
			className={cn("relative", hasBanner ? "text-white" : "text-foreground")}
		>
			{/* Glassmorphism content container - pushed down into banner area */}
			<div
				className={cn(
					"pb-4 md:pb-8",
					hasBanner ? "pt-12 md:pt-16 lg:pt-20" : "",
				)}
			>
				<div
					className={cn(
						"rounded-2xl border p-4 shadow-2xl backdrop-blur-xl sm:p-6 md:p-8",
						hasBanner
							? "border-white/10 bg-black/10 shadow-black/10"
							: "border-black/5 bg-black/[0.03] shadow-black/5 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-black/10",
					)}
				>
					<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
						{/* Event Logo */}
						<div
							className={cn(
								"hidden h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border shadow-lg backdrop-blur-md md:flex",
								hasBanner
									? "border-white/15 bg-white/5 shadow-black/5"
									: "border-black/5 bg-black/[0.03] shadow-black/5 dark:border-white/15 dark:bg-white/5 dark:shadow-black/5",
							)}
						>
							{profileImage ? (
								<img
									src={profileImage}
									alt={competition.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<span
									className={cn(
										"text-4xl font-bold",
										hasBanner ? "text-slate-300" : "text-muted-foreground",
									)}
								>
									{competition.name.charAt(0)}
								</span>
							)}
						</div>

						{/* Event Details */}
						<div className="flex-1 space-y-4">
							<div className="flex items-start justify-between gap-4">
								<div className="space-y-1">
									{competition.group && (
										<p className="text-sm text-orange-500">
											{competition.group.name}
										</p>
									)}
									<h1 className="text-3xl font-bold md:text-4xl lg:text-5xl">
										{competition.name}
									</h1>
									<div
										className={cn(
											"flex flex-wrap items-center gap-x-4 gap-y-2 pt-2",
											hasBanner ? "text-slate-200/90" : "text-muted-foreground",
										)}
									>
										<span className="flex items-center gap-1.5">
											<Calendar className="h-4 w-4" />
											{formatUTCDateRange(
												competition.startDate,
												competition.endDate,
											)}
										</span>
										<span className="flex items-center gap-1.5">
											<LocationIcon className="h-4 w-4" />
											{locationBadge.text}
										</span>
									</div>
								</div>
								{/* Desktop action buttons */}
								<div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
									{canManage && (
										<a href={`/compete/organizer/${competition.id}`}>
											<Button
												variant="secondary"
												size="sm"
												className="bg-orange-600 text-white hover:bg-orange-500"
											>
												<Settings className="mr-1 h-4 w-4" />
												Manage
											</Button>
										</a>
									)}
									{showJudgesScheduleLink && (
										<Link
											to="/compete/$slug/judges-schedule"
											params={{ slug: competition.slug }}
										>
											<Button
												variant="secondary"
												size="sm"
												className={cn(
													"border",
													hasBanner
														? "border-white/10 bg-white/10 text-slate-100 hover:bg-white/20"
														: "border-black/10 bg-black/5 text-foreground hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20",
												)}
											>
												<ClipboardList className="mr-1 h-4 w-4" />
												Judges Schedule
											</Button>
										</Link>
									)}
								</div>
							</div>

							{/* Mobile action buttons */}
							<div className="flex flex-wrap items-center gap-2 sm:hidden">
								{canManage && (
									<a href={`/compete/organizer/${competition.id}`}>
										<Button
											variant="secondary"
											size="sm"
											className="bg-orange-600 text-white hover:bg-orange-500"
										>
											<Settings className="mr-1 h-4 w-4" />
											Manage
										</Button>
									</a>
								)}
								{showJudgesScheduleLink && (
									<Link
										to="/compete/$slug/judges-schedule"
										params={{ slug: competition.slug }}
									>
										<Button
											variant="secondary"
											size="sm"
											className={cn(
												"border",
												hasBanner
													? "border-white/10 bg-white/10 text-slate-100 hover:bg-white/20"
													: "border-black/10 bg-black/5 text-foreground hover:bg-black/10 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/20",
											)}
										>
											<ClipboardList className="mr-1 h-4 w-4" />
											Judges
										</Button>
									</Link>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
