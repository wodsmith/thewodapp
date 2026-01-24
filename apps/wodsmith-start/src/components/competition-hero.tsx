"use client"

import { Calendar, MapPin, Settings, Share2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CompetitionWithOrganizingTeam } from "@/server-fns/competition-fns"
import { formatUTCDateRange } from "@/utils/date-utils"

interface CompetitionHeroProps {
	competition: CompetitionWithOrganizingTeam
	registrationCount: number
	canManage?: boolean
}

export function CompetitionHero({
	competition,
	registrationCount,
	canManage = false,
}: CompetitionHeroProps) {
	// Use competition profile image, fall back to organizing team avatar
	const profileImage =
		competition.profileImageUrl ?? competition.organizingTeam?.avatarUrl

	return (
		<div className="relative overflow-hidden text-white">
			{/* Banner Image or Glassmorphism Background */}
			{competition.bannerImageUrl ? (
				<>
					<img
						src={competition.bannerImageUrl}
						alt=""
						className="absolute inset-0 h-full w-full object-cover"
					/>
					{/* Overlay for text readability */}
					<div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-slate-900/40" />
				</>
			) : null}

			{/* Glassmorphism content container */}
			<div className="container relative mx-auto px-4 py-8 md:py-12">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-8">
					<div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
						{/* Event Logo */}
						<div className="hidden h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/10 shadow-lg shadow-black/10 backdrop-blur-md md:flex">
							{profileImage ? (
								<img
									src={profileImage}
									alt={competition.name}
									className="h-full w-full object-cover"
								/>
							) : (
								<span className="text-4xl font-bold text-slate-300">
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
									<div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-slate-200/90">
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
								<div className="flex shrink-0 items-center gap-2">
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
									<Button
										variant="ghost"
										size="icon"
										className="border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
									>
										<Share2 className="h-5 w-5" />
										<span className="sr-only">Share</span>
									</Button>
								</div>
							</div>

							{/* Quick Stats */}
							<div className="flex flex-wrap gap-2">
								<Badge
									variant="secondary"
									className="border border-white/10 bg-white/10 text-slate-100 backdrop-blur-sm hover:bg-white/20"
								>
									<Users className="mr-1 h-3 w-3" />
									{registrationCount} Athletes
								</Badge>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
